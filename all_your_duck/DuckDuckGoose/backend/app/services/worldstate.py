"""World-state assembly (the type->role overhaul, world-state half).

The entities whose type `carries_world_state` (the strait, oil benchmarks,
bills, the memorandum, key events/vessels) are the MEASURABLE variables the
report grounds its verdict on — instead of treating those most-mentioned
"topics" as fake protagonists. v1: the report READS them (status + evidence);
v2 (deferred) would have the simulation dynamically move them.
"""

from app.services.roles import role_for


def assemble_world_state(graph: dict) -> list[dict]:
    """The world-state variables present in a built graph, richest-first.

    Each: {name, type, state_schema, mention_count, doc_count, summary}.
    Derived purely from entity type via the role map — no extra storage.
    """
    out = []
    for e in graph.get("entities", []):
        role = role_for(e.get("type"))
        if not role["carries_world_state"]:
            continue
        out.append({
            "name": e.get("canonical_name", "?"),
            "type": e.get("type", ""),
            "state_schema": role["state_schema"],
            "mention_count": e.get("mention_count", 0),
            "doc_count": len(e.get("doc_ids", []) or []),
            "summary": e.get("summary", ""),
        })
    out.sort(key=lambda w: (-w["mention_count"], w["name"]))
    return out


def world_state_digest(world_state: list[dict], limit: int = 20) -> str:
    """Compact text block of the world-state variables for the report context."""
    if not world_state:
        return "(no world-state variables identified)"
    lines = [
        f"- {w['name']} [{w['type']}; state ∈ {w['state_schema']}] "
        f"({w['mention_count']} mentions): {w['summary']}".rstrip()
        for w in world_state[:limit]
    ]
    return "\n".join(lines)
