"""Report agent (spec Â§7): outline -> grounded sections -> audit trail.

Kept the ReACT shape of the reference (plan, then per-section work) but
with DETERMINISTIC retrieval â€” every section sees the same honest context:
top posts by engagement from the run db(s), the per-round metrics rows,
and protagonist action samples. Every LLM call is logged to
report/audit.jsonl together with the context it was shown. Sections that
cite no round number or username are flagged ``ungrounded`` in
report.json â€” visible, never silently accepted. Outline failure aborts
loudly; a per-section failure records that section as failed and the
report continues without it."""

import json
import logging
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from app.core.projects import ProjectStore
from app.services import runqueue
from app.services.metrics import compute_metrics
from app.services.worldstate import assemble_world_state, world_state_digest
from simworker.events import EventReader

logger = logging.getLogger(__name__)

REPORT_DIR = "report"
MAX_SECTIONS = 5  # outline contract: 3-5 sections; extras are dropped
TOP_POSTS_LIMIT = 10
PROTAGONIST_SAMPLES = 5

_CONTENT_ACTIONS = {"create_post", "create_comment", "quote_post"}

_OUTLINE_SYSTEM = (
    "You plan a report on a social-media simulation run. Given the "
    "operator's anchor question, the WORLD-STATE variables (the real "
    "trackable things the question is about — a chokepoint's status, a price, "
    "a bill or memorandum's state), the run metrics, and the population "
    "summary, reply with JSON: "
    '{"sections": [{"title": str, "focus": str (what the section should '
    'examine)}], "direction": {"answer": str (your directional answer to '
    'the anchor question), "confidence": 0..1}}. '
    "Ground the directional answer in the world-state variables PLUS what the "
    "agents argued. 3-5 sections. English only."
)

_SECTION_SYSTEM = (
    "You write ONE section of a simulation report in plain markdown (no "
    "JSON, no preamble, no heading â€” the title is added for you). Ground "
    "every claim in the context provided. MANDATORY: cite specific agent "
    "usernames and round numbers from the context (e.g. 'in round 2, "
    "alice_p posted ...'). If the context does not support a claim, say "
    "so instead of inventing evidence."
)


def top_posts(db_path: Path, limit: int = TOP_POSTS_LIMIT) -> list[dict]:
    """Top posts by num_likes from an OASIS run db (engagement ranking;
    same post table simworker.feed reads). Missing db/table -> []."""
    if not Path(db_path).exists():
        return []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT post_id, user_id, content, num_likes FROM post"
            " ORDER BY num_likes DESC, post_id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class _Audit:
    """Append-only log of every LLM call + the context it saw."""

    def __init__(self, path: Path):
        self._path = path
        self._path.write_text("", encoding="utf-8")  # fresh per generation

    def log(self, call: str, messages: list[dict], *,
            response: str | None = None, error: str | None = None) -> None:
        entry = {"ts": _now(), "call": call, "messages": messages}
        if response is not None:
            entry["response"] = response
        if error is not None:
            entry["error"] = error
        with self._path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")


# --- context assembly --------------------------------------------------------


def _metrics_digest(metrics: dict) -> str:
    lines = [
        f"Rounds observed: {metrics.get('rounds_observed', 0)}; "
        f"total actions: {metrics.get('total_actions', 0)}",
        f"Actions by type: {json.dumps(metrics.get('actions_by_type', {}))}",
        f"Actions by tier: {json.dumps(metrics.get('actions_by_tier', {}))}",
        f"Actions by faction: {json.dumps(metrics.get('actions_by_faction', {}))}",
        f"Sentiment by faction: {json.dumps(metrics.get('faction_sentiment', {}))}",
        f"Topic totals: {json.dumps(metrics.get('topic_totals', {}))}",
        "Sentiment trend (score = (pos-neg)/total): " + json.dumps(
            metrics.get("sentiment_trend", [])
        ),
        "Divergence (protagonist share of actions): " + json.dumps(
            metrics.get("divergence", [])
        ),
        f"Cascade: {json.dumps(metrics.get('cascade', {}))}",
    ]
    return "\n".join(lines)


def _per_round_rows(metrics: dict) -> str:
    rows = []
    for slot in metrics.get("per_round", []):
        s = slot.get("sentiment", {})
        rows.append(
            f"round {slot.get('round')}: {slot.get('actions', 0)} actions, "
            f"by_tier={json.dumps(slot.get('by_tier', {}))}, "
            f"sentiment +{s.get('positive', 0)}/-{s.get('negative', 0)}"
            f"/={s.get('neutral', 0)}, "
            f"topics={json.dumps(slot.get('topic_engagement', {}))}"
        )
    return "\n".join(rows) or "(no rounds observed)"


