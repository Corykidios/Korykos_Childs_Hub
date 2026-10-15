import pytest

from app.services.population.personas import (
    REDDIT_DEFAULTS,
    entity_agent,
    public_agents_from_archetypes,
    retinue_agent,
)


class FakeLLM:
    def __init__(self, payload=None, fail=False):
        self.payload = payload or {}
        self.fail = fail
        self.calls = []

    def chat_json(self, messages, temperature=0.7):
        self.calls.append(messages)
        if self.fail:
            raise ValueError("unsalvageable")
        return self.payload


PERSONA = {
    "bio": "Russian president since 2012",
    "persona": "Calculated, nationalist, uses state media...",
    "age": 71, "gender": "male", "mbti": "INTJ", "country": "Russia",
    "profession": "Head of state", "interested_topics": ["oil", "geopolitics"],
}

ENTITY = {
    "uuid": "ent_a", "canonical_name": "Vladimir Putin", "type": "Person",
    "summary": "Russian president", "doc_ids": ["d1", "d2"],
    "mention_count": 9, "aliases": ["Putin"], "influence": 11,
    "mentions": [{"name": "Putin", "summary": "leader", "doc_id": "d1",
                  "chunk_index": 0, "type": "Person"}],
}


def test_entity_agent_grounded_and_deterministic():
    llm = FakeLLM(PERSONA)
    a1 = entity_agent("proj_x", ENTITY, "Will oil pass $95?", llm)
    a2 = entity_agent("proj_x", ENTITY, "Will oil pass $95?", FakeLLM(PERSONA))
    assert a1["agent_uid"] == a2["agent_uid"]
    assert a1["agent_uid"].startswith("agent_")
    assert a1["kind"] == "entity"
    assert a1["source_entity_uuid"] == "ent_a"
    assert a1["name"] == "Vladimir Putin"
    assert a1["age"] == 71 and a1["country"] == "Russia"
    assert a1["persona_status"] == "ok"
    # evidence + question reached the prompt
    import json
    sent = json.dumps(llm.calls[0])
    assert "Russian president" in sent and "Will oil pass $95?" in sent


def test_entity_agent_failure_is_visible_not_faked():
    a = entity_agent("proj_x", ENTITY, "q", FakeLLM(fail=True))
    assert a["persona_status"] == "failed"
    assert a["bio"] == "" and a["persona"] == ""
    # reddit-required fields still present (defaults)
    for field, default in REDDIT_DEFAULTS.items():
        assert a[field] == default


def test_entity_agent_fills_missing_reddit_fields_with_defaults():
    partial = {k: v for k, v in PERSONA.items() if k not in ("age", "mbti")}
    a = entity_agent("proj_x", ENTITY, "q", FakeLLM(partial))
    assert a["age"] == REDDIT_DEFAULTS["age"]
    assert a["mbti"] == REDDIT_DEFAULTS["mbti"]
    assert a["gender"] == "male"  # provided value kept


def test_entity_agent_captures_faction_and_defaults_unaligned():
    # the stance label the persona call emits becomes structural agent data
    a = entity_agent("proj_x", ENTITY, "q",
                     FakeLLM({**PERSONA, "faction": "hardline-closure"}))
    assert a["faction"] == "hardline-closure"
    # absent faction (or failed persona) falls back to a neutral default
    b = entity_agent("proj_x", ENTITY, "q", FakeLLM(PERSONA))
    assert b["faction"] == "unaligned"
    assert entity_agent("proj_x", ENTITY, "q",
                        FakeLLM(fail=True))["faction"] == "unaligned"


def test_public_agents_inherit_faction_from_archetype():
    archetypes = [
        {"label": "anxious commuter", "persona": "Watches pump prices...",
         "interested_topics": ["oil"], "share": 1.0, "faction": "pro-reopening"},
    ]
    agents = public_agents_from_archetypes("proj_x", archetypes, 3)
    assert all(a["faction"] == "pro-reopening" for a in agents)
    # archetype without a faction -> the public slice defaults to "public"
    plain = public_agents_from_archetypes(
        "proj_x", [{"label": "x", "persona": "y", "share": 1.0}], 2
    )
    assert all(a["faction"] == "public" for a in plain)


def test_retinue_agent_anchored():
    a = retinue_agent("proj_x", ENTITY, 3, "q", FakeLLM(PERSONA))
    assert a["kind"] == "retinue"
    assert a["anchor_uuid"] == "ent_a"
    assert a["agent_uid"] != retinue_agent(
        "proj_x", ENTITY, 4, "q", FakeLLM(PERSONA)
    )["agent_uid"]  # index in seed key


def test_public_agents_instantiate_archetypes_to_exact_count():
    archetypes = [
        {"label": "worried retail investor", "persona": "Checks gas prices...",
         "interested_topics": ["oil"], "share": 0.7},
        {"label": "energy journalist follower", "persona": "Reads Reuters...",
         "interested_topics": ["media"], "share": 0.3},
    ]
    agents = public_agents_from_archetypes("proj_x", archetypes, 7)
    assert len(agents) == 7
    assert len({a["agent_uid"] for a in agents}) == 7
    assert all(a["kind"] == "public" and a["persona_status"] == "ok"
               for a in agents)
    # variation: usernames unique, persona carries the archetype text
    assert len({a["username"] for a in agents}) == 7
    labels = {a["profession"] for a in agents}
    assert "worried retail investor" in labels
