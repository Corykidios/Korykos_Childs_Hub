from app.services.roles import carries_world_state, role_for, spawns_agent


def test_people_types_spawn_human_agents():
    for t in ("Person", "Official", "Headofstate", "Militarycommander",
              "Diplomat", "Cleric", "Journalist", "Donor-Financier"):
        r = role_for(t)
        assert r["spawns_agent"] is True
        assert r["agent_kind"] == "human"
        assert r["carries_world_state"] is False


def test_orgs_and_states_are_affiliations_not_agents():
    # a sovereign state / org acts THROUGH its people; it is not a poster
    for t in ("Stateactor", "GovernmentAgency", "Company", "MediaOutlet",
              "Party", "Internationalorganization", "Insurgentgroup"):
        r = role_for(t)
        assert r["spawns_agent"] is False
        assert r["carries_world_state"] is False


def test_venues_never_spawn():
    for t in ("Committee", "Chamber", "Court"):
        assert spawns_agent(t) is False


def test_world_state_types_carry_state_and_never_spawn():
    cases = {
        "Place": "open|restricted|closed",
        "Market": "numeric",
        "Bill": "introduced|committee|floor|passed|failed",
        "Memorandum": "unsigned|initialed|signed|ratified|collapsed",
        "Event": "timeline",
        "Vessel": "context",
    }
    for t, schema in cases.items():
        r = role_for(t)
        assert r["spawns_agent"] is False
        assert r["carries_world_state"] is True
        assert r["state_schema"] == schema


def test_the_strait_is_world_state_not_a_protagonist():
    # the headline fix: a place can't hold a view -> never an agent.
    r = role_for("Place")
    assert r["spawns_agent"] is False and r["carries_world_state"] is True
    assert spawns_agent("Place") is False
    assert carries_world_state("Place") is True


def test_keyword_fallback_for_unlisted_ontology_names():
    assert carries_world_state("Strait/Chokepoint") is True       # -> place
    assert carries_world_state("USS Warship") is True             # -> vessel
    assert carries_world_state("Anti-ship missile program") is True   # missile -> weapon (context), not a poster
    assert spawns_agent("Senate Committee") is False              # committee -> venue
    assert spawns_agent("Energy Ministry") is False               # ministry -> affiliation
    assert spawns_agent("Foreign Minister") is True               # minister -> agent


def test_countries_are_affiliations_not_agents():
    # a country acts THROUGH its leaders (Politicalleader); "Iran" must never
    # become a disembodied posting agent — same bug class as the Strait.
    for t in ("Country", "Nation", "Nation-state", "Sovereign State"):
        r = role_for(t)
        assert r["spawns_agent"] is False, t
        assert r["carries_world_state"] is False, t


def test_weapons_are_world_state_context_not_agents():
    # a missile/drone holds no view -> never a poster; tracked as context.
    for t in ("Weapon", "Missile", "Drone", "Ballistic missile",
              "Attack drone", "Shahed-136 drone", "Naval mine"):
        r = role_for(t)
        assert r["spawns_agent"] is False, t
        assert r["carries_world_state"] is True, t
        assert r["state_schema"] == "context", t


def test_unknown_type_defaults_to_human_agent():
    r = role_for("SomeBrandNewType")
    assert r["spawns_agent"] is True and r["agent_kind"] == "human"
    assert role_for(None)["spawns_agent"] is True  # tolerate missing type


def test_returns_fresh_dicts_not_shared_refs():
    a = role_for("Person")
    a["spawns_agent"] = False
    assert role_for("Person")["spawns_agent"] is True
