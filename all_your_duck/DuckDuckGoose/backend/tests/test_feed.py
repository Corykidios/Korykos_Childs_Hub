"""Story-feed service tests.

build_feed assembles a threaded, round-tagged social feed from the three
run artifacts a feed needs but no single one carries alone:
  - reddit_simulation.db  -> post/comment bodies, the comment->post thread
    link, and engagement counts (the DB is the ONLY source of the comment's
    parent post_id; the create_comment event omits it).
  - events.jsonl          -> the authoritative `round` each post/comment was
    authored in (the DB has no round column) + global `seq` creation order.
  - population.json + export_mapping.json -> author cards (name, tier,
    faction) resolved from the DB user_id == export position.

Fixtures build a tiny self-contained run dir (same shape as the real one).
"""

import json
import sqlite3

import pytest

from app.services.feed import FEED_SCHEMA, build_feed
from simworker.events import EventWriter


def _make_db(path, posts, comments):
    """Flexible OASIS-shaped db. posts/comments are dicts; absent keys -> NULL,
    matching the real schema (post carries original_post_id + quote_content)."""
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE post (post_id INTEGER PRIMARY KEY, user_id INTEGER,"
        " original_post_id INTEGER, content TEXT, quote_content TEXT,"
        " created_at TEXT, num_likes INTEGER, num_dislikes INTEGER)"
    )
    conn.execute(
        "CREATE TABLE comment (comment_id INTEGER PRIMARY KEY, post_id INTEGER,"
        " user_id INTEGER, content TEXT, created_at TEXT,"
        " num_likes INTEGER, num_dislikes INTEGER)"
    )
    for p in posts:
        conn.execute(
            "INSERT INTO post (post_id, user_id, original_post_id, content,"
            " quote_content, num_likes, num_dislikes) VALUES (?,?,?,?,?,?,?)",
            (p["post_id"], p.get("user_id"), p.get("original_post_id"),
             p.get("content"), p.get("quote_content"),
             p.get("num_likes"), p.get("num_dislikes")),
        )
    for c in comments:
        conn.execute(
            "INSERT INTO comment (comment_id, post_id, user_id, content,"
            " num_likes, num_dislikes) VALUES (?,?,?,?,?,?)",
            (c["comment_id"], c.get("post_id"), c.get("user_id"),
             c.get("content"), c.get("num_likes"), c.get("num_dislikes")),
        )
    conn.commit()
    conn.close()


def _make_reddit_db(path, posts, comments):
    """posts: (post_id, user_id, content, num_likes, num_dislikes).
    comments: (comment_id, post_id, user_id, content, num_likes, num_dislikes)."""
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE post (post_id INTEGER PRIMARY KEY, user_id INTEGER,"
        " content TEXT, created_at TEXT, num_likes INTEGER DEFAULT 0,"
        " num_dislikes INTEGER DEFAULT 0)"
    )
    conn.execute(
        "CREATE TABLE comment (comment_id INTEGER PRIMARY KEY, post_id INTEGER,"
        " user_id INTEGER, content TEXT, created_at TEXT,"
        " num_likes INTEGER DEFAULT 0, num_dislikes INTEGER DEFAULT 0)"
    )
    conn.executemany(
        "INSERT INTO post (post_id, user_id, content, num_likes, num_dislikes)"
        " VALUES (?,?,?,?,?)", posts,
    )
    conn.executemany(
        "INSERT INTO comment (comment_id, post_id, user_id, content,"
        " num_likes, num_dislikes) VALUES (?,?,?,?,?,?)", comments,
    )
    conn.commit()
    conn.close()


