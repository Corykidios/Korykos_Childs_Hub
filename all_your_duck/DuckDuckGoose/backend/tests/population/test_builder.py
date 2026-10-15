import json

import pytest

from app.core.projects import ProjectStore
from app.services.population.builder import build_population

GRAPH = {
    "entity_count": 2, "edge_count": 1, "dropped_edges": 0,
    "entities": [
        {"uuid": "ent_a", "canonical_name": "Vladimir Putin", "type": "Person",
         "summary": "Russian president", "mention_count": 9,
         "doc_ids": ["d1"], "aliases": [], "mentions": []},
        {"uuid": "ent_b", "canonical_name": "Christine Lagarde", "type": "Official",
         "summary": "ECB president", "mention_count": 5,
         "doc_ids": ["d1"], "aliases": [], "mentions": []},
    ],
    "edges": [{"source_uuid": "ent_a", "target_uuid": "ent_b"}],
}

PERSONA = {
    "bio": "b", "persona": "p", "age": 40, "gender": "male", "mbti": "INTJ",
    "country": "Russia", "profession": "x", "interested_topics": ["oil"],
}
ARCHETYPES = {
    "archetypes": [
        {"label": "worried investor", "persona": "watches markets",
         "interested_topics": ["oil"], "share": 0.6},
        {"label": "casual observer", "persona": "scrolls feeds",
         "interested_topics": ["news"], "share": 0.4},
    ],
    "key_topics": ["oil prices", "OPEC policy"],
}
POLICY = {
    "stances": [{"topic": "oil prices", "position": "worried", "intensity": 0.6}],
    "reaction_rules": [{"on_topic": "oil prices", "stance_alignment": "any",
                        "min_exposures": 1,
                        "actions": [{"kind": "like", "weight": 0.8,
                                     "template_pool": None}]}],
    "templates": {}, "susceptibility": {"social_proof": 0.5, "authority": 0.5},
    "activity": {"base_rate": 0.3},
}


class RoutedFakeLLM:
    """Routes by prompt content: archetype call vs persona vs policy."""

    def chat_json(self, messages, temperature=0.7):
        text = json.dumps(messages)
        if "propose the ARCHETYPES" in text:
            return ARCHETYPES
        if "behavior policy" in text:
            return POLICY
        return PERSONA


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


@pytest.fixture
def project(store):
    p = store.create(name="t", question="Will oil pass $95?")
    (store.project_dir(p["id"]) / "graph.json").write_text(
        json.dumps(GRAPH), encoding="utf-8"
    )
    return p


DIALS = {"n_total": 12, "k_protagonists": 1, "retinue_ratio": 0.3,
         "tiered": True, "crowd_llm_ratio": 0.2}


def test_build_population_exact_n_and_kinds(store, project):
    pop = build_population(store, project["id"], RoutedFakeLLM(), DIALS)
    assert len(pop["agents"]) == 12
    kinds = [a["kind"] for a in pop["agents"]]
    assert kinds.count("entity") == 2
    assert kinds.count("retinue") == 3   # round(10 * 0.3)
    assert kinds.count("public") == 7


def test_tier_assignment_tiered_on(store, project):
    pop = build_population(store, project["id"], RoutedFakeLLM(), DIALS)
    tiers = {a["agent_uid"]: a["tier"] for a in pop["agents"]}
    protagonist_uids = pop["protagonist_uids"]
    assert len(protagonist_uids) == 1
    assert all(tiers[u] == "protagonist" for u in protagonist_uids)
    crowd = [t for u, t in tiers.items() if u not in protagonist_uids]
    assert crowd.count("crowd_llm") == round(len(crowd) * 0.2)
    assert crowd.count("crowd_policy") == len(crowd) - crowd.count("crowd_llm")


def test_tiered_off_everyone_protagonist_brain(store, project):
    dials = dict(DIALS, tiered=False)
    pop = build_population(store, project["id"], RoutedFakeLLM(), dials)
    assert all(a["tier"] == "protagonist" for a in pop["agents"])


def test_policies_written_for_crowd_policy_agents(store, project):
    pop = build_population(store, project["id"], RoutedFakeLLM(), DIALS)
    policy_dir = store.project_dir(project["id"]) / "policies"
    crowd_policy = [a for a in pop["agents"] if a["tier"] == "crowd_policy"]
    assert crowd_policy
    for a in crowd_policy:
        assert (policy_dir / f"{a['agent_uid']}.json").exists()
    assert pop["policy_failures"] == []


def test_follow_edges_retinue_anchor_and_protagonists(store, project):
    pop = build_population(store, project["id"], RoutedFakeLLM(), DIALS)
    by_uid = {a["agent_uid"]: a for a in pop["agents"]}
    entity_by_source = {
        a["source_entity_uuid"]: a["agent_uid"]
        for a in pop["agents"] if a["kind"] == "entity"
    }
    follows = {(e["follower"], e["followee"]) for e in pop["follow_edges"]}
    for a in pop["agents"]:
        if a["kind"] == "retinue":
            anchor_agent = entity_by_source[a["anchor_uuid"]]
            assert (a["agent_uid"], anchor_agent) in follows
    # all edges reference real agents
    for f, t in follows:
        assert f in by_uid and t in by_uid and f != t


def test_population_persisted_and_deterministic_uids(store, project):
    pop1 = build_population(store, project["id"], RoutedFakeLLM(), DIALS)
    saved = json.loads(
        (store.project_dir(project["id"]) / "population.json").read_text(
            encoding="utf-8")
    )
    assert saved["dials"] == DIALS
    pop2 = build_population(store, project["id"], RoutedFakeLLM(), DIALS)
    assert [a["agent_uid"] for a in pop1["agents"]] == [
        a["agent_uid"] for a in pop2["agents"]
    ]


def test_build_requires_graph(store):
    p = store.create(name="t", question="q")
    with pytest.raises(ValueError):
        build_population(store, p["id"], RoutedFakeLLM(), DIALS)
