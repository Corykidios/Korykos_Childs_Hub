import json
import sqlite3

import pytest

from oasis import ActionType

from simworker.feed import (
    descriptor_to_manual_action,
    recent_posts,
    trace_rows_since,
)


@pytest.fixture
def db(tmp_path):
    path = tmp_path / "sim.db"
    conn = sqlite3.connect(path)
    conn.execute(
        "CREATE TABLE post (post_id INTEGER PRIMARY KEY, user_id INTEGER,"
        " content TEXT, created_at TEXT, num_likes INTEGER DEFAULT 0,"
        " num_dislikes INTEGER DEFAULT 0)"
    )
    conn.execute(
        "CREATE TABLE trace (user_id INTEGER, created_at TEXT, action TEXT,"
        " info TEXT)"
    )
    for i in range(5):
        conn.execute(
            "INSERT INTO post (user_id, content, created_at) VALUES (?,?,?)",
            (i, f"post number {i}", f"2026-01-0{i + 1}"),
        )
    conn.execute(
        "INSERT INTO trace VALUES (1, 't', 'create_post',"
        " '{\"content\": \"hi\"}')"
    )
    conn.commit()
    conn.close()
    return path


def test_recent_posts_newest_first_with_limit(db):
    posts = recent_posts(db, limit=3)
    assert len(posts) == 3
    assert posts[0]["post_id"] > posts[-1]["post_id"]
    assert {"post_id", "user_id", "content"} <= set(posts[0])


def test_recent_posts_missing_db_or_table(tmp_path):
    assert recent_posts(tmp_path / "absent.db") == []


def test_trace_rows_since(db):
    rows, last = trace_rows_since(db, 0)
    assert len(rows) == 1
    assert rows[0]["action"] == "create_post"
    again, last2 = trace_rows_since(db, last)
    assert again == [] and last2 == last


def test_post_descriptor_maps_to_create_post():
    action, degraded = descriptor_to_manual_action(
        {"kind": "post", "content": "hello", "target_post_id": None,
         "topic": "t", "rule_index": 0, "degraded": False},
        "reddit",
    )
    assert action.action_type == ActionType.CREATE_POST
    assert action.action_args["content"] == "hello"
    assert degraded is False


def test_comment_on_twitter_degrades_to_like():
    action, degraded = descriptor_to_manual_action(
        {"kind": "comment", "content": "c", "target_post_id": 7,
         "topic": "t", "rule_index": 0, "degraded": False},
        "twitter",
    )
    assert action.action_type == ActionType.LIKE_POST
    assert action.action_args["post_id"] == 7
    assert degraded is True


def test_comment_on_reddit_allowed():
    action, degraded = descriptor_to_manual_action(
        {"kind": "comment", "content": "c", "target_post_id": 7,
         "topic": "t", "rule_index": 0, "degraded": False},
        "reddit",
    )
    assert action.action_type == ActionType.CREATE_COMMENT
    assert degraded is False


def test_repost_on_reddit_degrades_to_like():
    action, degraded = descriptor_to_manual_action(
        {"kind": "repost", "content": None, "target_post_id": 3,
         "topic": "t", "rule_index": 0, "degraded": False},
        "reddit",
    )
    assert action.action_type == ActionType.LIKE_POST and degraded is True
