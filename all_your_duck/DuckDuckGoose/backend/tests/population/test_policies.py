import json

import pytest
from pydantic import ValidationError

from app.services.population.policies import (
    CompiledPolicy,
    generate_policy,
    load_policy,
    save_policy,
)


class FakeLLM:
    def __init__(self, payload=None, fail=False):
        self.payload = payload
        self.fail = fail
        self.calls = []

    def chat_json(self, messages, temperature=0.7):
        self.calls.append(messages)
        if self.fail:
            raise ValueError("nope")
        return self.payload


POLICY_PAYLOAD = {
    "stances": [
        {"topic": "oil prices", "position": "fears price spike", "intensity": 0.8}
    ],
    "reaction_rules": [
        {"on_topic": "oil prices", "stance_alignment": "agree",
         "min_exposures": 2,
         "actions": [
             {"kind": "repost", "weight": 0.5, "template_pool": None},
             {"kind": "post", "weight": 0.3, "template_pool": "worry"},
         ]}
    ],
    "templates": {"worry": ["Gas is already at {price}, this is getting bad",
                            "Filling up cost me {price} today. {topic} is real"]},
    "susceptibility": {"social_proof": 0.7, "authority": 0.4},
    "activity": {"base_rate": 0.35},
}

AGENT = {
    "agent_uid": "agent_0123456789abcdef", "kind": "public",
    "name": "worried investor 1", "username": "worried_1",
    "bio": "b", "persona": "Checks gas prices daily, distrusts officials",
    "age": 40, "gender": "male", "mbti": "ISTJ", "country": "United States",
    "profession": "retail investor", "interested_topics": ["oil"],
    "anchor_uuid": None, "source_entity_uuid": None, "persona_status": "ok",
}


def test_policy_schema_validates_good_payload():
    p = CompiledPolicy(agent_uid="agent_x", **POLICY_PAYLOAD)
    assert p.stances[0].intensity == 0.8
    assert p.reaction_rules[0].actions[0].kind == "repost"


def test_policy_schema_rejects_bad_action_kind():
    bad = json.loads(json.dumps(POLICY_PAYLOAD))
    bad["reaction_rules"][0]["actions"][0]["kind"] = "hack_the_planet"
    with pytest.raises(ValidationError):
        CompiledPolicy(agent_uid="agent_x", **bad)


def test_policy_schema_rejects_out_of_range_intensity():
    bad = json.loads(json.dumps(POLICY_PAYLOAD))
    bad["stances"][0]["intensity"] = 1.7
    with pytest.raises(ValidationError):
        CompiledPolicy(agent_uid="agent_x", **bad)


def test_generate_policy_includes_persona_and_question(tmp_path):
    llm = FakeLLM(POLICY_PAYLOAD)
    policy = generate_policy(AGENT, "Will oil pass $95?", ["oil prices"], llm)
    assert policy.agent_uid == AGENT["agent_uid"]
    sent = json.dumps(llm.calls[0])
    assert "Checks gas prices daily" in sent
    assert "Will oil pass $95?" in sent
    assert "oil prices" in sent


def test_generate_policy_failure_raises_visibly():
    with pytest.raises(ValueError):
        generate_policy(AGENT, "q", ["t"], FakeLLM(fail=True))


def test_save_and_load_roundtrip(tmp_path):
    policy = CompiledPolicy(agent_uid=AGENT["agent_uid"], **POLICY_PAYLOAD)
    save_policy(tmp_path, policy)
    loaded = load_policy(tmp_path, AGENT["agent_uid"])
    assert loaded == policy
    assert (tmp_path / f"{AGENT['agent_uid']}.json").exists()


def test_load_missing_returns_none(tmp_path):
    assert load_policy(tmp_path, "agent_missing") is None
