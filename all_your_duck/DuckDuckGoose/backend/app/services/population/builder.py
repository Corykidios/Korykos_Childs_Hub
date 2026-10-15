"""Population builder orchestration.

graph.json -> ranked plan -> entity/retinue/public agents -> tier + brain
assignment -> follow edges -> compiled policies for the rule crowd ->
population.json. Deterministic given (project, graph, dials): uids are
content-derived and tier splits sort by agent_uid."""

import json
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from app.core.projects import ProjectStore
from app.services.population.personas import (
    entity_agent,
    public_agents_from_archetypes,
    retinue_agent,
)
from app.services.population.policies import generate_policy, save_policy
from app.services.population.ranking import plan_population

logger = logging.getLogger(__name__)

_ARCHETYPE_SYSTEM = (
    "You design the PUBLIC for a social simulation. Given the operator "
    "question and the cast of real entities, propose the ARCHETYPES of "
    "ordinary people who would follow or be affected by this story, plus "
    "the key topics the simulation revolves around. Reply with JSON: "
    '{"archetypes": [{"label": str, "persona": str (2-4 sentences), '
    '"interested_topics": [str], "share": 0..1, "faction": str (which side '
    "of the operator question this slice of the public leans — a SHORT "
    "lowercase-hyphenated stance label, REUSED consistently across archetypes "
    'with the same stance, no parentheticals, or "mixed")}], '
    '"key_topics": [str]}. '
    "3-6 archetypes, shares sum to ~1. English only."
)


def _propose_archetypes(question: str, ranked: list[dict], llm) -> dict:
    cast = "\n".join(
        f"- {e['canonical_name']} ({e['type']}): {e.get('summary', '')}"
        for e in ranked[:10]
    )
    raw = llm.chat_json(
        [
            {"role": "system", "content": _ARCHETYPE_SYSTEM},
            {"role": "user",
             "content": f"OPERATOR QUESTION: {question}\n\nCAST:\n{cast}"},
        ],
        temperature=0.5,
    )
    archetypes = [
        a for a in (raw.get("archetypes") or [])
        if isinstance(a, dict) and a.get("label")
    ]
    key_topics = [str(t) for t in (raw.get("key_topics") or []) if str(t).strip()]
    if not archetypes:
        raise ValueError("archetype proposal returned no archetypes")
    return {"archetypes": archetypes, "key_topics": key_topics or [question]}


def _assign_tiers(
    agents: list[dict], protagonist_uids: list[str], tiered: bool,
    crowd_llm_ratio: float,
) -> None:
    protagonist_set = set(protagonist_uids)
    if not tiered:
        for a in agents:
            a["tier"] = "protagonist"
        return
    crowd = sorted(
        (a for a in agents if a["agent_uid"] not in protagonist_set),
        key=lambda a: a["agent_uid"],
    )
    llm_count = round(len(crowd) * crowd_llm_ratio)
    for i, a in enumerate(crowd):
        a["tier"] = "crowd_llm" if i < llm_count else "crowd_policy"
    for a in agents:
        if a["agent_uid"] in protagonist_set:
            a["tier"] = "protagonist"


def _follow_edges(agents: list[dict], protagonist_uids: list[str]) -> list[dict]:
    edges: set[tuple[str, str]] = set()
    entity_by_source = {
        a["source_entity_uuid"]: a["agent_uid"]
        for a in agents if a["kind"] == "entity"
    }
    by_topic: dict[str, list[str]] = {}
    for a in agents:
        for t in a.get("interested_topics", []):
            by_topic.setdefault(t.casefold(), []).append(a["agent_uid"])

    for a in agents:
        uid = a["agent_uid"]
        # retinue follows its anchor's entity agent
        if a["kind"] == "retinue" and a.get("anchor_uuid") in entity_by_source:
            edges.add((uid, entity_by_source[a["anchor_uuid"]]))
        # interest-overlap follows (deterministic, up to 3)
        if a["kind"] == "public":
            candidates: list[str] = []
            for t in a.get("interested_topics", []):
                candidates.extend(by_topic.get(t.casefold(), []))
            for other in sorted(set(candidates)):
                if other != uid and len(
                    [e for e in edges if e[0] == uid]
                ) < 3:
                    edges.add((uid, other))
        # protagonist follower mass: deterministic hash spread by rank
        for rank, proto_uid in enumerate(protagonist_uids):
            if uid != proto_uid and int(uid[-4:], 16) % (rank + 2) == 0:
                edges.add((uid, proto_uid))
    return [{"follower": f, "followee": t} for f, t in sorted(edges)]


