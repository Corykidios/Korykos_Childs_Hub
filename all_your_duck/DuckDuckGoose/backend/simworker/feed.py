"""Feed reading + policy-descriptor -> ManualAction mapping.

The action whitelist is enforced HERE: perform_action_by_data bypasses
available_actions inside OASIS (spike §1b), so this module is the gate.
Out-of-platform actions degrade to LIKE_POST with degraded=True.

Action-arg names VERIFIED from oasis/social_agent/agent_action.py (see
simworker.graphbuild docstring): create_post(content), like_post(post_id),
repost(post_id), create_comment(post_id, content)."""

import json
import sqlite3
from pathlib import Path

from oasis import ActionType, ManualAction


def _connect(db_path: Path) -> sqlite3.Connection | None:
    if not Path(db_path).exists():
        return None
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def recent_posts(db_path: Path, limit: int = 30) -> list[dict]:
    conn = _connect(db_path)
    if conn is None:
        return []
    try:
        rows = conn.execute(
            "SELECT post_id, user_id, content FROM post"
            " ORDER BY post_id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()


def trace_rows_since(db_path: Path, last_rowid: int):
    conn = _connect(db_path)
    if conn is None:
        return [], last_rowid
    try:
        rows = conn.execute(
            "SELECT rowid, user_id, action, info FROM trace WHERE rowid > ?"
            " ORDER BY rowid",
            (last_rowid,),
        ).fetchall()
    except sqlite3.OperationalError:
        return [], last_rowid
    finally:
        conn.close()
    out = []
    new_last = last_rowid
    for r in rows:
        new_last = r["rowid"]
        info = r["info"]
        try:
            info = json.loads(info) if isinstance(info, str) else info
        except json.JSONDecodeError:
            pass
        out.append({"rowid": r["rowid"], "user_id": r["user_id"],
                    "action": r["action"], "info": info})
    return out, new_last


_PLATFORM_KINDS = {
    "twitter": {"post", "like", "repost"},
    "reddit": {"post", "like", "comment"},
}


def descriptor_to_manual_action(descriptor: dict, platform: str):
    kind = descriptor["kind"]
    degraded = bool(descriptor.get("degraded"))
    if kind not in _PLATFORM_KINDS.get(platform, set()):
        return (
            ManualAction(
                action_type=ActionType.LIKE_POST,
                action_args={"post_id": descriptor.get("target_post_id") or 1},
            ),
            True,
        )
    if kind == "post":
        return (
            ManualAction(
                action_type=ActionType.CREATE_POST,
                action_args={"content": descriptor.get("content") or ""},
            ),
            degraded,
        )
    if kind == "comment":
        return (
            ManualAction(
                action_type=ActionType.CREATE_COMMENT,
                action_args={
                    "post_id": descriptor.get("target_post_id") or 1,
                    "content": descriptor.get("content") or "",
                },
            ),
            degraded,
        )
    if kind == "repost":
        return (
            ManualAction(
                action_type=ActionType.REPOST,
                action_args={"post_id": descriptor.get("target_post_id") or 1},
            ),
            degraded,
        )
    return (
        ManualAction(
            action_type=ActionType.LIKE_POST,
            action_args={"post_id": descriptor.get("target_post_id") or 1},
        ),
        degraded,
    )
