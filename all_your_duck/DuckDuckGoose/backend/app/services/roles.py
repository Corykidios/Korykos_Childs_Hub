"""Entity TYPE -> simulation ROLE map (the type->role overhaul).

Separates the three things extraction used to merge:
  - EXTRACTION   — find every named thing (unchanged; produces entity.type).
  - AGENT-SPAWN  — only some types become social actors that post/react.
  - WORLD-STATE  — some types are the measurable variables the report grounds on
                   (the strait's status, Brent's level, a bill/memorandum's state).

Role is derived purely from the entity's `type` string — no per-type config is
stored. The map is robust to ontology naming variation (exact normalized match,
then keyword heuristics), and an unknown type falls back to a HUMAN agent
(inclusion-by-default; the agent-worthiness threshold downstream gates noise).
This is the fix for "Strait of Hormuz (a place) ranked as a top protagonist":
a place can't hold a view, so it never spawns an agent — it's world-state.

Ratified design: see the project notes (entity TYPE->ROLE + world-state overhaul).
"""

import re

# Canonical role shapes.
_AGENT = {"spawns_agent": True, "agent_kind": "human",
          "carries_world_state": False, "state_schema": None}
_INSTITUTIONAL = {"spawns_agent": True, "agent_kind": "institutional",
                  "carries_world_state": False, "state_schema": None}
_AFFILIATION = {"spawns_agent": False, "agent_kind": None,
                "carries_world_state": False, "state_schema": None}
_VENUE = {"spawns_agent": False, "agent_kind": None,
          "carries_world_state": False, "state_schema": None}


def _ws(schema: str) -> dict:
    return {"spawns_agent": False, "agent_kind": None,
            "carries_world_state": True, "state_schema": schema}


# Explicit map keyed by NORMALIZED type name (lowercase, alphanumerics only).
# Covers the ontology TitleCase types AND the MANIFEST cast[].type hints.
_MAP: dict[str, dict] = {
    # --- AGENTS (people who post/react) ---
    "person": _AGENT, "official": _AGENT, "legislator": _AGENT,
    "diplomat": _AGENT, "militaryofficer": _AGENT, "militarycommander": _AGENT,
    "donorfinancier": _AGENT, "donor": _AGENT, "financier": _AGENT,
    "analystpundit": _AGENT, "analyst": _AGENT, "pundit": _AGENT,
    "journalist": _AGENT, "cleric": _AGENT, "headofstate": _AGENT,
    # --- AFFILIATION / GROUPS (act THROUGH their people; a faction tag, not a poster) ---
    "organization": _AFFILIATION, "governmentagency": _AFFILIATION,
    "agency": _AFFILIATION, "militaryunit": _AFFILIATION, "party": _AFFILIATION,
    "coalition": _AFFILIATION, "movement": _AFFILIATION,
    "mediaoutlet": _AFFILIATION, "company": _AFFILIATION,
    "centralbank": _AFFILIATION, "superpac": _AFFILIATION,
    "donororg": _AFFILIATION, "insurgentgroup": _AFFILIATION,
    "stateactor": _AFFILIATION, "internationalorganization": _AFFILIATION,
    "country": _AFFILIATION, "nation": _AFFILIATION,
    "nationstate": _AFFILIATION, "sovereignstate": _AFFILIATION,
    "energycompany": _AFFILIATION, "creditratingagency": _AFFILIATION,
    "shippinginsurer": _AFFILIATION,
    # --- VENUES (where things happen; never a poster) ---
    "committee": _VENUE, "chamber": _VENUE, "court": _VENUE,
    # --- WORLD-STATE (the trackable variables the verdict reads) ---
    "place": _ws("open|restricted|closed"),
    "chokepoint": _ws("open|restricted|closed"),
    "facility": _ws("operational|degraded|offline"),
    "instrument": _ws("numeric"), "commodity": _ws("numeric"),
    "metric": _ws("numeric"), "market": _ws("numeric"), "index": _ws("numeric"),
    "legislation": _ws("introduced|committee|floor|passed|failed"),
    "bill": _ws("introduced|committee|floor|passed|failed"),
    "resolution": _ws("introduced|committee|floor|passed|failed"),
    "agreement": _ws("unsigned|initialed|signed|ratified|collapsed"),
    "memorandum": _ws("unsigned|initialed|signed|ratified|collapsed"),
    "event": _ws("timeline"), "operation": _ws("timeline"),
    "vessel": _ws("context"), "weapon": _ws("context"),
    "missile": _ws("context"), "drone": _ws("context"),
    "munition": _ws("context"), "uav": _ws("context"),
    "warhead": _ws("context"), "armament": _ws("context"),
    "navalmine": _ws("context"), "torpedo": _ws("context"),
}

# Keyword heuristics (first match wins) — robustness to ontology naming the
# explicit map doesn't list verbatim. ORDER MATTERS: most specific first.
_KEYWORDS: list[tuple[tuple[str, ...], dict]] = [
    (("vessel", "warship", "frigate", "destroyer", "tanker", "submarine"), _ws("context")),
    (("weapon", "missile", "drone", "munition", "warhead", "torpedo", "uav"), _ws("context")),
    (("legislation", "resolution", "statute"), _ws("introduced|committee|floor|passed|failed")),
    (("memorandum", "agreement", "accord", "treaty", "ceasefiredeal", "framework"),
     _ws("unsigned|initialed|signed|ratified|collapsed")),
    (("chokepoint", "strait", "waterway", "terminal", "refinery", "port",
      "facility", "place", "location", "region", "territory", "island"),
     _ws("open|restricted|closed")),
    (("benchmark", "commodity", "instrument", "metric", "index", "premium",
      "pricelevel"), _ws("numeric")),
    (("operation", "offensive", "strike", "ceasefire", "summit"), _ws("timeline")),
    (("committee", "subcommittee", "chamber", "tribunal", "court"), _VENUE),
    (("ministry", "department", "bureau", "commission", "authority", "agency"), _AFFILIATION),
    (("coalition", "movement", "bloc", "alliance", "party", "faction"), _AFFILIATION),
    (("centralbank", "bank"), _AFFILIATION),
    (("company", "corporation", "firm", "consortium"), _AFFILIATION),
    (("media", "outlet", "network", "broadcaster", "newspaper", "wire"), _AFFILIATION),
    (("brigade", "division", "fleet", "corps", "navy", "army", "militaryunit",
      "command", "guard", "force"), _AFFILIATION),
    (("official", "minister", "senator", "legislator", "representative",
      "diplomat", "envoy", "officer", "commander", "governor", "president",
      "premier", "leader", "spokesperson", "aide", "analyst", "journalist",
      "cleric", "donor", "financier", "person"), _AGENT),
]

_DEFAULT = _AGENT  # unknown type -> assume a human agent; worthiness gates noise


def _norm(type_name) -> str:
    return re.sub(r"[^a-z0-9]", "", str(type_name or "").lower())


def role_for(type_name) -> dict:
    """Resolve an entity type to its simulation role. Always returns a fresh
    dict {spawns_agent, agent_kind, carries_world_state, state_schema}."""
    n = _norm(type_name)
    if n in _MAP:
        return dict(_MAP[n])
    for keywords, role in _KEYWORDS:
        if any(k in n for k in keywords):
            return dict(role)
    return dict(_DEFAULT)


def spawns_agent(type_name) -> bool:
    return role_for(type_name)["spawns_agent"]


def carries_world_state(type_name) -> bool:
    return role_for(type_name)["carries_world_state"]