def build_population(
    store: ProjectStore, project_id: str, llm, dials: dict,
    protagonist_override: list[str] | None = None,
) -> dict:
    project = store.get(project_id)
    if project is None:
        raise ValueError(f"unknown project: {project_id}")
    graph_file = store.project_dir(project_id) / "graph.json"
    if not graph_file.exists():
        raise ValueError("graph not built — run extraction first")
    graph = json.loads(graph_file.read_text(encoding="utf-8"))

    plan = plan_population(
        graph,
        n_total=int(dials["n_total"]),
        k_protagonists=int(dials["k_protagonists"]),
        retinue_ratio=float(dials["retinue_ratio"]),
        agent_min_mentions=int(dials.get("agent_min_mentions", 2)),
    )
    question = project["question"]
    ranked = plan["ranked"]
    by_uuid = {e["uuid"]: e for e in ranked}

    # Per-agent builder LLM calls (personas + compiled policies) are the bulk
    # of the build and are independent: entity/retinue/policy generators are
    # pure (LLM call -> return), and save_policy writes a distinct file per
    # agent_uid. So they fan out safely; the only shared write (population.json)
    # is once at the end. Workers come from the builder profile's concurrency;
    # a fake/profileless LLM (tests) falls back to 1 = serial = deterministic.
    workers = max(1, getattr(getattr(llm, "profile", None), "max_concurrency", 1) or 1)

    # entity agents (one per resolved entity) — parallel, input order preserved
    with ThreadPoolExecutor(max_workers=workers) as pool:
        agents = list(
            pool.map(lambda e: entity_agent(project_id, e, question, llm), ranked)
        )
    entity_agent_by_entity = {
        a["source_entity_uuid"]: a for a in agents
    }
    # protagonists: entity-agent uids for ranked top-K (or operator override)
    proto_entities = protagonist_override or plan["protagonist_uuids"]
    protagonist_uids = [
        entity_agent_by_entity[u]["agent_uid"]
        for u in proto_entities if u in entity_agent_by_entity
    ]

    # retinue — flatten (anchor, index) tasks, then build in parallel
    retinue_tasks = [
        (by_uuid[ent_uuid], i)
        for ent_uuid, count in plan["retinue_allocation"].items()
        for i in range(count)
    ]
    if retinue_tasks:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            agents.extend(
                pool.map(
                    lambda t: retinue_agent(project_id, t[0], t[1], question, llm),
                    retinue_tasks,
                )
            )

    # public
    proposal = _propose_archetypes(question, ranked, llm)
    agents.extend(
        public_agents_from_archetypes(
            project_id, proposal["archetypes"], plan["public_count"]
        )
    )

    _assign_tiers(
        agents, protagonist_uids, bool(dials["tiered"]),
        float(dials["crowd_llm_ratio"]),
    )
    follow_edges = _follow_edges(agents, protagonist_uids)

    # compiled policies for the rule crowd — parallel; failures collected, visible
    policy_dir = store.project_dir(project_id) / "policies"
    key_topics = proposal["key_topics"]

    def _compile_policy(a: dict):
        try:
            save_policy(policy_dir, generate_policy(a, question, key_topics, llm))
            return None
        except Exception as e:
            logger.warning(f"policy generation failed for {a['agent_uid']}: {e}")
            return {"agent_uid": a["agent_uid"], "error": str(e)[:200]}

    crowd_policy_agents = [a for a in agents if a["tier"] == "crowd_policy"]
    policy_failures = []
    if crowd_policy_agents:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            policy_failures = [
                r for r in pool.map(_compile_policy, crowd_policy_agents) if r
            ]

    population = {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "dials": dials,
        "key_topics": proposal["key_topics"],
        "protagonist_uids": protagonist_uids,
        "agents": agents,
        "follow_edges": follow_edges,
        "persona_failures": [
            a["agent_uid"] for a in agents if a["persona_status"] == "failed"
        ],
        "policy_failures": policy_failures,
    }
    (store.project_dir(project_id) / "population.json").write_text(
        json.dumps(population, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    return population
