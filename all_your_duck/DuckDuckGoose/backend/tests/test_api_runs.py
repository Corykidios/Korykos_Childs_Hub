"""Runs API tests. No real OASIS worker: tests that need
a live process substitute the fake worker via the runqueue._worker_argv
seam; the interview round-trip is answered by an in-process CommandServer
thread (the success path of CommandClient.send/read_response is already
covered by the IPC tests)."""

import json
import threading
import time
from pathlib import Path

import pytest

import app.api.runs as runs_api
import app.core.config as config_mod
from app import create_app
from app.core.profiles import put_setting
from app.services import runqueue
from simworker.events import EventWriter
from simworker.ipc import CommandServer, write_heartbeat

from tests.test_runqueue import (
    PROTO_UID,
    fake_worker_argv,
    patch_config,
    wait_for,
    write_population,
)


@pytest.fixture
def client(tmp_path, monkeypatch):
    patch_config(monkeypatch, tmp_path)
    # Cap 0 by default so promote() never spawns a real worker; tests that
    # want promotion raise the cap AND monkeypatch the fake-worker seam.
    put_setting(tmp_path / "settings.json", "max_concurrent_runs", 0)
    application = create_app()
    application.config["TESTING"] = True
    return application.test_client()


@pytest.fixture(autouse=True)
def kill_leftover_workers():
    yield
    import subprocess
    for pid, proc in list(runqueue._POPENS.items()):
        if proc.poll() is None:
            proc.kill()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
        runqueue._POPENS.pop(pid, None)


def _make_project(client):
    return client.post(
        "/api/projects", json={"name": "t", "question": "q?"}
    ).get_json()


def _bind_protagonist(client):
    assert client.put("/api/settings/profiles", json={
        "name": "proto", "base_url": "http://localhost:1/v1",
        "api_key": "k", "model": "proto-model", "max_concurrency": 1,
    }).status_code == 200
    assert client.put("/api/settings/roles", json={
        "role": "protagonist_brain", "profile": "proto",
    }).status_code == 200


def _ready_project(client):
    """Project with a population on disk and a bound protagonist profile."""
    p = _make_project(client)
    write_population(Path(config_mod.Config.PROJECTS_DIR) / p["id"])
    _bind_protagonist(client)
    return p


def _post_run(client, project_id, **overrides):
    body = {"platform": "twitter", "rounds": 1, "seed": 7}
    body.update(overrides)
    return client.post(f"/api/projects/{project_id}/runs", json=body)


def _run_dir(project_id, run_id) -> Path:
    return Path(config_mod.Config.PROJECTS_DIR) / project_id / "runs" / run_id


# --- POST /runs guards -----------------------------------------------------


def test_post_runs_unknown_project_404(client):
    r = _post_run(client, "proj_000000000000")
    assert r.status_code == 404


def test_post_runs_population_not_built_409(client):
    p = _make_project(client)
    _bind_protagonist(client)
    r = _post_run(client, p["id"])
    assert r.status_code == 409
    assert "population" in r.get_json()["error"]


def test_post_runs_no_protagonist_profile_409(client):
    p = _make_project(client)
    write_population(Path(config_mod.Config.PROJECTS_DIR) / p["id"])
    r = _post_run(client, p["id"])
    assert r.status_code == 409
    assert "protagonist" in r.get_json()["error"]


def test_post_runs_validation_400(client):
    p = _ready_project(client)
    assert _post_run(client, p["id"], platform="myspace").status_code == 400
    assert _post_run(client, p["id"], rounds=0).status_code == 400
    assert _post_run(client, p["id"], variants=0).status_code == 400


# --- POST /runs batches ----------------------------------------------------


def test_post_runs_variants_share_batch_id(client):
    p = _ready_project(client)
    r = _post_run(client, p["id"], variants=3, seed=100)
    assert r.status_code == 202
    body = r.get_json()
    assert len(body["run_ids"]) == 3
    assert len(set(body["run_ids"])) == 3
    assert body["batch_id"].startswith("batch_")

    seeds = set()
    for run_id in body["run_ids"]:
        run_dir = _run_dir(p["id"], run_id)
        state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
        assert state["status"] == "queued"  # cap 0: nothing started
        assert state["batch_id"] == body["batch_id"]
        seeds.add(json.loads(
            (run_dir / "run.json").read_text(encoding="utf-8"))["seed"])
    assert seeds == {100, 101, 102}  # variants get distinct seeds


