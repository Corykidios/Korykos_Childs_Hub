import json

import pytest

from app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    import app.core.config as config_mod

    monkeypatch.setattr(config_mod.Config, "PROJECTS_DIR", tmp_path / "projects")
    monkeypatch.setattr(config_mod.Config, "TASK_DB_PATH", tmp_path / "app.db")
    monkeypatch.setattr(config_mod.Config, "SETTINGS_FILE", tmp_path / "settings.json")
    application = create_app()
    application.config["TESTING"] = True
    return application.test_client()


def _make_project(client):
    r = client.post("/api/projects", json={"name": "t", "question": "q?"})
    return r.get_json()


def test_population_build_guards(client):
    p = _make_project(client)
    # no graph -> 409
    assert client.post(f"/api/projects/{p['id']}/population").status_code == 409
    # population not built -> 404
    assert client.get(f"/api/projects/{p['id']}/population").status_code == 404


def test_policy_endpoints(client, tmp_path, monkeypatch):
    p = _make_project(client)
    # no policy yet -> 404
    r = client.get(f"/api/projects/{p['id']}/agents/agent_x/policy")
    assert r.status_code == 404
    # PUT a valid policy -> readable back
    policy = {
        "stances": [{"topic": "t", "position": "pro", "intensity": 0.5}],
        "reaction_rules": [],
        "templates": {},
        "susceptibility": {"social_proof": 0.5, "authority": 0.5},
        "activity": {"base_rate": 0.2},
    }
    r = client.put(f"/api/projects/{p['id']}/agents/agent_x/policy", json=policy)
    assert r.status_code == 200
    got = client.get(f"/api/projects/{p['id']}/agents/agent_x/policy").get_json()
    assert got["agent_uid"] == "agent_x"
    assert got["stances"][0]["intensity"] == 0.5
    # invalid policy -> 400
    bad = dict(policy, stances=[{"topic": "t", "position": "p", "intensity": 9}])
    assert client.put(
        f"/api/projects/{p['id']}/agents/agent_x/policy", json=bad
    ).status_code == 400
