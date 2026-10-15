from app.services.population.ranking import plan_population, rank_entities


def _graph():
    # all agent-spawning types (Person/Official) so the frame-math tests below
    # exercise the arithmetic, not the spawn filter (which has its own test).
    return {
        "entities": [
            {"uuid": "ent_a", "canonical_name": "Vladimir Putin", "type": "Person",
             "summary": "s", "mention_count": 10, "doc_ids": ["d1", "d2"]},
            {"uuid": "ent_b", "canonical_name": "Abbas Araghchi", "type": "Official",
             "summary": "s", "mention_count": 6, "doc_ids": ["d1"]},
            {"uuid": "ent_c", "canonical_name": "Marco Rubio", "type": "Official",
             "summary": "s", "mention_count": 2, "doc_ids": ["d2"]},
        ],
        "edges": [
            {"source_uuid": "ent_a", "target_uuid": "ent_b"},
            {"source_uuid": "ent_c", "target_uuid": "ent_a"},
        ],
    }


def test_rank_orders_by_mentions_plus_degree():
    ranked = rank_entities(_graph())
    assert [e["uuid"] for e in ranked] == ["ent_a", "ent_b", "ent_c"]
    assert ranked[0]["influence"] > ranked[1]["influence"] > 0


def test_plan_population_counts_exact():
    plan = plan_population(_graph(), n_total=20, k_protagonists=2,
                           retinue_ratio=0.3)
    assert plan["entity_count"] == 3
    assert plan["protagonist_uuids"] == ["ent_a", "ent_b"]
    synth = plan["retinue_count"] + plan["public_count"]
    assert plan["entity_count"] + synth == 20
    # 30% of the 17 synthesized are retinue (rounded)
    assert plan["retinue_count"] == round(17 * 0.3)


def test_plan_population_n_below_entity_count_keeps_all_entities():
    plan = plan_population(_graph(), n_total=2, k_protagonists=1,
                           retinue_ratio=0.3)
    assert plan["entity_count"] == 3
    assert plan["retinue_count"] == 0 and plan["public_count"] == 0


def test_plan_population_k_clamped_to_entities():
    plan = plan_population(_graph(), n_total=10, k_protagonists=99,
                           retinue_ratio=0.3)
    assert len(plan["protagonist_uuids"]) == 3


def test_retinue_allocation_proportional_to_influence():
    plan = plan_population(_graph(), n_total=103, k_protagonists=1,
                           retinue_ratio=0.3)
    alloc = plan["retinue_allocation"]
    assert sum(alloc.values()) == plan["retinue_count"]
    assert alloc["ent_a"] >= alloc["ent_b"] >= alloc.get("ent_c", 0)


def test_plan_population_filters_non_agents_and_thin_entities():
    # the type->role overhaul: the Strait (a place, 800 mentions) and OPEC (an
    # org) are NOT agents; a 1-mention person is below the worthiness threshold.
    g = {
        "entities": [
            {"uuid": "p", "canonical_name": "Donald Trump", "type": "Person",
             "summary": "", "mention_count": 50, "doc_ids": ["d"]},
            {"uuid": "place", "canonical_name": "the Strait of Hormuz",
             "type": "Place", "summary": "", "mention_count": 800, "doc_ids": ["d"]},
            {"uuid": "org", "canonical_name": "OPEC", "type": "Organization",
             "summary": "", "mention_count": 40, "doc_ids": ["d"]},
            {"uuid": "thin", "canonical_name": "Minor Aide", "type": "Person",
             "summary": "", "mention_count": 1, "doc_ids": ["d"]},
        ],
        "edges": [],
    }
    plan = plan_population(g, n_total=10, k_protagonists=3, retinue_ratio=0.0,
                           agent_min_mentions=2)
    ids = [e["uuid"] for e in plan["ranked"]]
    assert ids == ["p"]                # only the well-mentioned Person spawns
    assert "place" not in ids          # the Strait is world-state, never a protagonist
    assert "org" not in ids            # orgs act through their people
    assert "thin" not in ids           # below the worthiness threshold
    assert plan["protagonist_uuids"] == ["p"]
    assert plan["entity_count"] == 1