# --- GET list/detail -------------------------------------------------------


def test_get_runs_lists_states(client):
    assert client.get("/api/projects/proj_000000000000/runs").status_code == 404
    p = _ready_project(client)
    posted = _post_run(client, p["id"], variants=2).get_json()
    runs = client.get(f"/api/projects/{p['id']}/runs").get_json()["runs"]
    assert {r["run_id"] for r in runs} == set(posted["run_ids"])
    assert all(r["status"] == "queued" for r in runs)
    assert all(r["batch_id"] == posted["batch_id"] for r in runs)


def test_runs_routes_promote_queued_first(client, tmp_path, monkeypatch):
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    assert client.get(
        f"/api/projects/{p['id']}/runs/{run_id}"
    ).get_json()["status"] == "queued"

    put_setting(tmp_path / "settings.json", "max_concurrent_runs", 1)
    run = client.get(f"/api/projects/{p['id']}/runs").get_json()["runs"][0]
    assert run["status"] == "running"
    assert run["pid"] > 0


def test_get_run_detail_state_heartbeat_last_seq(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    run_dir = _run_dir(p["id"], run_id)
    write_heartbeat(run_dir, round_num=5)
    writer = EventWriter(run_dir)
    writer.emit("worker_started", run_id=run_id)
    writer.emit("round_started", round=0)

    body = client.get(f"/api/projects/{p['id']}/runs/{run_id}").get_json()
    assert body["run_id"] == run_id
    assert body["status"] == "queued"
    assert body["batch_id"].startswith("batch_")
    assert body["heartbeat"]["round"] == 5
    assert body["last_seq"] == 1


def test_get_run_detail_without_events_or_heartbeat(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    body = client.get(f"/api/projects/{p['id']}/runs/{run_id}").get_json()
    assert body["heartbeat"] is None
    assert body["last_seq"] == -1


def test_run_routes_unknown_and_traversal_404(client):
    p = _ready_project(client)
    probes = ("run_" + "f" * 12, "run_zzzzzzzzzzzz",
              "..%2F..%2Fsecrets", "....", "run_..%2F..%2Fx")
    for run_id in probes:
        base = f"/api/projects/{p['id']}/runs/{run_id}"
        assert client.get(base).status_code == 404, run_id
        assert client.get(f"{base}/events").status_code == 404, run_id
        assert client.get(f"{base}/feed").status_code == 404, run_id
        assert client.post(f"{base}/stop").status_code == 404, run_id
        assert client.post(
            f"{base}/interview", json={"agent_uid": "a", "prompt": "p"}
        ).status_code == 404, run_id
        assert client.post(
            f"{base}/agents/agent_x/chat", json={"message": "m"}
        ).status_code == 404, run_id
    assert client.get(
        "/api/projects/proj_000000000000/runs/run_" + "a" * 12
    ).status_code == 404


# --- GET /events -----------------------------------------------------------


def test_events_endpoint_slicing_and_cap(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    writer = EventWriter(_run_dir(p["id"], run_id))
    for i in range(503):
        writer.emit("action", n=i)
    base = f"/api/projects/{p['id']}/runs/{run_id}/events"

    events = client.get(f"{base}?after=499").get_json()["events"]
    assert [e["seq"] for e in events] == [500, 501, 502]

    events = client.get(base).get_json()["events"]  # default: from the start
    assert len(events) == 500  # page cap
    assert events[0]["seq"] == 0 and events[-1]["seq"] == 499

    assert client.get(f"{base}?after=502").get_json()["events"] == []
    assert client.get(f"{base}?after=notanint").status_code == 400


# --- GET /metrics ----------------------------------------------------------


def test_metrics_endpoint_counts_actions(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    writer = EventWriter(_run_dir(p["id"], run_id))
    writer.emit("round_started", round=0)
    writer.emit("action", round=0, agent_uid="agent_x",
                action_type="create_post", info={"content": "hello"})
    writer.emit("action", round=0, agent_uid="agent_y",
                action_type="like_post", info={"post_id": 1})
    writer.emit("round_finished", round=0, actions_taken=2)

    r = client.get(f"/api/projects/{p['id']}/runs/{run_id}/metrics")
    assert r.status_code == 200
    body = r.get_json()
    assert body["total_actions"] == 2
    assert body["rounds_observed"] == 1


def test_metrics_endpoint_unknown_run_404(client):
    p = _ready_project(client)
    r = client.get(f"/api/projects/{p['id']}/runs/run_{'f' * 12}/metrics")
    assert r.status_code == 404
    assert client.get(
        "/api/projects/proj_000000000000/runs/run_" + "a" * 12 + "/metrics"
    ).status_code == 404


# --- GET /feed -------------------------------------------------------------


def _write_feed_artifacts(run_dir):
    """A minimal threaded reddit run: 1 post (round 0) + 1 comment (round 1)."""
    import sqlite3

    (run_dir / "run.json").write_text(json.dumps({
        "run_id": run_dir.name, "platform": "reddit", "rounds": 2,
    }), encoding="utf-8")
    (run_dir / "population.json").write_text(json.dumps({
        "protagonist_uids": ["agent_a"],
        "agents": [
            {"agent_uid": "agent_a", "tier": "protagonist",
             "name": "Ada", "username": "ada_a", "faction": "pro-reopening"},
            {"agent_uid": "agent_b", "tier": "crowd_llm",
             "name": "Ben", "username": "ben_b", "faction": "neutral"},
        ],
    }), encoding="utf-8")
    (run_dir / "export_mapping.json").write_text(json.dumps({
        "uid_to_position": {"agent_a": 0, "agent_b": 1},
    }), encoding="utf-8")
    w = EventWriter(run_dir)
    w.emit("round_started", round=0)
    w.emit("action", round=0, agent_uid="agent_a", action_type="create_post",
           info={"content": "Opening move.", "post_id": 1})
    w.emit("round_finished", round=0, actions_taken=1)
    w.emit("round_started", round=1)
    w.emit("action", round=1, agent_uid="agent_b",
           action_type="create_comment",
           info={"content": "I reply.", "comment_id": 1})
    w.emit("round_finished", round=1, actions_taken=1)

    conn = sqlite3.connect(run_dir / "reddit_simulation.db")
    conn.execute(
        "CREATE TABLE post (post_id INTEGER PRIMARY KEY, user_id INTEGER,"
        " content TEXT, num_likes INTEGER DEFAULT 0,"
        " num_dislikes INTEGER DEFAULT 0)"
    )
    conn.execute(
        "CREATE TABLE comment (comment_id INTEGER PRIMARY KEY, post_id INTEGER,"
        " user_id INTEGER, content TEXT, num_likes INTEGER DEFAULT 0,"
        " num_dislikes INTEGER DEFAULT 0)"
    )
    conn.execute("INSERT INTO post VALUES (1, 0, 'Opening move.', 4, 0)")
    conn.execute("INSERT INTO comment VALUES (1, 1, 1, 'I reply.', 1, 0)")
    conn.commit()
    conn.close()


def test_feed_endpoint_returns_threaded_posts(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    _write_feed_artifacts(_run_dir(p["id"], run_id))

    r = client.get(f"/api/projects/{p['id']}/runs/{run_id}/feed")
    assert r.status_code == 200
    body = r.get_json()
    assert body["platform"] == "reddit"
    assert body["max_round"] == 1
    assert len(body["posts"]) == 1
    post = body["posts"][0]
    assert post["post_id"] == 1
    assert post["author"]["username"] == "ada_a"
    assert post["author"]["protagonist"] is True
    assert [c["comment_id"] for c in post["comments"]] == [1]
    assert post["comments"][0]["author"]["username"] == "ben_b"


def test_feed_endpoint_unknown_run_404(client):
    p = _ready_project(client)
    r = client.get(f"/api/projects/{p['id']}/runs/run_{'f' * 12}/feed")
    assert r.status_code == 404
    assert client.get(
        "/api/projects/proj_000000000000/runs/run_" + "a" * 12 + "/feed"
    ).status_code == 404


# --- GET /highlights -------------------------------------------------------


def test_highlights_endpoint_returns_top_posts_by_score(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    _write_feed_artifacts(_run_dir(p["id"], run_id))

    r = client.get(f"/api/projects/{p['id']}/runs/{run_id}/highlights?limit=2")
    assert r.status_code == 200
    hl = r.get_json()["highlights"]
    assert len(hl) >= 1
    top = hl[0]
    assert top["post_id"] == 1
    assert top["author"]["name"] == "Ada"  # real name, resolved
    assert "comments" not in top  # quotes are stripped of their threads
    assert top["score"] == 4


def test_highlights_endpoint_unknown_run_404(client):
    p = _ready_project(client)
    assert client.get(
        f"/api/projects/{p['id']}/runs/run_{'f' * 12}/highlights"
    ).status_code == 404


# --- GET /network ----------------------------------------------------------


def test_network_endpoint_returns_nodes_and_edges(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    _write_feed_artifacts(_run_dir(p["id"], run_id))  # agent_b comments on agent_a's post

    r = client.get(f"/api/projects/{p['id']}/runs/{run_id}/network")
    assert r.status_code == 200
    net = r.get_json()
    assert {n["agent_uid"] for n in net["nodes"]} >= {"agent_a", "agent_b"}
    assert any(
        e["source"] == "agent_b" and e["target"] == "agent_a" for e in net["edges"]
    )


def test_network_endpoint_unknown_run_404(client):
    p = _ready_project(client)
    assert client.get(
        f"/api/projects/{p['id']}/runs/run_{'f' * 12}/network"
    ).status_code == 404


# --- GET /narrative --------------------------------------------------------


def test_narrative_endpoint_serves_file_or_empty(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    base = f"/api/projects/{p['id']}/runs/{run_id}/narrative"
    # absent -> {} (graceful degrade)
    assert client.get(base).get_json() == {}
    # present -> served
    (_run_dir(p["id"], run_id) / "narrative.json").write_text(
        json.dumps({"dek": "A subhead.", "story_beats": [{"round": 1, "text": "x"}]}),
        encoding="utf-8",
    )
    body = client.get(base).get_json()
    assert body["dek"] == "A subhead."
    assert client.get(
        f"/api/projects/{p['id']}/runs/run_{'f' * 12}/narrative"
    ).status_code == 404


# --- POST /stop ------------------------------------------------------------


def test_stop_endpoint_marks_stopped(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    r = client.post(f"/api/projects/{p['id']}/runs/{run_id}/stop")
    assert r.status_code == 200
    assert r.get_json()["status"] == "stopped"
    detail = client.get(f"/api/projects/{p['id']}/runs/{run_id}").get_json()
    assert detail["status"] == "stopped"


# --- POST /interview -------------------------------------------------------


def test_interview_round_trip(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    run_dir = _run_dir(p["id"], run_id)

    def responder():
        server = CommandServer(run_dir)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            cmd = server.poll()
            if cmd is not None:
                server.respond(
                    cmd["command_id"], "completed",
                    result={"agent_uid": cmd["args"]["agent_uid"],
                            "response": "hi there"},
                )
                return
            time.sleep(0.05)

    thread = threading.Thread(target=responder, daemon=True)
    thread.start()
    r = client.post(
        f"/api/projects/{p['id']}/runs/{run_id}/interview",
        json={"agent_uid": "agent_x", "prompt": "hello?"},
    )
    thread.join(timeout=10)
    assert r.status_code == 200
    body = r.get_json()
    assert body["status"] == "completed"
    assert body["result"]["response"] == "hi there"


def test_interview_timeout_504(client, monkeypatch):
    monkeypatch.setattr(runs_api, "INTERVIEW_TIMEOUT_SECONDS", 0.3)
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    r = client.post(
        f"/api/projects/{p['id']}/runs/{run_id}/interview",
        json={"agent_uid": "agent_x", "prompt": "hello?"},
    )
    assert r.status_code == 504


def test_interview_missing_fields_400(client):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    r = client.post(
        f"/api/projects/{p['id']}/runs/{run_id}/interview", json={}
    )
    assert r.status_code == 400


# --- POST /agents/<uid>/chat -------------------------------------------------


class _FakeChatLLM:
    def __init__(self, reply="hello from alice"):
        self.reply = reply
        self.messages = None

    def chat(self, messages, temperature=0.7, json_mode=False):
        self.messages = messages
        return self.reply


def test_chat_round_trip_with_injected_llm(client, monkeypatch):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    fake = _FakeChatLLM()
    monkeypatch.setattr(runs_api, "_make_llm", lambda profile: fake)
    r = client.post(
        f"/api/projects/{p['id']}/runs/{run_id}/agents/{PROTO_UID}/chat",
        json={"message": "how do you feel?",
              "history": [{"role": "user", "content": "hi"},
                          {"role": "assistant", "content": "hello"}]},
    )
    assert r.status_code == 200
    assert r.get_json()["reply"] == "hello from alice"
    assert "Alice" in fake.messages[0]["content"]  # persona system prompt
    assert fake.messages[1] == {"role": "user", "content": "hi"}
    assert fake.messages[-1] == {"role": "user", "content": "how do you feel?"}


def test_chat_missing_message_400(client, monkeypatch):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    monkeypatch.setattr(runs_api, "_make_llm", lambda profile: _FakeChatLLM())
    base = f"/api/projects/{p['id']}/runs/{run_id}/agents/{PROTO_UID}/chat"
    assert client.post(base, json={}).status_code == 400
    assert client.post(base, json={"message": "  "}).status_code == 400
    assert client.post(
        base, json={"message": "m", "history": "bad"}
    ).status_code == 400


def test_chat_unknown_agent_404(client, monkeypatch):
    p = _ready_project(client)
    run_id = _post_run(client, p["id"]).get_json()["run_ids"][0]
    monkeypatch.setattr(runs_api, "_make_llm", lambda profile: _FakeChatLLM())
    r = client.post(
        f"/api/projects/{p['id']}/runs/{run_id}/agents/agent_nope/chat",
        json={"message": "hi"},
    )
    assert r.status_code == 404
    assert "agent" in r.get_json()["error"]


def test_chat_no_protagonist_profile_409(client):
    p = _make_project(client)
    project_dir = Path(config_mod.Config.PROJECTS_DIR) / p["id"]
    write_population(project_dir)
    run_id = "run_" + "b" * 12
    run_dir = project_dir / "runs" / run_id
    run_dir.mkdir(parents=True)
    (run_dir / "state.json").write_text(
        json.dumps({"status": "queued", "batch_id": "batch_x",
                    "created_at": "2026-06-10T00:00:00+00:00"}),
        encoding="utf-8",
    )
    r = client.post(
        f"/api/projects/{p['id']}/runs/{run_id}/agents/{PROTO_UID}/chat",
        json={"message": "hi"},
    )
    assert r.status_code == 409
    assert "protagonist" in r.get_json()["error"]


# --- GET /batches/<batch_id> -------------------------------------------------


def test_batch_comparison_aggregates_run_summaries(client):
    p = _ready_project(client)
    body = _post_run(client, p["id"], variants=2, seed=100).get_json()
    batch_id = body["batch_id"]
    run_a, run_b = body["run_ids"]
    dir_a = _run_dir(p["id"], run_a)
    (dir_a / "metrics.json").write_text(json.dumps({
        "total_actions": 5,
        "sentiment_trend": [{"round": 0, "score": -0.5},
                            {"round": 1, "score": 0.25}],
        "cascade": {"agents_engaged": 3, "engaged_share": 1.0,
                    "first_round_half_engaged": 0},
    }), encoding="utf-8")
    (dir_a / "report").mkdir()
    (dir_a / "report" / "report.json").write_text(json.dumps({
        "direction": {"answer": "yes", "confidence": 0.7},
    }), encoding="utf-8")

    r = client.get(f"/api/projects/{p['id']}/batches/{batch_id}")
    assert r.status_code == 200
    runs = {x["run_id"]: x for x in r.get_json()["runs"]}
    assert set(runs) == {run_a, run_b}
    assert {runs[run_a]["seed"], runs[run_b]["seed"]} == {100, 101}

    a = runs[run_a]
    assert a["status"] == "queued"
    assert a["metrics_summary"]["total_actions"] == 5
    assert a["metrics_summary"]["final_sentiment_score"] == 0.25
    assert a["metrics_summary"]["agents_engaged"] == 3
    assert a["metrics_summary"]["direction"]["answer"] == "yes"

    b = runs[run_b]  # no metrics/report yet -> nulls, never errors
    assert b["metrics_summary"] == {
        "total_actions": None, "final_sentiment_score": None,
        "agents_engaged": None, "direction": None,
    }


def test_batch_unknown_project_404_and_unknown_batch_empty(client):
    assert client.get(
        "/api/projects/proj_000000000000/batches/batch_x"
    ).status_code == 404
    p = _ready_project(client)
    r = client.get(f"/api/projects/{p['id']}/batches/batch_nonexistent")
    assert r.status_code == 200
    assert r.get_json()["runs"] == []
