import io
import time

import pytest

from app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    import app.core.config as config_mod
    from app.services.memory import chroma_client

    monkeypatch.setattr(config_mod.Config, "PROJECTS_DIR", tmp_path / "projects")
    monkeypatch.setattr(config_mod.Config, "TASK_DB_PATH", tmp_path / "app.db")
    monkeypatch.setattr(config_mod.Config, "CHROMA_DATA_DIR", tmp_path / "chroma")
    monkeypatch.setattr(config_mod.Config, "SETTINGS_FILE", tmp_path / "settings.json")
    chroma_client.reset_singletons()
    application = create_app()
    application.config["TESTING"] = True
    yield application.test_client()
    chroma_client.reset_singletons()


def _make_project(client):
    r = client.post("/api/projects", json={"name": "t", "question": "q?"})
    assert r.status_code == 201
    return r.get_json()


def test_create_and_list_projects(client):
    p = _make_project(client)
    assert p["name"] == "t" and p["question"] == "q?"
    listed = client.get("/api/projects").get_json()
    assert [x["id"] for x in listed["projects"]] == [p["id"]]


def test_get_project_404(client):
    assert client.get("/api/projects/proj_nope").status_code == 404


def test_create_project_requires_name_and_question(client):
    assert client.post("/api/projects", json={"name": "x"}).status_code == 400


def test_upload_docs_multipart(client):
    p = _make_project(client)
    data = {
        "files": [
            (io.BytesIO(b"# A\n[[X]] body " * 50), "a.md"),
            (io.BytesIO(b"plain body " * 50), "b.txt"),
        ]
    }
    r = client.post(
        f"/api/projects/{p['id']}/docs",
        data=data,
        content_type="multipart/form-data",
    )
    assert r.status_code == 200
    body = r.get_json()
    assert body["added"] == 2
    docs = client.get(f"/api/projects/{p['id']}").get_json()["docs"]
    assert len(docs) == 2
    assert all(d["status"] == "indexed" for d in docs.values())


def test_register_folder_validates_path(client):
    p = _make_project(client)
    r = client.post(
        f"/api/projects/{p['id']}/folders", json={"path": "Z:/not/here"}
    )
    assert r.status_code == 400


def test_rescan_runs_as_background_task(client, tmp_path):
    vault = tmp_path / "vault"
    vault.mkdir()
    (vault / "n.md").write_text("# News\nOPEC cut " * 60, encoding="utf-8")

    p = _make_project(client)
    assert client.post(
        f"/api/projects/{p['id']}/folders", json={"path": str(vault)}
    ).status_code == 200

    r = client.post(f"/api/projects/{p['id']}/rescan")
    assert r.status_code == 202
    task_id = r.get_json()["task_id"]

    for _ in range(100):
        t = client.get(f"/api/tasks/{task_id}").get_json()
        if t["status"] in ("done", "failed"):
            break
        time.sleep(0.1)
    assert t["status"] == "done"
    docs = client.get(f"/api/projects/{p['id']}").get_json()["docs"]
    assert len(docs) == 1 and list(docs.values())[0]["status"] == "indexed"


def test_traversal_project_ids_404(client):
    # Reviewer-discovered Windows traversal probes must all be 404 now.
    for probe in ("..", "%2e%2e", "..%5C..", "proj_..%5C.."):
        r = client.get(f"/api/projects/{probe}")
        assert r.status_code == 404, probe
    r = client.post("/api/projects/..%5C../docs", data={}, content_type="multipart/form-data")
    assert r.status_code == 404


def test_ontology_endpoints_roundtrip(client):
    p = _make_project(client)
    # no builder profile bound -> 409
    assert client.post(f"/api/projects/{p['id']}/ontology").status_code == 409
    # manual edit works without any LLM
    body = {
        "entity_types": [{"name": "Person", "description": ""}],
        "edge_types": [{"name": "KNOWS", "description": ""}],
    }
    r = client.put(f"/api/projects/{p['id']}/ontology", json=body)
    assert r.status_code == 200
    got = client.get(f"/api/projects/{p['id']}/ontology").get_json()
    assert got["entity_types"][0]["name"] == "Person"


def test_extract_endpoint_guards(client):
    p = _make_project(client)
    # no ontology -> 409
    assert client.post(f"/api/projects/{p['id']}/extract").status_code == 409
    # graph not built -> 404
    assert client.get(f"/api/projects/{p['id']}/graph").status_code == 404


def test_extract_done_message_reports_failed_batches(client, monkeypatch):
    """Aggregated extraction failures are VISIBLE in
    the /extract task done-message, not buried in per-doc files."""
    import app.services.llm_client as llm_mod

    p = _make_project(client)
    assert client.put("/api/settings/profiles", json={
        "name": "builder", "base_url": "http://localhost:1/v1",
        "api_key": "k", "model": "b-model", "max_concurrency": 1,
    }).status_code == 200
    assert client.put("/api/settings/roles", json={
        "role": "builder", "profile": "builder",
    }).status_code == 200

    data = {"files": [(io.BytesIO(b"OPEC cut supply " * 40), "a.md")]}
    assert client.post(
        f"/api/projects/{p['id']}/docs", data=data,
        content_type="multipart/form-data",
    ).status_code == 200
    assert client.put(f"/api/projects/{p['id']}/ontology", json={
        "entity_types": [{"name": "Organization", "description": ""}],
        "edge_types": [{"name": "RELATED", "description": ""}],
    }).status_code == 200

    class FailingLLM:  # every extraction batch fails
        def __init__(self, profile):
            pass

        def chat_json(self, messages, temperature=0.7):
            raise RuntimeError("builder endpoint down")

    monkeypatch.setattr(llm_mod, "LLMClient", FailingLLM)

    r = client.post(f"/api/projects/{p['id']}/extract")
    assert r.status_code == 202
    task_id = r.get_json()["task_id"]
    for _ in range(100):
        t = client.get(f"/api/tasks/{task_id}").get_json()
        if t["status"] in ("done", "failed"):
            break
        time.sleep(0.1)
    assert t["status"] == "done"
    assert t["message"] == "0 entities, 0 edges, 1/1 batches failed"
