"""Compiled-policy RUNTIME. The thinking happened at build time
by the strong model; this engine only evaluates — zero LLM calls.

Pure and deterministic given (policy, state, feed, rng). Returns an action
descriptor; mapping to OASIS actions + whitelist enforcement happens in
the engine."""

from dataclasses import dataclass, field


@dataclass
class PolicyAgentState:
    """Per-agent cross-round memory: topic exposure counts."""
    exposures: dict = field(default_factory=dict)


def _post_matches_topic(content: str, topic: str) -> bool:
    c = content.casefold()
    t = topic.casefold()
    return t in c or all(word in c for word in t.split())


def decide(policy: dict, state: PolicyAgentState, feed: list[dict], rng):
    """Evaluate one round of observations. Returns an action descriptor
    dict or None. Mutates state (exposure accumulation)."""
    stance_topics = {s["topic"] for s in policy.get("stances", [])}
    rules = policy.get("reaction_rules", [])
    templates = policy.get("templates", {})
    base_rate = float(policy.get("activity", {}).get("base_rate", 0.3))
    social_proof = float(
        policy.get("susceptibility", {}).get("social_proof", 0.5)
    )

    # accumulate exposures + remember matching posts per topic (this feed)
    matches_by_topic: dict[str, list[dict]] = {}
    for rule in rules:
        topic = rule["on_topic"]
        if topic in matches_by_topic:
            continue
        matching = [
            p for p in feed if _post_matches_topic(p.get("content", ""), topic)
        ]
        matches_by_topic[topic] = matching
        if matching:
            state.exposures[topic] = (
                state.exposures.get(topic, 0) + len(matching)
            )

    for rule_index, rule in enumerate(rules):
        topic = rule["on_topic"]
        matching = matches_by_topic.get(topic, [])
        if not matching:
            continue
        if state.exposures.get(topic, 0) < int(rule.get("min_exposures", 1)):
            continue
        if rule.get("stance_alignment", "any") != "any" and (
            topic not in stance_topics
        ):
            continue

        crowd_factor = len(matching) / max(len(feed), 1)
        probability = min(base_rate * (1 + social_proof * crowd_factor), 1.0)
        if rng.random() >= probability:
            continue

        actions = rule.get("actions", [])
        if not actions:
            continue
        weights = [max(float(a.get("weight", 0)), 0.001) for a in actions]
        chosen = rng.choices(actions, weights=weights, k=1)[0]
        kind = chosen.get("kind", "do_nothing")
        if kind == "do_nothing":
            return None

        trigger_post = matching[0]
        if kind in ("post", "comment"):
            pool = templates.get(chosen.get("template_pool") or "", [])
            if not pool:
                return {
                    "kind": "like",
                    "target_post_id": trigger_post.get("post_id"),
                    "content": None, "topic": topic,
                    "rule_index": rule_index, "degraded": True,
                }
            template = rng.choice(pool)
            content = _fill_slots(template, topic)
            return {
                "kind": kind,
                "target_post_id": (
                    trigger_post.get("post_id") if kind == "comment" else None
                ),
                "content": content, "topic": topic,
                "rule_index": rule_index, "degraded": False,
            }
        return {
            "kind": kind,
            "target_post_id": trigger_post.get("post_id"),
            "content": None, "topic": topic,
            "rule_index": rule_index, "degraded": False,
        }
    return None


def _fill_slots(template: str, topic: str) -> str:
    """v1: every {slot} resolves to the topic."""
    import re

    return re.sub(r"\{[^{}]*\}", topic, template)
