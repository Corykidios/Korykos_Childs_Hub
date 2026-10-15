"""Persona generation. Entity agents are grounded in merged
cross-corpus evidence; retinue agents anchor to an entity; public agents
instantiate corpus-derived archetypes with controlled variation.

Failures are VISIBLE (persona_status="failed") and individually
retryable — no silent rule-based fallback personas."""

import hashlib
import logging
import random
import re

from app.services.factions import canonicalize_faction

logger = logging.getLogger(__name__)

REDDIT_DEFAULTS = {
    "age": 35,
    "gender": "other",
    "mbti": "ISTJ",
    "country": "United States",
}

_PERSONA_SYSTEM = (
    "You write social-media personas for a social simulation, grounded ONLY "
    "in the evidence given. Reply with JSON: "
    '{"bio": str (<=200 chars), "persona": str (300-800 chars: personality, '
    "stances on the operator question, posting style, biases), "
    '"age": int, "gender": "male"|"female"|"other", "mbti": str, '
    '"country": str, "profession": str, "interested_topics": [str], '
    '"faction": str (which SIDE of the operator question this person is on — '
    "a SHORT lowercase-hyphenated stance label grouped by POSITION, not "
    'nationality, e.g. "pro-reopening" / "hardline-closure" / "neutral". REUSE '
    "the SAME label for everyone with the same stance; no parentheticals or "
    'qualifiers)}. '
    "English only."
)


def _uid(project_id: str, kind: str, seed_key: str) -> str:
    return "agent_" + hashlib.sha256(
        f"{project_id}|{kind}|{seed_key}".encode()
    ).hexdigest()[:16]


def _username(name: str, uid: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", name.casefold()).strip("_")[:20]
    return f"{slug or 'agent'}_{uid[-4:]}"


def _finalize(agent: dict, payload: dict | None) -> dict:
    """Merge LLM payload onto the agent record, enforcing required fields."""
    payload = payload or {}
    agent["bio"] = str(payload.get("bio", ""))[:300]
    agent["persona"] = str(payload.get("persona", ""))
    agent["profession"] = str(payload.get("profession", ""))
    topics = payload.get("interested_topics")
    agent["interested_topics"] = [
        str(t) for t in topics if str(t).strip()
    ][:8] if isinstance(topics, list) else []
    for field, default in REDDIT_DEFAULTS.items():
        value = payload.get(field, None)
        if field == "age":
            try:
                value = int(value)
            except (TypeError, ValueError):
                value = None
            agent["age"] = value if value and 0 < value < 120 else default
        else:
            agent[field] = str(value).strip() if value else default
    faction = str(payload.get("faction", "")).strip()
    agent["faction"] = canonicalize_faction(
        faction or agent.get("faction") or "unaligned"
    )
    return agent


def _base(project_id: str, kind: str, seed_key: str, name: str) -> dict:
    uid = _uid(project_id, kind, seed_key)
    return {
        "agent_uid": uid,
        "kind": kind,
        "name": name,
        "username": _username(name, uid),
        "anchor_uuid": None,
        "source_entity_uuid": None,
        "persona_status": "ok",
        "faction": "unaligned",
    }


def _evidence_block(entity: dict) -> str:
    lines = [
        f"Name: {entity['canonical_name']} ({entity['type']})",
        f"Known aliases: {', '.join(entity.get('aliases', [])) or 'none'}",
        f"Summary: {entity.get('summary', '')}",
        f"Mentioned in {entity.get('mention_count', 0)} places across "
        f"{len(entity.get('doc_ids', []))} documents.",
    ]
    for m in entity.get("mentions", [])[:10]:
        if m.get("summary"):
            lines.append(f"- [{m['doc_id']}] {m['summary']}")
    return "\n".join(lines)


def _ask(llm, agent: dict, user_content: str) -> dict:
    try:
        payload = llm.chat_json(
            [
                {"role": "system", "content": _PERSONA_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            temperature=0.6,
        )
        return _finalize(agent, payload)
    except Exception as e:
        logger.warning(f"persona generation failed for {agent['agent_uid']}: {e}")
        agent["persona_status"] = "failed"
        return _finalize(agent, {})


def entity_agent(project_id: str, entity: dict, question: str, llm) -> dict:
    agent = _base(project_id, "entity", entity["uuid"], entity["canonical_name"])
    agent["source_entity_uuid"] = entity["uuid"]
    return _ask(
        llm, agent,
        f"OPERATOR QUESTION: {question}\n\nWrite the persona for this "
        f"real entity from the corpus:\n{_evidence_block(entity)}",
    )


def retinue_agent(
    project_id: str, anchor_entity: dict, index: int, question: str, llm
) -> dict:
    seed = f"{anchor_entity['uuid']}#{index}"
    agent = _base(
        project_id, "retinue", seed,
        f"{anchor_entity['canonical_name']} follower {index + 1}",
    )
    agent["anchor_uuid"] = anchor_entity["uuid"]
    return _ask(
        llm, agent,
        f"OPERATOR QUESTION: {question}\n\nInvent ONE ordinary person in the "
        f"orbit of this entity (supporter, critic, staffer, or fan — pick "
        f"one; index {index} should vary the angle):\n"
        f"{_evidence_block(anchor_entity)}\n\n"
        "Give them their own name in the bio. They are NOT the entity.",
    )


def public_agents_from_archetypes(
    project_id: str, archetypes: list[dict], count: int
) -> list[dict]:
    """Instantiate archetypes to EXACTLY count agents, largest-share first.
    Deterministic variation via per-agent seeded RNG (no global state)."""
    if not archetypes or count <= 0:
        return []
    weights = [max(float(a.get("share", 0)) or 0, 0.01) for a in archetypes]
    total = sum(weights)
    counts = [int(count * w / total) for w in weights]
    i = 0
    while sum(counts) < count:
        counts[i % len(counts)] += 1
        i += 1

    agents = []
    for arch_i, (arch, n) in enumerate(zip(archetypes, counts)):
        for j in range(n):
            seed = f"arch{arch_i}#{j}"
            label = str(arch.get("label", f"citizen {arch_i}"))
            agent = _base(project_id, "public", seed, f"{label} {j + 1}")
            rng = random.Random(agent["agent_uid"])
            agent["profession"] = label
            agent["bio"] = f"{label.capitalize()}."
            agent["persona"] = str(arch.get("persona", ""))
            agent["faction"] = canonicalize_faction(arch.get("faction") or "public")
            topics = arch.get("interested_topics") or []
            agent["interested_topics"] = [str(t) for t in topics][:8]
            agent["age"] = rng.randint(19, 70)
            agent["gender"] = rng.choice(["male", "female", "other"])
            agent["mbti"] = rng.choice(
                ["ISTJ", "ENFP", "INTP", "ESFJ", "ENTJ", "ISFP"]
            )
            agent["country"] = REDDIT_DEFAULTS["country"]
            agents.append(agent)
    return agents[:count]