@pytest.fixture
def run_dir(tmp_path):
    """Finished reddit run: 2 posts (round 0 + round 2), 2 comments threaded
    under post 1 (rounds 1 and 3). Position 0 = protagonist Alice,
    position 1 = crowd Cara; position 9 is an author with NO population row."""
    (tmp_path / "run.json").write_text(json.dumps({
        "run_id": "run_feedtest001", "platform": "reddit", "rounds": 4,
        "seed": 1,
    }), encoding="utf-8")
    (tmp_path / "population.json").write_text(json.dumps({
        "protagonist_uids": ["agent_alice"],
        "agents": [
            {"agent_uid": "agent_alice", "tier": "protagonist",
             "name": "Alice Powell", "username": "alice_p",
             "faction": "pro-reopening", "kind": "entity",
             "country": "United States", "profession": "President"},
            {"agent_uid": "agent_cara", "tier": "crowd_llm",
             "name": "Cara Crowd", "username": "cara_c",
             "faction": "hardline-closure", "kind": "public"},
        ],
    }), encoding="utf-8")
    (tmp_path / "export_mapping.json").write_text(json.dumps({
        "uid_to_position": {"agent_alice": 0, "agent_cara": 1},
    }), encoding="utf-8")

    w = EventWriter(tmp_path)
    w.emit("round_started", round=0)
    w.emit("action", round=0, agent_uid="agent_alice",
           action_type="create_post",
           info={"content": "The strait stays shut.", "post_id": 1})
    w.emit("round_finished", round=0, actions_taken=1)
    w.emit("round_started", round=1)
    w.emit("action", round=1, agent_uid="agent_cara",
           action_type="create_comment",
           info={"content": "Agreed, hold the line.", "comment_id": 1})
    w.emit("round_finished", round=1, actions_taken=1)
    w.emit("round_started", round=2)
    w.emit("action", round=2, agent_uid="agent_cara",
           action_type="create_post",
           info={"content": "Markets are calm today.", "post_id": 2})
    w.emit("round_finished", round=2, actions_taken=1)
    w.emit("round_started", round=3)
    # comment_id 2 authored by an unmapped position 9 (no population row)
    w.emit("action", round=3, agent_uid="agent_ghost",
           action_type="create_comment",
           info={"content": "Who is this even?", "comment_id": 2})
    w.emit("round_finished", round=3, actions_taken=1)
    w.emit("sim_finished", stopped=False)

    _make_reddit_db(
        tmp_path / "reddit_simulation.db",
        posts=[
            (1, 0, "The strait stays shut.", 9, 1),
            (2, 1, "Markets are calm today.", 2, 0),
        ],
        comments=[
            (1, 1, 1, "Agreed, hold the line.", 3, 0),
            (2, 1, 9, "Who is this even?", 0, 0),
        ],
    )
    return tmp_path


def test_build_feed_threads_comments_under_their_parent_post(run_dir):
    feed = build_feed(run_dir)
    posts = {p["post_id"]: p for p in feed["posts"]}
    assert set(posts) == {1, 2}
    # both comments hang off post 1 (comment.post_id == 1), none off post 2
    assert [c["comment_id"] for c in posts[1]["comments"]] == [1, 2]
    assert posts[2]["comments"] == []


def test_build_feed_resolves_author_cards_from_population(run_dir):
    feed = build_feed(run_dir)
    post1 = next(p for p in feed["posts"] if p["post_id"] == 1)
    author = post1["author"]
    assert author["name"] == "Alice Powell"
    assert author["username"] == "alice_p"
    assert author["tier"] == "protagonist"
    assert author["faction"] == "pro-reopening"
    assert author["protagonist"] is True


def test_build_feed_tags_posts_and_comments_with_their_round(run_dir):
    feed = build_feed(run_dir)
    posts = {p["post_id"]: p for p in feed["posts"]}
    assert posts[1]["round"] == 0
    assert posts[2]["round"] == 2
    assert posts[1]["comments"][0]["round"] == 1  # comment_id 1
    assert posts[1]["comments"][1]["round"] == 3  # comment_id 2
    assert feed["max_round"] == 3


