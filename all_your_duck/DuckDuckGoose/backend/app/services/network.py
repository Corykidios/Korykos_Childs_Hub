"""Reply-network assembly.

"Who talked to whom": a directed edge from a commenter to the author of the
post they replied to, reconstructed from the cached threaded feed (no extra DB
read). Nodes carry engagement so the graph can size them; the set is capped
(protagonists kept first) so a 2,500-agent run renders as a legible graph, not
a hairball. Deterministic — no LLM.
"""

from pathlib import Path

from app.services.feed import build_feed

DEFAULT_MAX_NODES = 36


def _engagement(rec: dict) -> float:
    # posts weigh most (they seed conversation), then comments, then likes drawn
    return rec["posts"] * 3 + rec["comments"] + rec["likes_received"] * 0.2


def build_network(run_dir, max_nodes: int = DEFAULT_MAX_NODES) -> dict:
    feed = build_feed(Path(run_dir))
    posts = feed.get("posts", [])

    agents: dict[str, dict] = {}
    edges: dict[tuple[str, str], int] = {}

    def ensure(author: dict):
        uid = (author or {}).get("agent_uid")
        if not uid:
            return None
        rec = agents.get(uid)
        if rec is None:
            rec = {
                "agent_uid": uid,
                "name": author.get("name") or author.get("username") or uid,
                "faction": author.get("faction"),
                "tier": author.get("tier") or "unknown",
                "protagonist": bool(author.get("protagonist")),
                "posts": 0,
                "comments": 0,
                "likes_received": 0,
            }
            agents[uid] = rec
        return rec

    for post in posts:
        author = post.get("author") or {}
        prec = ensure(author)
        if prec is not None:
            prec["posts"] += 1
            prec["likes_received"] += int(post.get("num_likes") or 0)
        post_uid = author.get("agent_uid")
        for comment in post.get("comments") or []:
            cauthor = comment.get("author") or {}
            crec = ensure(cauthor)
            if crec is not None:
                crec["comments"] += 1
                crec["likes_received"] += int(comment.get("num_likes") or 0)
            comment_uid = cauthor.get("agent_uid")
            if comment_uid and post_uid and comment_uid != post_uid:
                key = (comment_uid, post_uid)
                edges[key] = edges.get(key, 0) + 1

    for rec in agents.values():
        rec["engagement"] = round(_engagement(rec), 1)

    # keep protagonists first, then the most-engaged, up to the cap
    ordered = sorted(
        agents.values(),
        key=lambda r: (0 if r["protagonist"] else 1, -r["engagement"]),
    )
    selected = ordered[:max(1, max_nodes)] if ordered else []
    keep = {r["agent_uid"] for r in selected}

    net_edges = [
        {"source": s, "target": t, "weight": w}
        for (s, t), w in edges.items()
        if s in keep and t in keep
    ]
    net_edges.sort(key=lambda e: (-e["weight"], e["source"], e["target"]))
    return {"nodes": selected, "edges": net_edges}
