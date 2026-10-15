"""Runs API: the Run screen's backend.

Every runs route calls promote() — the UI polls these endpoints
constantly, so polling IS the queue scheduler (honest v1 simplification;
no background promoter thread). POST promotes right after enqueuing, the
read/control routes promote on entry.
"""

import json
import logging
import os
import time
import uuid
from pathlib import Path

from flask import Blueprint, jsonify, request

from app.core.config import Config
from app.core.profiles import ProfileStore, get_setting
from app.core.projects import ProjectStore
from app.services import runqueue
from app.services.feed import build_feed
from app.services.network import build_network
from app.services.llm_client import LLMClient
from app.services.metrics import compute_metrics
from app.services import transcripts
from app.services.personachat import chat_with_agent
from simworker.events import EventReader
from simworker.ipc import CommandClient, read_heartbeat

logger = logging.getLogger(__name__)
bp = Blueprint("runs", __name__, url_prefix="/api")

PLATFORMS = ("twitter", "reddit", "both")
EVENTS_PAGE_CAP = 500
INTERVIEW_TIMEOUT_SECONDS = 90.0  # ceiling, not a fixed wait — fast answers
# return immediately; this only gives slow V4-Flash/OpenRouter calls headroom
# to finish instead of 504-ing at 30s. Tests shrink this.
_INTERVIEW_POLL_SECONDS = 0.2


def _projects() -> ProjectStore:
    return ProjectStore(Config.PROJECTS_DIR)


def _make_llm(profile) -> LLMClient:
    """Seam: tests substitute a fake LLM here."""
    return LLMClient(profile)


def _read_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _promote(store: ProjectStore) -> None:
    cap = get_setting(Config.SETTINGS_FILE, "max_concurrent_runs", 1)
    try:
        cap = int(cap)
    except (TypeError, ValueError):
        cap = 1
    runqueue.promote(store, cap)


@bp.post("/projects/<project_id>/runs")
def create_runs(project_id: str):
    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    if not (store.project_dir(project_id) / "population.json").exists():
        return jsonify({"error": "population not built"}), 409
    if ProfileStore(Config.SETTINGS_FILE).resolve_role(
        "protagonist_brain"
    ) is None:
        return jsonify(
            {"error": "no protagonist_brain profile bound in settings"}
        ), 409

    body = request.get_json(force=True) or {}
    platform = body.get("platform")
    if platform not in PLATFORMS:
        return jsonify({"error": "platform must be twitter|reddit|both"}), 400
    rounds = body.get("rounds")
    if not isinstance(rounds, int) or isinstance(rounds, bool) or rounds < 1:
        return jsonify({"error": "rounds must be an int >= 1"}), 400
    variants = body.get("variants", 1)
    if not isinstance(variants, int) or isinstance(variants, bool) \
            or variants < 1:
        return jsonify({"error": "variants must be an int >= 1"}), 400

    batch_id = "batch_" + uuid.uuid4().hex[:12]
    base_seed = body.get("seed")
    if base_seed is None:
        base_seed = int.from_bytes(os.urandom(4), "big")
    run_ids = []
    try:
        for i in range(variants):
            run_dir = runqueue.prepare_run(store, project_id, {
                "platform": platform,
                "rounds": rounds,
                "tiered": bool(body.get("tiered", True)),
                "seed": int(base_seed) + i,  # variants diverge by seed
                "batch_id": batch_id,
                "initial_posts": body.get("initial_posts") or [],
                "cross_feed": bool(body.get("cross_feed", False)),
                "time_dials": body.get("time_dials"),
            })
            run_ids.append(run_dir.name)
    except ValueError as e:  # pydantic ValidationError is a ValueError
        return jsonify({"error": str(e)[:300]}), 400
    _promote(store)
    return jsonify({"run_ids": run_ids, "batch_id": batch_id}), 202


@bp.get("/projects/<project_id>/runs")
def list_runs(project_id: str):
    store = _projects()
    _promote(store)
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    runs = []
    runs_root = store.project_dir(project_id) / "runs"
    if runs_root.is_dir():
        for run_dir in sorted(runs_root.iterdir()):
            if not runqueue.is_valid_run_id(run_dir.name):
                continue
            state = runqueue.read_state(run_dir)
            if state is not None:
                runs.append({"run_id": run_dir.name, **state})
    runs.sort(key=lambda r: (r.get("created_at", ""), r["run_id"]))
    return jsonify({"runs": runs})


