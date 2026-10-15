"""Influence ranking + population frame math.

influence = mention_count + edge degree (cheap, explainable). The ranker
proposes the top-K as protagonists; the operator can override via the API.
plan_population only does arithmetic — no LLM, fully deterministic."""

from app.services import roles


def rank_entities(graph: dict) -> list[dict]:
    degree: dict[str, int] = {}
    for edge in graph.get("edges", []):
        for key in ("source_uuid", "target_uuid"):
            uid = edge.get(key)
            if uid:
                degree[uid] = degree.get(uid, 0) + 1
    ranked = []
    for ent in graph.get("entities", []):
        ranked.append({
            **ent,
            "influence": ent.get("mention_count", 0) + degree.get(ent["uuid"], 0),
        })
    ranked.sort(key=lambda e: (-e["influence"], e["canonical_name"]))
    return ranked


def plan_population(
    graph: dict,
    n_total: int,
    k_protagonists: int,
    retinue_ratio: float,
    agent_min_mentions: int = 2,
) -> dict:
    # AGENT-SPAWN filter (the type->role overhaul): only types that can hold a
    # view become agents, and only if mentioned enough to ground a persona.
    # Places, prices, bills, the memorandum, events, vessels are world-state,
    # NOT social actors — so "Strait of Hormuz" (a place) never ranks as a
    # protagonist however many docs mention it. Orgs/states act through their
    # people, who ARE agents. rank_entities itself is unchanged (it still scores
    # everything); the filter is applied only to the AGENT pool here.
    ranked = [
        e for e in rank_entities(graph)
        if roles.spawns_agent(e.get("type"))
        and e.get("mention_count", 0) >= agent_min_mentions
    ]
    entity_count = len(ranked)
    protagonists = [e["uuid"] for e in ranked[:max(k_protagonists, 0)]]

    synth_total = max(n_total - entity_count, 0)
    retinue_count = round(synth_total * retinue_ratio)
    public_count = synth_total - retinue_count

    # retinue allocated proportionally to influence (largest remainder)
    allocation: dict[str, int] = {}
    total_influence = sum(e["influence"] for e in ranked) or 1
    if retinue_count and ranked:
        shares = [
            (e["uuid"], retinue_count * e["influence"] / total_influence)
            for e in ranked
        ]
        for uid, share in shares:
            allocation[uid] = int(share)
        remainder = retinue_count - sum(allocation.values())
        for uid, share in sorted(shares, key=lambda s: -(s[1] - int(s[1]))):
            if remainder <= 0:
                break
            allocation[uid] += 1
            remainder -= 1
        allocation = {u: c for u, c in allocation.items() if c > 0}

    return {
        "entity_count": entity_count,
        "protagonist_uuids": protagonists,
        "retinue_count": retinue_count,
        "public_count": public_count,
        "retinue_allocation": allocation,
        "ranked": ranked,
    }