def test_build_feed_computes_score_as_likes_minus_dislikes(run_dir):
    feed = build_feed(run_dir)
    post1 = next(p for p in feed["posts"] if p["post_id"] == 1)
    assert post1["num_likes"] == 9 and post1["num_dislikes"] == 1
    assert post1["score"] == 8
    assert post1["comments"][0]["score"] == 3


def test_build_feed_orders_posts_by_creation_seq(run_dir):
    feed = build_feed(run_dir)
    assert [p["post_id"] for p in feed["posts"]] == [1, 2]


def test_build_feed_falls_back_for_author_without_population_row(run_dir):
    feed = build_feed(run_dir)
    post1 = next(p for p in feed["posts"] if p["post_id"] == 1)
    ghost = post1["comments"][1]["author"]  # comment_id 2, position 9
    assert ghost["username"] == "user_9"
    assert ghost["tier"] == "unknown"
    assert ghost["protagonist"] is False


def test_build_feed_missing_db_returns_empty_posts(tmp_path):
    (tmp_path / "run.json").write_text(
        json.dumps({"platform": "reddit"}), encoding="utf-8")
    w = EventWriter(tmp_path)
    w.emit("round_started", round=0)
    w.emit("round_finished", round=0, actions_taken=0)
    feed = build_feed(tmp_path)
    assert feed["posts"] == []
    assert feed["platform"] == "reddit"
    assert feed["max_round"] == 0


def test_build_feed_caches_to_disk_and_reuses(run_dir):
    feed1 = build_feed(run_dir)
    cache = run_dir / "feed.json"
    assert cache.exists()
    # second call returns identical content (served from / consistent with cache)
    feed2 = build_feed(run_dir)
    assert feed1 == feed2


def test_build_feed_rebuilds_when_db_grows(run_dir):
    """A live run keeps writing to the db; a feed cached before the new rows
    must not be served stale once the db is newer than the cache."""
    import os

    build_feed(run_dir)  # warm the cache
    db = run_dir / "reddit_simulation.db"
    conn = sqlite3.connect(db)
    conn.execute(
        "INSERT INTO post (post_id, user_id, content, num_likes, num_dislikes)"
        " VALUES (3, 0, 'A late breaking post.', 0, 0)"
    )
    conn.commit()
    conn.close()
    # force the db strictly newer than the cache (coarse mtime resolution safe)
    cache_mtime = (run_dir / "feed.json").stat().st_mtime
    os.utime(db, (cache_mtime + 10, cache_mtime + 10))

    feed = build_feed(run_dir)
    assert 3 in {p["post_id"] for p in feed["posts"]}


# --- twitter actions: repost / quote_post (their post id is `new_post_id`) ---


def _twitter_run(tmp_path):
    (tmp_path / "run.json").write_text(json.dumps({
        "run_id": "run_tw", "platform": "twitter", "rounds": 3,
    }), encoding="utf-8")
    (tmp_path / "population.json").write_text(json.dumps({
        "protagonist_uids": ["agent_a"],
        "agents": [{"agent_uid": "agent_a", "tier": "protagonist",
                    "name": "Ada", "username": "ada_a", "faction": "neutral"}],
    }), encoding="utf-8")
    (tmp_path / "export_mapping.json").write_text(json.dumps({
        "uid_to_position": {"agent_a": 0},
    }), encoding="utf-8")
    return tmp_path