def _run_dir_or_none(store: ProjectStore, project_id: str, run_id: str):
    if store.get(project_id) is None:
        return None
    return runqueue.run_dir_for(store, project_id, run_id)


@bp.get("/projects/<project_id>/runs/<run_id>")
def get_run(project_id: str, run_id: str):
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    state = runqueue.read_state(run_dir) or {}
    events = EventReader(run_dir).read_from(0)
    return jsonify({
        "run_id": run_id,
        **state,
        "heartbeat": read_heartbeat(run_dir),
        "last_seq": events[-1]["seq"] if events else -1,
    })


@bp.get("/projects/<project_id>/runs/<run_id>/events")
def get_run_events(project_id: str, run_id: str):
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    try:
        after = int(request.args.get("after", -1))
    except ValueError:
        return jsonify({"error": "after must be an integer seq"}), 400
    events = EventReader(run_dir).read_from(after + 1)[:EVENTS_PAGE_CAP]
    return jsonify({"events": events})


@bp.get("/projects/<project_id>/runs/<run_id>/metrics")
def get_run_metrics(project_id: str, run_id: str):
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    return jsonify(compute_metrics(run_dir))


@bp.get("/projects/<project_id>/runs/<run_id>/feed")
def get_run_feed(project_id: str, run_id: str):
    """Threaded story feed: posts with their nested
    comments, each tagged with the round it was authored in and a resolved
    author card (name/tier/faction). The whole feed is small (hundreds of
    nodes) and cached, so it ships in one payload; the StoryFeedView reveals
    it round by round client-side."""
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    return jsonify(build_feed(run_dir))


@bp.get("/projects/<project_id>/runs/<run_id>/highlights")
def get_run_highlights(project_id: str, run_id: str):
    """Top posts by engagement, with resolved author cards (real names) — the
    evidence quotes for the answer-first verdict panel. Reuses the cached feed;
    comments are stripped (these are standalone quotes, not threads)."""
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    try:
        limit = int(request.args.get("limit", 3))
    except ValueError:
        return jsonify({"error": "limit must be an integer"}), 400
    limit = max(1, min(limit, 20))
    posts = build_feed(run_dir).get("posts", [])
    posts = sorted(
        posts,
        key=lambda p: (-(p.get("score") or 0), -(p.get("post_id") or 0)),
    )
    highlights = [
        {
            "post_id": p["post_id"],
            "round": p.get("round"),
            "score": p.get("score"),
            "num_likes": p.get("num_likes"),
            "content": p.get("content"),
            "author": p.get("author"),
        }
        for p in posts[:limit]
    ]
    return jsonify({"highlights": highlights})


@bp.get("/projects/<project_id>/runs/<run_id>/narrative")
def get_run_narrative(project_id: str, run_id: str):
    """Optional richer narrative: a polished dek plus prose story-beats.

    Read from narrative.json in the run directory if something has written one.
    Absent -> {}, so the UI degrades to the deterministic story beats rather
    than failing.
    """
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    return jsonify(_read_json(run_dir / "narrative.json", {}))


@bp.get("/projects/<project_id>/runs/<run_id>/network")
def get_run_network(project_id: str, run_id: str):
    """Reply network ("who talked to whom"): directed commenter→post-author
    edges + engagement-weighted nodes, capped (protagonists first) for a legible
    graph. Computed from the cached feed."""
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    try:
        max_nodes = int(request.args.get("max_nodes", 36))
    except ValueError:
        return jsonify({"error": "max_nodes must be an integer"}), 400
    return jsonify(build_network(run_dir, max_nodes=max(2, min(max_nodes, 80))))


@bp.post("/projects/<project_id>/runs/<run_id>/stop")
def stop_run(project_id: str, run_id: str):
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    state = runqueue.stop_run(run_dir)
    return jsonify({"run_id": run_id, **state})


def _save_turn(run_dir, agent_uid, question, response, mode):
    """Best-effort Talk transcript persistence — never breaks/blocks the
    response. Skips failed OR empty answers so junk turns (e.g. an interview
    that completed with an empty string) never pollute the saved history."""
    if isinstance(response, dict):
        if response.get("status") == "failed":
            return
        answer = (response.get("result") or {}).get("response")
    else:
        answer = response
    if not (isinstance(answer, str) and answer.strip()):
        return  # nothing meaningful to persist
    try:
        transcripts.append_turn(run_dir, agent_uid, question, answer, mode)
    except Exception:
        logger.warning("failed to persist %s transcript", mode, exc_info=True)


