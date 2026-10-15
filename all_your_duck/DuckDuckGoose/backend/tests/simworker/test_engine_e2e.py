import asyncio
import json

import pytest

from simworker.events import EventReader


def _policy(uid):
    return {
        "agent_uid": uid,
        "stances": [{"topic": "oil", "position": "worried", "intensity": 0.9}],
        "reaction_rules": [
            {"on_topic": "oil", "stance_alignment": "any", "min_exposures": 1,
             "actions": [{"kind": "post", "weight": 0.5,
                          "template_pool": "p"},
                         {"kind": "like", "weight": 0.5,
                          "template_pool": None}]},
        ],
        "templates": {"p": ["Worried about {topic} tonight"]},
        "susceptibility": {"social_proof": 0.5, "authority": 0.5},
        "activity": {"base_rate": 1.0},
    }


@pytest.fixture
def run_dir(tmp_path):
    n = 6
    agents, reddit, mapping = [], [], {}
    (tmp_path / "policies").mkdir()
    for i in range(n):
        uid = f"agent_{i:016x}"
        mapping[uid] = i
        agents.append({"agent_uid": uid, "tier": "crowd_policy",
                       "activity_level": 1.0,
                       "active_hours": list(range(24))})
        reddit.append({"user_id": i, "username": f"u{i}", "realname": f"n{i}",
                       "bio": "b", "persona": "p", "age": 30,
                       "gender": "other", "mbti": "ISTJ", "country": "US"})
        (tmp_path / "policies" / f"{uid}.json").write_text(
            json.dumps(_policy(uid)), encoding="utf-8")
    (tmp_path / "reddit_profiles.json").write_text(
        json.dumps(reddit), encoding="utf-8")
    (tmp_path / "export_mapping.json").write_text(
        json.dumps({"uid_to_position": mapping}), encoding="utf-8")
    (tmp_path / "population.json").write_text(json.dumps({
        "agents": agents, "protagonist_uids": [],
        "follow_edges": [{"follower": f"agent_{1:016x}",
                          "followee": f"agent_{0:016x}"}],
    }), encoding="utf-8")
    (tmp_path / "run.json").write_text(json.dumps({
        "run_id": "run_e2e", "platform": "reddit", "rounds": 3, "seed": 7,
        "endpoints": {"protagonist": None, "crowd_llm": None},
        "time_dials": {"minutes_per_round": 30, "agents_per_round_min": 6,
                       "agents_per_round_max": 6, "peak_hours": [],
                       "off_peak_hours": [], "peak_multiplier": 1.0,
                       "off_peak_multiplier": 1.0},
        "initial_posts": [{"agent_uid": f"agent_{0:016x}",
                           "content": "BREAKING: oil supply cut announced"}],
        "cross_feed": False, "semaphore": 4, "wait_after": False,
    }), encoding="utf-8")
    return tmp_path


def test_e2e_reddit_policy_only_run(run_dir, monkeypatch):
    """Real OasisEnv, real sqlite, ZERO LLM calls (all crowd_policy)."""
    monkeypatch.chdir(run_dir)  # oasis writes ./log here
    from simworker.engine import run as engine_run

    asyncio.run(engine_run(run_dir))

    events = EventReader(run_dir).read_from(0)
    kinds = [e["kind"] for e in events]
    assert "worker_started" in kinds
    assert "sim_finished" in kinds
    actions = [e for e in events if e["kind"] == "action"]
    assert actions, "policy crowd produced no actions"
    assert all(e.get("agent_uid", "").startswith("agent_") for e in actions)

    import sqlite3
    db = run_dir / "reddit_simulation.db"
    assert db.exists()
    conn = sqlite3.connect(db)
    n_posts = conn.execute("SELECT COUNT(*) FROM post").fetchone()[0]
    conn.close()
    assert n_posts >= 2  # initial post + at least one policy post

    from simworker.ipc import read_heartbeat
    hb = read_heartbeat(run_dir)
    assert hb is not None and hb["round"] >= 2
