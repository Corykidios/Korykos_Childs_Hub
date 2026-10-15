import csv
import json

import pytest

from app.core.projects import ProjectStore
from app.services.population.export import export_population


def _agent(uid, name, tier="crowd_policy", topics=None):
    return {
        "agent_uid": uid, "kind": "public", "name": name,
        "username": f"u_{uid[-4:]}", "bio": f"bio {name}",
        "persona": f"persona {name}", "age": 30, "gender": "female",
        "mbti": "ENFP", "country": "France", "profession": "p",
        "interested_topics": topics or [], "anchor_uuid": None,
        "source_entity_uuid": None, "persona_status": "ok", "tier": tier,
    }


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


@pytest.fixture
def project_with_population(store):
    p = store.create(name="t", question="q")
    population = {
        "agents": [
            _agent("agent_aaaaaaaaaaaaaaaa", "Alice", tier="protagonist"),
            _agent("agent_bbbbbbbbbbbbbbbb", "Bob"),
            _agent("agent_cccccccccccccccc", "Cara"),
        ],
        "follow_edges": [
            {"follower": "agent_bbbbbbbbbbbbbbbb",
             "followee": "agent_aaaaaaaaaaaaaaaa"},
            {"follower": "agent_cccccccccccccccc",
             "followee": "agent_aaaaaaaaaaaaaaaa"},
        ],
        "protagonist_uids": ["agent_aaaaaaaaaaaaaaaa"],
        "dials": {}, "key_topics": [],
        "persona_failures": [], "policy_failures": [],
    }
    (store.project_dir(p["id"]) / "population.json").write_text(
        json.dumps(population), encoding="utf-8"
    )
    return p


def test_twitter_csv_format_and_follow_positions(store, project_with_population):
    p = project_with_population
    out = export_population(store, p["id"], platform="twitter")
    mapping = out["uid_to_position"]
    assert mapping["agent_aaaaaaaaaaaaaaaa"] == 0

    with (store.project_dir(p["id"]) / "twitter_profiles.csv").open(
        encoding="utf-8", newline=""
    ) as f:
        rows = list(csv.DictReader(f))
    assert [r["user_id"] for r in rows] == ["0", "1", "2"]
    assert rows[0]["username"] == "u_aaaa"
    assert "persona Alice" in rows[0]["user_char"]
    # Bob (row 1) follows Alice (position 0)
    assert json.loads(rows[1]["following_agentid_list"]) == [0]
    assert json.loads(rows[1]["previous_tweets"]) == []


def test_reddit_json_required_fields(store, project_with_population):
    p = project_with_population
    export_population(store, p["id"], platform="reddit")
    data = json.loads(
        (store.project_dir(p["id"]) / "reddit_profiles.json").read_text(
            encoding="utf-8")
    )
    assert len(data) == 3
    for i, item in enumerate(data):
        assert item["user_id"] == i
        for field in ("username", "realname", "bio", "persona",
                      "age", "gender", "mbti", "country"):
            assert field in item and item[field] not in (None, "")


def test_mapping_persisted_and_stable(store, project_with_population):
    p = project_with_population
    a = export_population(store, p["id"], platform="twitter")["uid_to_position"]
    b = export_population(store, p["id"], platform="reddit")["uid_to_position"]
    assert a == b  # position mapping identical across platforms
    saved = json.loads(
        (store.project_dir(p["id"]) / "export_mapping.json").read_text(
            encoding="utf-8")
    )
    assert saved["uid_to_position"] == {k: v for k, v in a.items()}


def test_export_requires_population(store):
    p = store.create(name="t", question="q")
    with pytest.raises(ValueError):
        export_population(store, p["id"], platform="twitter")
