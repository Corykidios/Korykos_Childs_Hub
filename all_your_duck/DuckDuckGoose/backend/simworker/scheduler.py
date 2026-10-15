"""Tier scheduler: activation sampling (ported from the reference
wrapper's get_active_agents_for_round semantics, with the hidden caps as
explicit dials) + tier routing. Pure; deterministic via injected rng.

Protagonists are ALWAYS active — they drive the narrative. The
agents_per_round dial governs the CROWD only."""

ROUTE_BY_TIER = {
    "protagonist": "llm_protagonist",
    "crowd_llm": "llm_crowd",
    "crowd_policy": "policy",
}

DEFAULT_ACTIVITY = 0.5
DEFAULT_ACTIVE_HOURS = list(range(8, 23))


def schedule_round(
    agents: list[dict], round_num: int, time_dials: dict, rng
) -> dict:
    minutes = int(time_dials["minutes_per_round"])
    hour = (round_num * minutes // 60) % 24

    if hour in time_dials.get("peak_hours", []):
        multiplier = float(time_dials.get("peak_multiplier", 1.5))
    elif hour in time_dials.get("off_peak_hours", []):
        multiplier = float(time_dials.get("off_peak_multiplier", 0.3))
    else:
        multiplier = 1.0

    target = int(
        rng.uniform(
            float(time_dials["agents_per_round_min"]),
            float(time_dials["agents_per_round_max"]),
        ) * multiplier
    )

    decisions = []
    crowd_candidates = []
    for agent in agents:
        tier = agent.get("tier", "crowd_policy")
        if tier == "protagonist":
            decisions.append({
                "agent_uid": agent["agent_uid"],
                "route": ROUTE_BY_TIER["protagonist"],
            })
            continue
        active_hours = agent.get("active_hours") or DEFAULT_ACTIVE_HOURS
        activity = agent.get("activity_level", DEFAULT_ACTIVITY)
        if hour not in active_hours:
            continue
        if rng.random() >= float(activity):
            continue
        crowd_candidates.append(agent)

    if crowd_candidates and target > 0:
        selected = (
            rng.sample(crowd_candidates, min(target, len(crowd_candidates)))
        )
        for agent in selected:
            decisions.append({
                "agent_uid": agent["agent_uid"],
                "route": ROUTE_BY_TIER.get(
                    agent.get("tier", "crowd_policy"), "policy"
                ),
            })

    return {"hour": hour, "decisions": decisions}
