import random

import pytest

from simworker.brains.policy import PolicyAgentState, decide

POLICY = {
    "agent_uid": "agent_x",
    "stances": [{"topic": "oil prices", "position": "worried", "intensity": 0.8}],
    "reaction_rules": [
        {"on_topic": "oil prices", "stance_alignment": "any",
         "min_exposures": 2,
         "actions": [{"kind": "post", "weight": 1.0, "template_pool": "worry"}]},
    ],
    "templates": {"worry": ["So worried about {topic} right now"]},
    "susceptibility": {"social_proof": 0.5, "authority": 0.5},
    "activity": {"base_rate": 1.0},
}

FEED_MATCH = [
    {"post_id": 11, "content": "Oil prices are spiking after the OPEC cut"},
    {"post_id": 12, "content": "cute cat pictures"},
]


def test_no_action_below_min_exposures():
    state = PolicyAgentState()
    action = decide(POLICY, state, FEED_MATCH, random.Random(1))
    assert action is None  # one exposure < min_exposures=2
    assert state.exposures["oil prices"] == 1


def test_fires_after_accumulated_exposures():
    state = PolicyAgentState()
    decide(POLICY, state, FEED_MATCH, random.Random(1))
    action = decide(POLICY, state, FEED_MATCH, random.Random(1))
    assert action is not None
    assert action["kind"] == "post"
    assert action["content"] == "So worried about oil prices right now"
    assert action["topic"] == "oil prices"
    assert action["degraded"] is False


def test_no_matching_posts_no_exposure_no_action():
    state = PolicyAgentState()
    feed = [{"post_id": 1, "content": "sports news"}]
    for _ in range(5):
        assert decide(POLICY, state, feed, random.Random(1)) is None
    assert state.exposures.get("oil prices", 0) == 0


def test_zero_base_rate_never_fires():
    policy = {**POLICY, "activity": {"base_rate": 0.0}}
    state = PolicyAgentState()
    for _ in range(5):
        decide(policy, state, FEED_MATCH, random.Random(1))
    assert decide(policy, state, FEED_MATCH, random.Random(1)) is None


def test_like_action_targets_matching_post():
    policy = {
        **POLICY,
        "reaction_rules": [
            {"on_topic": "oil prices", "stance_alignment": "any",
             "min_exposures": 1,
             "actions": [{"kind": "like", "weight": 1.0, "template_pool": None}]},
        ],
    }
    state = PolicyAgentState()
    action = decide(policy, state, FEED_MATCH, random.Random(1))
    assert action["kind"] == "like"
    assert action["target_post_id"] == 11


def test_missing_template_pool_degrades_to_like():
    policy = {
        **POLICY,
        "reaction_rules": [
            {"on_topic": "oil prices", "stance_alignment": "any",
             "min_exposures": 1,
             "actions": [{"kind": "post", "weight": 1.0,
                          "template_pool": "nonexistent"}]},
        ],
    }
    state = PolicyAgentState()
    action = decide(policy, state, FEED_MATCH, random.Random(1))
    assert action["kind"] == "like" and action["degraded"] is True


def test_deterministic_given_same_rng_seed():
    s1, s2 = PolicyAgentState(), PolicyAgentState()
    a1 = [decide(POLICY, s1, FEED_MATCH, random.Random(42)) for _ in range(3)]
    a2 = [decide(POLICY, s2, FEED_MATCH, random.Random(42)) for _ in range(3)]
    assert a1 == a2


def test_alignment_requires_stance_on_topic():
    policy = {
        **POLICY,
        "stances": [],  # no stance held
        "reaction_rules": [
            {"on_topic": "oil prices", "stance_alignment": "agree",
             "min_exposures": 1,
             "actions": [{"kind": "like", "weight": 1.0, "template_pool": None}]},
        ],
    }
    state = PolicyAgentState()
    assert decide(policy, state, FEED_MATCH, random.Random(1)) is None