def test_build_feed_indexes_repost_and_quote_post_by_new_post_id(tmp_path):
    """quote_post/repost insert real post rows but record the new id under
    `new_post_id` with action_type quote_post/repost — they must still get a
    round/seq (else they are invisible in playback and sort to the bottom)."""
    rd = _twitter_run(tmp_path)
    w = EventWriter(rd)
    w.emit("round_started", round=0)
    w.emit("action", round=0, platform="twitter", agent_uid="agent_a",
           action_type="create_post",
           info={"content": "Original take.", "post_id": 1})
    w.emit("round_started", round=1)
    w.emit("action", round=1, platform="twitter", agent_uid="agent_a",
           action_type="quote_post",
           info={"quoted_id": 1, "new_post_id": 2})
    w.emit("round_started", round=2)
    w.emit("action", round=2, platform="twitter", agent_uid="agent_a",
           action_type="repost", info={"reposted_id": 1, "new_post_id": 3})
    w.emit("sim_finished", stopped=False)

    _make_db(rd / "twitter_simulation.db", posts=[
        {"post_id": 1, "user_id": 0, "content": "Original take.",
         "num_likes": 2, "num_dislikes": 0},
        # quote: OASIS copies original into content, quoter's words in quote_content
        {"post_id": 2, "user_id": 0, "content": "Original take.",
         "quote_content": "My hot take on this.", "num_likes": 1},
        # repost: empty content, original_post_id set
        {"post_id": 3, "user_id": 0, "original_post_id": 1, "content": ""},
    ], comments=[])

    feed = build_feed(rd)
    by_id = {p["post_id"]: p for p in feed["posts"]}
    assert by_id[2]["round"] == 1 and by_id[3]["round"] == 2
    # chronological order preserved (all have a real seq now)
    assert [p["post_id"] for p in feed["posts"]] == [1, 2, 3]
    assert feed["max_round"] == 2


def test_build_feed_quote_post_shows_quoter_words_not_the_original(tmp_path):
    rd = _twitter_run(tmp_path)
    w = EventWriter(rd)
    w.emit("round_started", round=0)
    w.emit("action", round=0, platform="twitter", agent_uid="agent_a",
           action_type="quote_post", info={"quoted_id": 9, "new_post_id": 1})
    _make_db(rd / "twitter_simulation.db", posts=[
        {"post_id": 1, "user_id": 0, "content": "the copied original",
         "quote_content": "the quoter's actual remark", "num_likes": 0},
    ], comments=[])
    post = build_feed(rd)["posts"][0]
    assert post["kind"] == "quote"
    assert post["content"] == "the quoter's actual remark"
    assert post["quoted_content"] == "the copied original"


def test_build_feed_namespaces_ids_across_both_platforms(tmp_path):
    """twitter and reddit dbs both autoincrement ids from 1; a 'both' run must
    not thread reddit's comment onto twitter's post-of-the-same-id."""
    (tmp_path / "run.json").write_text(json.dumps({
        "run_id": "run_both", "platform": "both", "rounds": 1,
    }), encoding="utf-8")
    (tmp_path / "population.json").write_text(json.dumps({
        "protagonist_uids": [],
        "agents": [
            {"agent_uid": "agent_a", "tier": "crowd_llm", "username": "a_user"},
            {"agent_uid": "agent_b", "tier": "crowd_llm", "username": "b_user"},
        ],
    }), encoding="utf-8")
    (tmp_path / "export_mapping.json").write_text(json.dumps({
        "uid_to_position": {"agent_a": 0, "agent_b": 1},
    }), encoding="utf-8")
    w = EventWriter(tmp_path)
    w.emit("round_started", round=0)
    w.emit("action", round=0, platform="twitter", agent_uid="agent_a",
           action_type="create_post", info={"content": "TW post", "post_id": 1})
    w.emit("action", round=0, platform="twitter", agent_uid="agent_b",
           action_type="create_comment",
           info={"content": "TW reply", "comment_id": 1})
    w.emit("action", round=0, platform="reddit", agent_uid="agent_a",
           action_type="create_post", info={"content": "RD post", "post_id": 1})
    w.emit("action", round=0, platform="reddit", agent_uid="agent_b",
           action_type="create_comment",
           info={"content": "RD reply", "comment_id": 1})
    w.emit("sim_finished", stopped=False)

    _make_db(tmp_path / "twitter_simulation.db",
             posts=[{"post_id": 1, "user_id": 0, "content": "TW post"}],
             comments=[{"comment_id": 1, "post_id": 1, "user_id": 1,
                        "content": "TW reply"}])
    _make_db(tmp_path / "reddit_simulation.db",
             posts=[{"post_id": 1, "user_id": 0, "content": "RD post"}],
             comments=[{"comment_id": 1, "post_id": 1, "user_id": 1,
                        "content": "RD reply"}])

    feed = build_feed(tmp_path)
    assert len(feed["posts"]) == 2
    by_platform = {p["platform"]: p for p in feed["posts"]}
    assert set(by_platform) == {"twitter", "reddit"}
    # each post carries ONLY its own platform's single comment — no cross-bleed
    tw, rd = by_platform["twitter"], by_platform["reddit"]
    assert [c["content"] for c in tw["comments"]] == ["TW reply"]
    assert [c["content"] for c in rd["comments"]] == ["RD reply"]


