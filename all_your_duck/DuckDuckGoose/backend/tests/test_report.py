"""Report agent tests. Injected routed fake LLMs throughout
(same pattern as tests/population/test_builder.py): chat_json answers the
outline call, plain chat answers section calls, routed by prompt content."""

import json
import sqlite3

import pytest

from app.core.projects import ProjectStore
from app.services.report import generate_report, top_posts

RUN_ID = "run_" + "a" * 12

OUTLINE = {
    "sections": [
        {"title": "Crowd reaction", "focus": "how the crowd responded"},
        {"title": "Protagonist push", "focus": "what the protagonists did"},
        {"title": "Sentiment trend", "focus": "sentiment over the rounds"},
    ],
    "direction": {"answer": "yes, prices likely pass $95", "confidence": 0.7},
}

GROUNDED_MD = "In round 0, alice_p posted about a crash and the crowd liked it."
UNGROUNDED_MD = "The crowd stayed quiet overall with little engagement."


class RoutedFakeLLM:
    """Outline via chat_json; sections via chat, routed by section focus."""

    def __init__(self, outline=None, section_replies=None, outline_error=None):
        self.outline = OUTLINE if outline is None else outline
        self.section_replies = section_replies or {}
        self.outline_error = outline_error
        self.json_prompts = []
        self.chat_prompts = []

    def chat_json(self, messages, temperature=0.7):
        self.json_prompts.append(json.dumps(messages))
        if self.outline_error is not None:
            raise self.outline_error
        return self.outline

    def chat(self, messages, temperature=0.7, json_mode=False):
        text = json.dumps(messages)
        self.chat_prompts.append(text)
        for focus, reply in self.section_replies.items():
            if focus in text:
                if isinstance(reply, Exception):
                    raise reply
                return reply
        return GROUNDED_MD


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


@pytest.fixture
def run(store):
    """Project + finished run dir: population, run.json, state.json,
    export mapping, events, and a reddit db with liked posts."""
    p = store.create(name="t", question="Will oil pass $95?")
    run_dir = store.project_dir(p["id"]) / "runs" / RUN_ID
    run_dir.mkdir(parents=True)
    (run_dir / "state.json").write_text(json.dumps({
        "status": "finished", "batch_id": "batch_x",
        "created_at": "2026-06-10T00:00:00+00:00",
    }), encoding="utf-8")
    (run_dir / "run.json").write_text(json.dumps({
        "run_id": RUN_ID, "platform": "reddit", "rounds": 2, "seed": 1,
        "endpoints": {"protagonist": None, "crowd_llm": None},
    }), encoding="utf-8")
    (run_dir / "population.json").write_text(json.dumps({
        "key_topics": ["oil prices"],
        "protagonist_uids": ["agent_p"],
        "agents": [
            {"agent_uid": "agent_p", "tier": "protagonist",
             "name": "Alice", "username": "alice_p"},
            {"agent_uid": "agent_c1", "tier": "crowd_policy",
             "name": "Cara", "username": "cara_c1"},
        ],
    }), encoding="utf-8")
    (run_dir / "export_mapping.json").write_text(json.dumps({
        "uid_to_position": {"agent_p": 0, "agent_c1": 1},
    }), encoding="utf-8")

    from simworker.events import EventWriter
    w = EventWriter(run_dir)
    w.emit("round_started", round=0)
    w.emit("action", round=0, agent_uid="agent_p", action_type="create_post",
           info={"content": "Oil prices will crash soon"})
    w.emit("action", round=0, agent_uid="agent_c1", action_type="like_post",
           info={"post_id": 1})
    w.emit("round_finished", round=0, actions_taken=2)
    w.emit("round_started", round=1)
    w.emit("action", round=1, agent_uid="agent_c1", action_type="create_post",
           info={"content": "Staying calm and optimistic"})
    w.emit("round_finished", round=1, actions_taken=1)
    w.emit("sim_finished")

    _make_post_db(run_dir / "reddit_simulation.db", [
        (1, 0, "Oil prices will crash soon", 5),
        (2, 1, "Staying calm and optimistic", 9),
    ])
    return p, run_dir


def _make_post_db(path, rows):
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE post (post_id INTEGER PRIMARY KEY, user_id INTEGER,"
        " content TEXT, created_at TEXT, num_likes INTEGER DEFAULT 0,"
        " num_dislikes INTEGER DEFAULT 0)"
    )
    conn.executemany(
        "INSERT INTO post (post_id, user_id, content, num_likes)"
        " VALUES (?,?,?,?)", rows,
    )
    conn.commit()
    conn.close()


# --- top_posts ---------------------------------------------------------------


def test_top_posts_orders_by_likes(run):
    _, run_dir = run
    posts = top_posts(run_dir / "reddit_simulation.db", limit=10)
    assert [p["post_id"] for p in posts] == [2, 1]
    assert posts[0]["num_likes"] == 9


def test_top_posts_missing_db_returns_empty(tmp_path):
    assert top_posts(tmp_path / "nope.db", limit=10) == []


def test_top_posts_missing_table_returns_empty(tmp_path):
    db = tmp_path / "empty.db"
    sqlite3.connect(db).close()
    assert top_posts(db, limit=10) == []


# --- generate_report ---------------------------------------------------------


