"""Reply-network service.

build_network reconstructs "who talked to whom" — a directed edge from a
commenter to the author of the post they replied to — from the cached feed, so
no extra DB read. Nodes are weighted by engagement and capped (protagonists
first) so the result is a legible graph, not a 2,500-node hairball.
"""

import json
import sqlite3

from app.services.network import build_network
from simworker.events import EventWriter


def _run(tmp_path, protagonists, posts, comments):
    (tmp_path / "run.json").write_text(
        json.dumps({"run_id": "run_net", "platform": "reddit"}), encoding="utf-8")
    agents = [
        {"agent_uid": f"agent_{i}", "tier": "protagonist" if uid in protagonists else "crowd_llm",
         "name": name, "username": f"u{i}", "faction": fac}
        for i, (uid, name, fac) in enumerate(
            [("agent_0", "Ada", "pro-reopening"), ("agent_1", "Ben", "hardline-closure"),
             ("agent_2", "Cy", "neutral")])
    ]
    (tmp_path / "population.json").write_text(json.dumps({
        "protagonist_uids": list(protagonists), "agents": agents,
    }), encoding="utf-8")
    (tmp_path / "export_mapping.json").write_text(json.dumps({
        "uid_to_position": {"agent_0": 0, "agent_1": 1, "agent_2": 2},
    }), encoding="utf-8")
    w = EventWriter(tmp_path)
    for pid, uid in posts:
        w.emit("action", round=0, platform="reddit", agent_uid=uid,
               action_type="create_post", info={"content": "p", "post_id": pid})
    for cid, uid in comments:
        w.emit("action", round=0, platform="reddit", agent_uid=uid,
               action_type="create_comment", info={"content": "c", "comment_id": cid})

    conn = sqlite3.connect(tmp_path / "reddit_simulation.db")
    conn.execute("CREATE TABLE post (post_id INTEGER PRIMARY KEY, user_id INTEGER,"
                 " content TEXT, num_likes INTEGER DEFAULT 0, num_dislikes INTEGER DEFAULT 0)")
    conn.execute("CREATE TABLE comment (comment_id INTEGER PRIMARY KEY, post_id INTEGER,"
                 " user_id INTEGER, content TEXT, num_likes INTEGER DEFAULT 0,"
                 " num_dislikes INTEGER DEFAULT 0)")
    for pid, pos in posts:
        conn.execute("INSERT INTO post (post_id, user_id, content, num_likes) VALUES (?,?,?,?)",
                     (pid, int(pos.split('_')[1]), "p", 5))
    # comments: (comment_id, post_id, commenter_pos)
    for cid, post_id, pos in comments_meta(comments):
        conn.execute("INSERT INTO comment (comment_id, post_id, user_id, content) VALUES (?,?,?,?)",
                     (cid, post_id, int(pos.split('_')[1]), "c"))
    conn.commit()
    conn.close()
    return tmp_path


def comments_meta(comments):
    # the test supplies (comment_id, commenter_uid); they all reply to post 1
    return [(cid, 1, uid) for cid, uid in comments]


def test_build_network_edges_commenter_to_post_author(tmp_path):
    # agent_0 posts (post 1); agent_1 comments twice; agent_2 comments once
    rd = _run(
        tmp_path,
        protagonists=["agent_0", "agent_1"],
        posts=[(1, "agent_0")],
        comments=[(1, "agent_1"), (2, "agent_1"), (3, "agent_2")],
    )
    net = build_network(rd)
    by_uid = {n["agent_uid"]: n for n in net["nodes"]}
    assert by_uid["agent_0"]["posts"] == 1
    assert by_uid["agent_1"]["comments"] == 2
    # directed edge: commenter -> post author, weighted by reply count
    e = {(x["source"], x["target"]): x["weight"] for x in net["edges"]}
    assert e[("agent_1", "agent_0")] == 2
    assert e[("agent_2", "agent_0")] == 1
    # no self-edges
    assert all(x["source"] != x["target"] for x in net["edges"])


def test_build_network_caps_nodes_protagonists_first(tmp_path):
    rd = _run(
        tmp_path,
        protagonists=["agent_0"],
        posts=[(1, "agent_0")],
        comments=[(1, "agent_1"), (2, "agent_2")],
    )
    net = build_network(rd, max_nodes=2)
    assert len(net["nodes"]) == 2
    # the protagonist is always kept
    assert any(n["agent_uid"] == "agent_0" and n["protagonist"] for n in net["nodes"])
    # edges only connect kept nodes
    keep = {n["agent_uid"] for n in net["nodes"]}
    assert all(x["source"] in keep and x["target"] in keep for x in net["edges"])


def test_build_network_missing_db_empty(tmp_path):
    (tmp_path / "run.json").write_text(
        json.dumps({"platform": "reddit"}), encoding="utf-8")
    EventWriter(tmp_path).emit("round_started", round=0)
    net = build_network(tmp_path)
    assert net == {"nodes": [], "edges": []}