def test_build_feed_drops_comment_with_no_parent_post(run_dir):
    """An orphan comment (post_id matching no post) is dropped, not crashed on."""
    conn = sqlite3.connect(run_dir / "reddit_simulation.db")
    conn.execute(
        "INSERT INTO comment (comment_id, post_id, user_id, content,"
        " num_likes, num_dislikes) VALUES (99, 404, 1, 'orphan', 0, 0)"
    )
    conn.commit()
    conn.close()
    (run_dir / "feed.json").unlink(missing_ok=True)
    feed = build_feed(run_dir)
    all_comment_ids = {c["comment_id"] for p in feed["posts"] for c in p["comments"]}
    assert 99 not in all_comment_ids
    assert {p["post_id"] for p in feed["posts"]} == {1, 2}


def test_build_feed_coerces_null_engagement_counts(tmp_path):
    (tmp_path / "run.json").write_text(
        json.dumps({"platform": "reddit"}), encoding="utf-8")
    w = EventWriter(tmp_path)
    w.emit("action", round=0, platform="reddit", agent_uid="agent_a",
           action_type="create_post", info={"content": "x", "post_id": 1})
    (tmp_path / "export_mapping.json").write_text(
        json.dumps({"uid_to_position": {"agent_a": 0}}), encoding="utf-8")
    _make_db(tmp_path / "reddit_simulation.db",
             posts=[{"post_id": 1, "user_id": 0, "content": "x"}],  # NULL counts
             comments=[])
    post = build_feed(tmp_path)["posts"][0]
    assert post["num_likes"] == 0 and post["num_dislikes"] == 0
    assert post["score"] == 0


def test_build_feed_serves_cached_bytes_without_reassembling(run_dir):
    """Prove the cache-HIT branch returns the stored bytes, not a re-assembly:
    overwrite feed.json with a sentinel and confirm it comes back."""
    import os

    build_feed(run_dir)  # warm
    cache = run_dir / "feed.json"
    sentinel = {"schema": FEED_SCHEMA, "posts": [], "max_round": 7,
                "platform": "reddit", "run_id": "SENTINEL"}
    cache.write_text(json.dumps(sentinel), encoding="utf-8")
    # keep the cache strictly newest so the gate serves it
    newest = max(
        (run_dir / "events.jsonl").stat().st_mtime,
        (run_dir / "reddit_simulation.db").stat().st_mtime,
    )
    os.utime(cache, (newest + 10, newest + 10))
    assert build_feed(run_dir)["run_id"] == "SENTINEL"


def test_build_feed_rebuilds_on_schema_version_change(run_dir):
    """A cache written by an older feed schema must be ignored, not served."""
    import os

    build_feed(run_dir)
    cache = run_dir / "feed.json"
    cache.write_text(json.dumps(
        {"schema": FEED_SCHEMA - 1, "posts": [], "run_id": "STALE"}
    ), encoding="utf-8")
    newest = max(
        (run_dir / "events.jsonl").stat().st_mtime,
        (run_dir / "reddit_simulation.db").stat().st_mtime,
    )
    os.utime(cache, (newest + 10, newest + 10))
    feed = build_feed(run_dir)
    assert feed["run_id"] != "STALE"
    assert {p["post_id"] for p in feed["posts"]} == {1, 2}