def test_generate_report_writes_all_artifacts(store, run):
    p, run_dir = run
    llm = RoutedFakeLLM()
    meta = generate_report(store, p["id"], RUN_ID, llm)

    report_dir = run_dir / "report"
    assert (report_dir / "outline.json").exists()
    assert (report_dir / "section_00.md").exists()
    assert (report_dir / "section_01.md").exists()
    assert (report_dir / "section_02.md").exists()
    assert (report_dir / "audit.jsonl").exists()

    saved = json.loads((report_dir / "report.json").read_text(encoding="utf-8"))
    assert saved["run_id"] == RUN_ID
    assert saved["direction"]["answer"] == OUTLINE["direction"]["answer"]
    assert saved["direction"]["confidence"] == 0.7
    assert [s["status"] for s in saved["sections"]] == ["ok", "ok", "ok"]
    assert meta["sections"] == saved["sections"]

    full = (report_dir / "full_report.md").read_text(encoding="utf-8")
    assert "Will oil pass $95?" in full
    assert OUTLINE["direction"]["answer"] in full
    assert "Crowd reaction" in full
    assert GROUNDED_MD in full


def test_outline_prompt_carries_question_metrics_and_population(store, run):
    p, _ = run
    llm = RoutedFakeLLM()
    generate_report(store, p["id"], RUN_ID, llm)
    outline_prompt = llm.json_prompts[0]
    assert "Will oil pass $95?" in outline_prompt
    assert "Alice" in outline_prompt          # protagonist name
    assert "total actions" in outline_prompt.casefold()  # metrics digest


def test_section_prompt_carries_retrieved_context(store, run):
    p, _ = run
    llm = RoutedFakeLLM()
    generate_report(store, p["id"], RUN_ID, llm)
    section_prompt = llm.chat_prompts[0]
    assert "cara_c1" in section_prompt        # top post cited by username
    assert "alice_p" in section_prompt        # protagonist action sample
    assert "round" in section_prompt.casefold()  # per-round metrics rows
    assert "usernames" in section_prompt.casefold()  # mandatory-citation rule


def test_ungrounded_section_flagged_not_hidden(store, run):
    p, run_dir = run
    llm = RoutedFakeLLM(section_replies={
        "what the protagonists did": UNGROUNDED_MD,
    })
    meta = generate_report(store, p["id"], RUN_ID, llm)
    flags = {s["title"]: s["ungrounded"] for s in meta["sections"]}
    assert flags["Protagonist push"] is True
    assert flags["Crowd reaction"] is False
    # the section is still written and present in the full report
    assert (run_dir / "report" / "section_01.md").exists()
    assert UNGROUNDED_MD in (
        run_dir / "report" / "full_report.md"
    ).read_text(encoding="utf-8")


def test_failed_section_recorded_and_others_continue(store, run):
    p, run_dir = run
    llm = RoutedFakeLLM(section_replies={
        "sentiment over the rounds": RuntimeError("backend exploded"),
    })
    meta = generate_report(store, p["id"], RUN_ID, llm)
    statuses = [s["status"] for s in meta["sections"]]
    assert statuses == ["ok", "ok", "failed"]
    failed = meta["sections"][2]
    assert "backend exploded" in failed["error"]
    assert not (run_dir / "report" / "section_02.md").exists()
    # the failure is visible in the assembled report
    full = (run_dir / "report" / "full_report.md").read_text(encoding="utf-8")
    assert "Sentiment trend" in full
    assert "failed" in full.casefold()


def test_outline_failure_aborts(store, run):
    p, run_dir = run
    llm = RoutedFakeLLM(outline_error=RuntimeError("no outline for you"))
    with pytest.raises(Exception, match="no outline"):
        generate_report(store, p["id"], RUN_ID, llm)
    assert not (run_dir / "report" / "full_report.md").exists()


def test_outline_without_sections_aborts(store, run):
    p, _ = run
    llm = RoutedFakeLLM(outline={"sections": [], "direction": {}})
    with pytest.raises(ValueError, match="section"):
        generate_report(store, p["id"], RUN_ID, llm)


def test_outline_normalization_clamps_sections_and_confidence(store, run):
    p, _ = run
    outline = {
        "sections": [{"title": f"S{i}", "focus": f"f{i}"} for i in range(7)],
        "direction": {"answer": "maybe", "confidence": 3.2},
    }
    llm = RoutedFakeLLM(outline=outline)
    meta = generate_report(store, p["id"], RUN_ID, llm)
    assert len(meta["sections"]) == 5  # clamped to 3-5 contract max
    assert meta["direction"]["confidence"] == 1.0


def test_outline_nonnumeric_confidence_degrades_to_zero(store, run):
    p, _ = run
    outline = {
        "sections": OUTLINE["sections"],
        "direction": {"answer": "unclear", "confidence": "high"},
    }
    meta = generate_report(store, p["id"], RUN_ID, RoutedFakeLLM(outline=outline))
    assert meta["direction"]["confidence"] == 0.0


def test_audit_logs_every_llm_call_with_context(store, run):
    p, run_dir = run
    llm = RoutedFakeLLM(section_replies={
        "sentiment over the rounds": RuntimeError("boom"),
    })
    generate_report(store, p["id"], RUN_ID, llm)
    lines = [
        json.loads(line) for line in
        (run_dir / "report" / "audit.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    calls = [entry["call"] for entry in lines]
    assert calls == ["outline", "section_00", "section_01", "section_02"]
    assert all("messages" in entry for entry in lines)
    failed = lines[3]
    assert "boom" in failed["error"]
    ok = lines[1]
    assert ok["response"]  # successful calls log the raw response


def test_generate_report_unknown_run_raises(store, run):
    p, _ = run
    with pytest.raises(ValueError, match="unknown run"):
        generate_report(store, p["id"], "run_" + "f" * 12, RoutedFakeLLM())


def test_grounding_regex_not_fooled_by_around_background_ground():
    from app.services.report import _ROUND_RE

    for vague in ("Around 5 agents engaged", "the background 3 was noise",
                  "common ground 2 sides found"):
        assert not _ROUND_RE.search(vague), vague
    for grounded in ("in round 2", "Round #7 showed", "by round 12"):
        assert _ROUND_RE.search(grounded), grounded