def _population_summary(population: dict) -> str:
    agents = population.get("agents", [])
    tiers: dict[str, int] = {}
    for a in agents:
        tier = a.get("tier", "crowd_policy")
        tiers[tier] = tiers.get(tier, 0) + 1
    protagonist_uids = set(population.get("protagonist_uids", []))
    names = [
        f"{a.get('name', '?')} (@{a.get('username', '?')})"
        for a in agents if a.get("agent_uid") in protagonist_uids
    ]
    return (
        f"{len(agents)} agents; tiers: {json.dumps(tiers)}; "
        f"protagonists: {', '.join(names) or 'none'}"
    )


def _username_by_position(run_dir: Path, population: dict) -> dict[int, str]:
    mapping = _load_json(run_dir / "export_mapping.json", {})
    uid_to_position = mapping.get("uid_to_position", {})
    username_by_uid = {
        a.get("agent_uid"): a.get("username", "")
        for a in population.get("agents", [])
    }
    return {
        pos: username_by_uid.get(uid) or f"user_{pos}"
        for uid, pos in uid_to_position.items()
        if isinstance(pos, int)
    }


def _top_posts_block(run_dir: Path, usernames: dict[int, str]) -> str:
    platform = _load_json(run_dir / "run.json", {}).get("platform", "")
    platforms = ("twitter", "reddit") if platform == "both" else (platform,)
    posts: list[dict] = []
    for p in platforms:
        posts.extend(top_posts(run_dir / f"{p}_simulation.db"))
    posts.sort(key=lambda r: (-int(r.get("num_likes") or 0), -r["post_id"]))
    lines = []
    for p in posts[:TOP_POSTS_LIMIT]:
        who = usernames.get(p["user_id"]) or f"user_{p['user_id']}"
        lines.append(
            f"- @{who} ({p.get('num_likes', 0)} likes): {p.get('content', '')}"
        )
    return "\n".join(lines) or "(no posts recorded)"


def _protagonist_samples(run_dir: Path, population: dict) -> str:
    protagonist_uids = set(population.get("protagonist_uids", []))
    username_by_uid = {
        a.get("agent_uid"): a.get("username", "")
        for a in population.get("agents", [])
    }
    samples = []
    for event in EventReader(run_dir).read_from(0):
        if event.get("kind") != "action":
            continue
        uid = event.get("agent_uid", "")
        if uid not in protagonist_uids:
            continue
        info = event.get("info") or {}
        content = info.get("content", "") if isinstance(info, dict) else ""
        detail = f": {content}" if content else ""
        samples.append(
            f"[round {event.get('round', 0)}] "
            f"@{username_by_uid.get(uid) or uid} "
            f"({event.get('action_type', '?')}){detail}"
        )
        if len(samples) >= PROTAGONIST_SAMPLES:
            break
    return "\n".join(samples) or "(no protagonist actions recorded)"


# --- outline -----------------------------------------------------------------


def _normalize_outline(raw: dict) -> tuple[list[dict], dict]:
    """Tolerant normalization of the outline payload. No sections at all
    is an abort (ValueError) â€” there is no report to write without a plan."""
    sections = []
    for item in raw.get("sections") or []:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if not title:
            continue
        focus = str(item.get("focus") or "").strip() or title
        sections.append({"title": title, "focus": focus})
    if not sections:
        raise ValueError("outline returned no usable sections")
    sections = sections[:MAX_SECTIONS]

    direction_raw = raw.get("direction")
    direction_raw = direction_raw if isinstance(direction_raw, dict) else {}
    try:
        confidence = float(direction_raw.get("confidence"))
    except (TypeError, ValueError):
        confidence = 0.0
    direction = {
        "answer": str(direction_raw.get("answer") or "unknown"),
        "confidence": min(max(confidence, 0.0), 1.0),
    }
    return sections, direction


# --- grounding ---------------------------------------------------------------

_ROUND_RE = re.compile(r"\bround\s*#?\s*\d+", re.IGNORECASE)


def _is_grounded(text: str, usernames: list[str]) -> bool:
    if _ROUND_RE.search(text):
        return True
    lowered = text.casefold()
    return any(u and u.casefold() in lowered for u in usernames)


# --- generation --------------------------------------------------------------


