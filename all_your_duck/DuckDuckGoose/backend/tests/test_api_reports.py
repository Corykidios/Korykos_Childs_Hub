"""Reports API tests. The LLM is injected through the
app.api.reports._make_llm seam (no real endpoint is ever called); run dirs
come from the real POST /runs path with the queue cap at 0."""

import json
import time
from pathlib import Path

import pytest

import app.api.reports as reports_api
import app.core.config as config_mod
from app import create_app
from app.core.profiles import put_setting

from tests.test_report import OUTLINE, RoutedFakeLLM
from tests.test_runqueue import patch_config, write_population


@pytest.fixture
def client(tmp_path, monkeypatch):
    patch_config(monkeypatch, tmp_path)
    put_setting(tmp_path / "settings.json", "max_concurrent_runs", 0)
    application = create_app()
    application.config["TESTING"] = True
    return application.test_client()


def _bind_role(client, role, name):
    assert client.put("/api/settings/profiles", json={
        "name": name, "base_url": "http://localhost:1/v1",
        "api_key": "k", "model": f"{name}-model", "max_concurrency": 1,
    }).status_code == 200
    assert client.put("/api/settings/roles", json={
        "role": role, "profile": name,
    }).status_code == 200


def _ready_run(client):
    """Project + queued run dir (cap 0: never spawns a worker)."""
    p = client.post(
        "/api/projects", json={"name": "t", "question": "q?"}
    ).get_json()
    write_population(Path(config_mod.Config.PROJECTS_DIR) / p["id"])
    _bind_role(client, "protagonist_brain", "proto")
    r = client.post(
        f"/api/projects/{p['id']}/runs",
        json={"platform": "twitter", "rounds": 1, "seed": 7},
    )
    assert r.status_code == 202
    return p, r.get_json()["run_ids"][0]


def _poll_task(client, task_id, timeout=10.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        t = client.get(f"/api/tasks/{task_id}").get_json()
        if t["status"] in ("done", "failed"):
            return t
        time.sleep(0.05)
    pytest.fail("task did not finish")


# --- POST guards -------------------------------------------------------------


def test_post_report_unknown_project_404(client):
    r = client.post("/api/projects/proj_000000000000/runs/run_"
                    + "a" * 12 + "/report")
    assert r.status_code == 404


def test_post_report_unknown_run_404(client):
    p, _ = _ready_run(client)
    _bind_role(client, "report_writer", "writer")
    r = client.post(f"/api/projects/{p['id']}/runs/run_{'f' * 12}/report")
    assert r.status_code == 404


def test_post_report_no_writer_profile_409(client):
    p, run_id = _ready_run(client)
    r = client.post(f"/api/projects/{p['id']}/runs/{run_id}/report")
    assert r.status_code == 409
    assert "report_writer" in r.get_json()["error"]


# --- POST happy path / failure -----------------------------------------------


def test_post_report_generates_in_background(client, monkeypatch):
    p, run_id = _ready_run(client)
    _bind_role(client, "report_writer", "writer")
    monkeypatch.setattr(
        reports_api, "_make_llm", lambda profile: RoutedFakeLLM()
    )

    r = client.post(f"/api/projects/{p['id']}/runs/{run_id}/report")
    assert r.status_code == 202
    task = _poll_task(client, r.get_json()["task_id"])
    assert task["status"] == "done"
    assert "3 sections" in task["message"]

    got = client.get(f"/api/projects/{p['id']}/runs/{run_id}/report")
    assert got.status_code == 200
    body = got.get_json()
    assert OUTLINE["direction"]["answer"] in body["report"]
    assert [s["status"] for s in body["meta"]["sections"]] == ["ok"] * 3


def test_post_report_outline_failure_fails_task(client, monkeypatch):
    p, run_id = _ready_run(client)
    _bind_role(client, "report_writer", "writer")
    monkeypatch.setattr(
        reports_api, "_make_llm",
        lambda profile: RoutedFakeLLM(outline_error=RuntimeError("llm down")),
    )
    r = client.post(f"/api/projects/{p['id']}/runs/{run_id}/report")
    task = _poll_task(client, r.get_json()["task_id"])
    assert task["status"] == "failed"
    assert "llm down" in task["message"]


# --- GET ---------------------------------------------------------------------


def test_get_report_before_generation_404(client):
    p, run_id = _ready_run(client)
    r = client.get(f"/api/projects/{p['id']}/runs/{run_id}/report")
    assert r.status_code == 404


def test_get_report_unknown_run_404(client):
    p, _ = _ready_run(client)
    assert client.get(
        f"/api/projects/{p['id']}/runs/run_{'f' * 12}/report"
    ).status_code == 404
    assert client.get(
        "/api/projects/proj_000000000000/runs/run_" + "a" * 12 + "/report"
    ).status_code == 404
