"""Reports API: the Results screen's backend. Generation runs on a
daemon thread with progress in the persistent TaskStore (same pattern as
the population build)."""

import json
import logging
import threading

from flask import Blueprint, jsonify

from app.core.config import Config
from app.core.profiles import ProfileStore
from app.core.projects import ProjectStore
from app.core.taskstore import TaskStore
from app.services import runqueue
from app.services.llm_client import LLMClient
from app.services.report import REPORT_DIR, generate_report

logger = logging.getLogger(__name__)
bp = Blueprint("reports", __name__, url_prefix="/api")


def _projects() -> ProjectStore:
    return ProjectStore(Config.PROJECTS_DIR)


def _make_llm(profile) -> LLMClient:
    """Seam: tests substitute a fake LLM here."""
    return LLMClient(profile)


def _run_dir_or_none(store: ProjectStore, project_id: str, run_id: str):
    if store.get(project_id) is None:
        return None
    return runqueue.run_dir_for(store, project_id, run_id)


@bp.post("/projects/<project_id>/runs/<run_id>/report")
def post_report(project_id: str, run_id: str):
    store = _projects()
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    profile = ProfileStore(Config.SETTINGS_FILE).resolve_role("report_writer")
    if profile is None:
        return jsonify(
            {"error": "no report_writer profile bound in settings"}
        ), 409

    tasks = TaskStore(Config.TASK_DB_PATH)
    task = tasks.create(
        kind="report", payload={"project_id": project_id, "run_id": run_id}
    )

    def work(task_id: str = task["id"]):
        ts = TaskStore(Config.TASK_DB_PATH)
        try:
            ts.update(task_id, status="running", message="generating report")
            meta = generate_report(
                store, project_id, run_id, _make_llm(profile)
            )
            sections = meta["sections"]
            failed = sum(1 for s in sections if s["status"] == "failed")
            ungrounded = sum(1 for s in sections if s.get("ungrounded"))
            ts.update(
                task_id, status="done", progress=1.0,
                message=(
                    f"{len(sections)} sections, {failed} failed, "
                    f"{ungrounded} ungrounded"
                ),
            )
        except Exception as e:
            logger.exception("report generation failed")
            ts.update(task_id, status="failed", message=str(e)[:300])

    threading.Thread(target=work, daemon=True).start()
    return jsonify({"task_id": task["id"]}), 202


@bp.get("/projects/<project_id>/runs/<run_id>/report")
def get_report(project_id: str, run_id: str):
    store = _projects()
    run_dir = _run_dir_or_none(store, project_id, run_id)
    if run_dir is None:
        return jsonify({"error": "unknown run"}), 404
    report_dir = run_dir / REPORT_DIR
    full = report_dir / "full_report.md"
    meta = report_dir / "report.json"
    if not full.exists() or not meta.exists():
        return jsonify({"error": "report not generated"}), 404
    return jsonify({
        "report": full.read_text(encoding="utf-8"),
        "meta": json.loads(meta.read_text(encoding="utf-8")),
    })