def generate_report(
    store: ProjectStore, project_id: str, run_id: str, llm
) -> dict:
    """Generate run_dir/report/ (outline.json, section_NN.md,
    full_report.md, audit.jsonl, report.json). Returns the report.json
    meta dict. Raises on unknown run or outline failure."""
    project = store.get(project_id)
    run_dir = runqueue.run_dir_for(store, project_id, run_id)
    if project is None or run_dir is None:
        raise ValueError(f"unknown run: {project_id}/{run_id}")
    question = project["question"]

    metrics = compute_metrics(run_dir)
    population = _load_json(run_dir / "population.json", {})
    # World-state variables come from the PROJECT graph (the strait, prices,
    # bills, the memorandum) — the measurable things the verdict grounds on
    # (the type->role overhaul's world-state half). Absent graph -> empty.
    graph = _load_json(store.project_dir(project_id) / "graph.json", {})
    world_state = world_state_digest(assemble_world_state(graph))
    report_dir = run_dir / REPORT_DIR
    report_dir.mkdir(exist_ok=True)
    audit = _Audit(report_dir / "audit.jsonl")

    # --- outline call (failure aborts, visibly) -----------------------------
    outline_messages = [
        {"role": "system", "content": _OUTLINE_SYSTEM},
        {"role": "user", "content": (
            f"ANCHOR QUESTION: {question}\n\n"
            f"WORLD STATE (measurable variables to ground the verdict on):\n"
            f"{world_state}\n\n"
            f"RUN METRICS:\n{_metrics_digest(metrics)}\n\n"
            f"POPULATION: {_population_summary(population)}"
        )},
    ]
    try:
        raw_outline = llm.chat_json(outline_messages, temperature=0.4)
    except Exception as e:
        audit.log("outline", outline_messages, error=str(e))
        raise
    audit.log(
        "outline", outline_messages,
        response=json.dumps(raw_outline, ensure_ascii=False),
    )
    sections, direction = _normalize_outline(raw_outline)
    (report_dir / "outline.json").write_text(
        json.dumps({"sections": sections, "direction": direction}, indent=2,
                   ensure_ascii=False),
        encoding="utf-8",
    )

    # --- shared deterministic retrieval --------------------------------------
    usernames = _username_by_position(run_dir, population)
    context = (
        f"WORLD STATE:\n{world_state}\n\n"
        f"TOP POSTS BY ENGAGEMENT:\n{_top_posts_block(run_dir, usernames)}\n\n"
        f"PER-ROUND METRICS:\n{_per_round_rows(metrics)}\n\n"
        f"PROTAGONIST ACTION SAMPLES:\n"
        f"{_protagonist_samples(run_dir, population)}"
    )
    all_usernames = [
        a.get("username", "") for a in population.get("agents", [])
    ]

    # --- per-section calls (failures recorded, generation continues) --------
    section_meta = []
    bodies: list[str | None] = []
    for i, section in enumerate(sections):
        call = f"section_{i:02d}"
        messages = [
            {"role": "system", "content": _SECTION_SYSTEM},
            {"role": "user", "content": (
                f"ANCHOR QUESTION: {question}\n"
                f"SECTION: {section['title']}\n"
                f"FOCUS: {section['focus']}\n\n{context}"
            )},
        ]
        meta = {
            "index": i, "title": section["title"], "focus": section["focus"],
            "status": "ok", "ungrounded": False,
            "file": f"{call}.md", "error": None,
        }
        try:
            body = llm.chat(messages, temperature=0.5)
        except Exception as e:
            logger.warning(f"report section {i} failed: {e}")
            audit.log(call, messages, error=str(e))
            meta.update(status="failed", file=None, error=str(e)[:300])
            bodies.append(None)
            section_meta.append(meta)
            continue
        audit.log(call, messages, response=body)
        (report_dir / f"{call}.md").write_text(body, encoding="utf-8")
        if not _is_grounded(body, all_usernames):
            meta["ungrounded"] = True
        bodies.append(body)
        section_meta.append(meta)

    # --- assembly ------------------------------------------------------------
    parts = [
        f"# Simulation Report: {question}",
        "",
        f"**Direction:** {direction['answer']} "
        f"(confidence {direction['confidence']:.2f})",
        "",
    ]
    for meta, body in zip(section_meta, bodies):
        parts.append(f"## {meta['title']}")
        parts.append("")
        if body is None:
            parts.append(f"_Section generation failed: {meta['error']}_")
        else:
            parts.append(body)
        parts.append("")
    (report_dir / "full_report.md").write_text(
        "\n".join(parts), encoding="utf-8"
    )

    report_meta = {
        "generated_at": _now(),
        "run_id": run_id,
        "question": question,
        "direction": direction,
        "sections": section_meta,
    }
    (report_dir / "report.json").write_text(
        json.dumps(report_meta, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return report_meta
