"""Population build + inspection API: the Universe screen's backend."""

import logging
import threading

from flask import Blueprint, jsonify, request

from app.core.config import Config
from app.core.profiles import ProfileStore
from app.core.projects import ProjectStore
from app.core.taskstore import TaskStore
from app.services.llm_client import LLMClient
from app.services.population.builder import build_population
from app.services.population.policies import (
    CompiledPolicy,
    load_policy,
    save_policy,
)

logger = logging.getLogger(__name__)
bp = Blueprint("population", __name__, url_prefix="/api")

DIAL_DEFAULTS = {
    "n_total": 100, "k_protagonists": 7, "retinue_ratio": 0.3,
    "tiered": True, "crowd_llm_ratio": 0.2, "agent_min_mentions": 2,
}


def _projects() -> ProjectStore:
    return ProjectStore(Config.PROJECTS_DIR)


@bp.post("/projects/<project_id>/population")
def build(project_id: str):
    store = _projects()
    project = store.get(project_id)
    if project is None:
        return jsonify({"error": "unknown project"}), 404
    if not (store.project_dir(project_id) / "graph.json").exists():
        return jsonify({"error": "graph not built"}), 409
    profile = ProfileStore(Config.SETTINGS_FILE).resolve_role("builder")
    if profile is None:
        return jsonify({"error": "no builder profile bound in settings"}), 409

    body = request.get_json(force=True) or {}
    dials = {**DIAL_DEFAULTS, **{k: body[k] for k in DIAL_DEFAULTS if k in body}}
    override = body.get("protagonist_override")

    tasks = TaskStore(Config.TASK_DB_PATH)
    task = tasks.create(kind="population", payload={"project_id": project_id})

    def work(task_id: str = task["id"]):
        ts = TaskStore(Config.TASK_DB_PATH)
        try:
            ts.update(task_id, status="running", message="building population")
            pop = build_population(
                store, project_id, LLMClient(profile), dials,
                protagonist_override=override,
            )
            ts.update(
                task_id, status="done", progress=1.0,
                message=(
                    f"{len(pop['agents'])} agents, "
                    f"{len(pop['persona_failures'])} persona failures, "
                    f"{len(pop['policy_failures'])} policy failures"
                ),
            )
        except Exception as e:
            logger.exception("population build failed")
            ts.update(task_id, status="failed", message=str(e)[:300])

    threading.Thread(target=work, daemon=True).start()
    return jsonify({"task_id": task["id"], "dials": dials}), 202


@bp.get("/projects/<project_id>/population")
def get_population(project_id: str):
    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    path = store.project_dir(project_id) / "population.json"
    if not path.exists():
        return jsonify({"error": "population not built"}), 404
    import json as _json
    return jsonify(_json.loads(path.read_text(encoding="utf-8")))


@bp.get("/projects/<project_id>/agents/<agent_uid>/policy")
def get_policy(project_id: str, agent_uid: str):
    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    policy = load_policy(store.project_dir(project_id) / "policies", agent_uid)
    if policy is None:
        return jsonify({"error": "no policy for agent"}), 404
    return jsonify(policy.model_dump())


@bp.put("/projects/<project_id>/agents/<agent_uid>/policy")
def put_policy(project_id: str, agent_uid: str):
    from pydantic import ValidationError

    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    data = request.get_json(force=True) or {}
    data["agent_uid"] = agent_uid
    try:
        policy = CompiledPolicy(**data)
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 400
    save_policy(store.project_dir(project_id) / "policies", policy)
    return jsonify({"ok": True})
