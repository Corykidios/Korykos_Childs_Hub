import csv
import json

import pytest

from simworker.graphbuild import build_agent_graph
from simworker.runconfig import RunConfig

from tests.simworker.test_runconfig import GOOD


def _write_run_dir(tmp_path, n=4, tiers=("protagonist", "crowd_llm",
                                          "crowd_policy", "crowd_policy")):
    agents, mapping = [], {}
    reddit = []
    for i in range(n):
        uid = f"agent_{i:016x}"
        mapping[uid] = i
        agents.append({"agent_uid": uid, "tier": tiers[i],
                       "activity_level": 1.0,
                       "active_hours": list(range(24))})
        reddit.append({"user_id": i, "username": f"u{i}", "realname": f"n{i}",
                       "bio": f"bio{i}", "persona": f"persona{i}", "age": 30,
                       "gender": "other", "mbti": "ISTJ", "country": "US"})
    (tmp_path / "reddit_profiles.json").write_text(
        json.dumps(reddit), encoding="utf-8")
    (tmp_path / "export_mapping.json").write_text(
        json.dumps({"uid_to_position": mapping}), encoding="utf-8")
    (tmp_path / "population.json").write_text(
        json.dumps({"agents": agents, "protagonist_uids": [agents[0]["agent_uid"]],
                    "follow_edges": []}), encoding="utf-8")
    cfg = RunConfig(**{**GOOD, "endpoints": {
        "protagonist": {"base_url": "http://localhost:1/v1", "api_key": "a",
                        "model": "proto-model", "max_concurrency": 1},
        "crowd_llm": {"base_url": "http://localhost:1/v1", "api_key": "b",
                      "model": "crowd-model", "max_concurrency": 1},
    }})
    return cfg


def test_builds_graph_with_per_tier_backends(tmp_path):
    cfg = _write_run_dir(tmp_path)
    graph, by_position, uid_to_position = build_agent_graph(
        "reddit", tmp_path, cfg
    )
    assert len(by_position) == 4
    proto = by_position[0]
    crowd_llm = by_position[1]
    policy_a, policy_b = by_position[2], by_position[3]
    # one backend object per tier; identity proves sharing + separation.
    # VERIFIED (camel chat_agent.py:463-471): ChatAgent wraps the passed
    # BaseModelBackend in a per-agent ModelManager stored at .model_backend;
    # the identity-preserved backend we passed lives at .model_backend.models[0]
    # (chat_agent.py:601-603 returns pre-instantiated backends as-is).
    proto_backend = proto.model_backend.models[0]
    assert crowd_llm.model_backend.models[0] is not proto_backend
    assert policy_a.model_backend.models[0] is policy_b.model_backend.models[0]
    # agent ids align with export positions
    assert proto.social_agent_id == 0


def test_reddit_userinfo_carries_required_demographics(tmp_path):
    cfg = _write_run_dir(tmp_path)
    _, by_position, _ = build_agent_graph("reddit", tmp_path, cfg)
    info = by_position[2].user_info
    other = info.profile["other_info"]
    for key in ("user_profile", "mbti", "gender", "age", "country"):
        assert key in other and other[key] not in (None, "")
    assert info.user_name == "u2"


def test_null_crowd_endpoint_policy_agents_still_constructible(tmp_path):
    cfg = _write_run_dir(tmp_path)
    cfg = cfg.model_copy(update={
        "endpoints": cfg.endpoints.model_copy(update={"crowd_llm": None})
    })
    _, by_position, _ = build_agent_graph("reddit", tmp_path, cfg)
    assert by_position[3].model_backend is not None