@bp.post("/projects/<project_id>/runs/<run_id>/agents/<agent_uid>/chat")
def chat_agent(project_id: str, run_id: str, agent_uid: str):
    """Post-hoc persona chat: works after the worker is gone —
    the persona is rebuilt from run artifacts, answered by the
    protagonist_brain profile."""
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    profile = ProfileStore(Config.SETTINGS_FILE).resolve_role(
        "protagonist_brain"
    )
    if profile is None:
        return jsonify(
            {"error": "no protagonist_brain profile bound in settings"}
        ), 409
    body = request.get_json(force=True) or {}
    message = (body.get("message") or "").strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    history = body.get("history") or []
    if not isinstance(history, list):
        return jsonify({"error": "history must be a list of turns"}), 400
    try:
        reply = chat_with_agent(
            store, project_id, run_id, agent_uid, message, history,
            _make_llm(profile),
        )
    except ValueError as e:
        return jsonify({"error": str(e)[:300]}), 404
    except Exception as e:
        logger.exception("persona chat failed")
        return jsonify({"error": str(e)[:300]}), 502
    _save_turn(run_dir, agent_uid, message, reply, "chat")
    return jsonify({"reply": reply})


@bp.get("/projects/<project_id>/batches/<batch_id>")
def get_batch(project_id: str, batch_id: str):
    """Variant batch comparison: one row per run sharing the
    batch_id, assembled from state.json + metrics.json + report.json on
    disk. Missing pieces read as nulls, never errors."""
    store = _projects()
    _promote(store)
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    runs = []
    runs_root = store.project_dir(project_id) / "runs"
    if runs_root.is_dir():
        for run_dir in sorted(runs_root.iterdir()):
            if not runqueue.is_valid_run_id(run_dir.name):
                continue
            state = runqueue.read_state(run_dir)
            if state is None or state.get("batch_id") != batch_id:
                continue
            run_config = _read_json(run_dir / "run.json", {})
            metrics = _read_json(run_dir / "metrics.json", {})
            report = _read_json(run_dir / "report" / "report.json", {})
            trend = metrics.get("sentiment_trend") or []
            last = trend[-1] if trend and isinstance(trend[-1], dict) else {}
            runs.append({
                "run_id": run_dir.name,
                "status": state.get("status"),
                "seed": run_config.get("seed"),
                "metrics_summary": {
                    "total_actions": metrics.get("total_actions"),
                    "final_sentiment_score": last.get("score"),
                    "agents_engaged": (
                        metrics.get("cascade") or {}
                    ).get("agents_engaged"),
                    "direction": report.get("direction"),
                },
            })
    return jsonify({"runs": runs})


@bp.post("/projects/<project_id>/runs/<run_id>/interview")
def interview(project_id: str, run_id: str):
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    body = request.get_json(force=True) or {}
    agent_uid = (body.get("agent_uid") or "").strip()
    prompt = (body.get("prompt") or "").strip()
    if not agent_uid or not prompt:
        return jsonify({"error": "agent_uid and prompt are required"}), 400
    args = {"agent_uid": agent_uid, "prompt": prompt}
    if body.get("platform"):
        args["platform"] = body["platform"]

    client = CommandClient(run_dir)
    command_id = client.send("interview", args)
    deadline = time.monotonic() + INTERVIEW_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        response = client.read_response(command_id)
        if response is not None:
            _save_turn(run_dir, agent_uid, prompt, response, "interview")
            return jsonify(response)
        time.sleep(_INTERVIEW_POLL_SECONDS)
    return jsonify(
        {"error": "interview timed out", "command_id": command_id}
    ), 504


@bp.get("/projects/<project_id>/runs/<run_id>/agents/<agent_uid>/transcript")
def get_transcript(project_id: str, run_id: str, agent_uid: str):
    """Saved interview + chat turns for an agent — Talk Q&A persists across
    agent switches, reloads, and re-opening the project later."""
    store = _projects()
    _promote(store)
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    return jsonify({"turns": transcripts.read_turns(run_dir, agent_uid)})
