import pytest

from app import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    import app.core.config as config_mod
    monkeypatch.setattr(config_mod.Config, "SETTINGS_FILE", tmp_path / "settings.json")
    application = create_app()
    application.config["TESTING"] = True
    return application.test_client()


PROFILE = {
    "name": "ollama-local",
    "base_url": "http://localhost:11434/v1",
    "api_key": "ollama",
    "model": "gemma3:4b",
    "max_concurrency": 2,
}


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"


def test_profile_crud_roundtrip(client):
    assert client.put("/api/settings/profiles", json=PROFILE).status_code == 200
    listed = client.get("/api/settings/profiles").get_json()
    assert [p["name"] for p in listed["profiles"]] == ["ollama-local"]

    r = client.put(
        "/api/settings/roles", json={"role": "builder", "profile": "ollama-local"}
    )
    assert r.status_code == 200
    assert client.get("/api/settings/profiles").get_json()["roles"] == {
        "builder": "ollama-local"
    }

    assert client.delete("/api/settings/profiles/ollama-local").status_code == 200
    after = client.get("/api/settings/profiles").get_json()
    assert after["profiles"] == [] and after["roles"] == {}


def test_invalid_profile_400(client):
    bad = dict(PROFILE, max_concurrency=0)
    assert client.put("/api/settings/profiles", json=bad).status_code == 400


def test_bind_unknown_profile_404(client):
    r = client.put(
        "/api/settings/roles", json={"role": "builder", "profile": "ghost"}
    )
    assert r.status_code == 404


def test_connection_test_unreachable_endpoint(client):
    client.put("/api/settings/profiles", json=dict(PROFILE, base_url="http://127.0.0.1:9/v1"))
    r = client.post("/api/settings/profiles/ollama-local/test")
    body = r.get_json()
    assert r.status_code == 200
    assert body["ok"] is False
    assert body["error"]
