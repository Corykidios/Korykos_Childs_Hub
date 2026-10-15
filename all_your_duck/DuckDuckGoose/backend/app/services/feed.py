"""Story-feed assembly: a threaded, round-tagged social
feed for the StoryFeedView — render-ready so the Vue view stays dumb.

No single artifact carries everything a threaded feed needs, so this joins
three:
  - ``<platform>_simulation.db`` — post/comment bodies, engagement counts, and
    the comment->post thread link (``comment.post_id``). The DB is the ONLY
    source of that parent link: the ``create_comment`` event omits it.
  - ``events.jsonl`` — the authoritative ``round`` each post/comment was
    authored in (the DB has no round column) and the global ``seq`` creation
    order used to lay the feed out chronologically. Posts arrive as
    ``create_post`` (id under ``post_id``) AND as ``quote_post``/``repost``
    (id under ``new_post_id``) — all three are real rows in the ``post`` table.
  - ``population.json`` + ``export_mapping.json`` — author cards (name, tier,
    faction, protagonist flag), resolved on the verified identity
    ``DB user_id == export position`` (same bridge report.py uses).

A ``both``-platform run has two dbs whose post_id/comment_id both autoincrement
from 1, so ids collide across platforms; nodes are therefore namespaced by
platform (single-platform runs key on the bare id, which is robust to events
that omit the platform field). The result is cached to ``feed.json``,
mtime-gated against ``events.jsonl`` and the run db(s) AND version-gated on
``FEED_SCHEMA`` (a structure change invalidates an old cache).
"""

import json
import sqlite3
from pathlib import Path

from simworker.events import EVENTS_FILE, EventReader

FEED_CACHE = "feed.json"
FEED_SCHEMA = 2  # bump when the feed payload shape changes (invalidates caches)

_COMMENT_ACTION = "create_comment"
# every action that inserts a row into the `post` table
_POST_ACTIONS = {"create_post", "quote_post", "repost"}


def _load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return default


def _db_rows(db_path: Path, query: str) -> list[dict]:
    """Read rows from an OASIS run db. Missing db/table -> [] (same tolerant
    pattern as report.top_posts). ``SELECT *`` keeps this robust to schema
    variation — optional columns are read defensively via dict.get."""
    if not Path(db_path).exists():
        return []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        return [dict(r) for r in conn.execute(query).fetchall()]
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()


def _key(platform, node_id, multi):
    """Namespace a node id by platform only when more than one platform's db is
    read (a 'both' run). Single-platform runs key on the bare id, which also
    tolerates events that omit the platform field."""
    return (platform, node_id) if multi else node_id


def _round_index(run_dir: Path, multi: bool) -> tuple[dict, dict, int]:
    """Walk events once: map each post/comment to {round, seq[, action_type]}
    and find the highest round seen. Posts arrive under either ``post_id``
    (create_post) or ``new_post_id`` (quote_post/repost)."""
    post_meta: dict = {}
    comment_meta: dict = {}
    max_round = -1
    for ev in EventReader(run_dir).read_from(0):
        rnd = ev.get("round")
        if isinstance(rnd, int) and not isinstance(rnd, bool) and rnd > max_round:
            max_round = rnd
        if ev.get("kind") != "action":
            continue
        info = ev.get("info")
        if not isinstance(info, dict):
            continue
        action = ev.get("action_type")
        platform = ev.get("platform") or ""
        meta = {"round": rnd, "seq": ev.get("seq")}
        if action == _COMMENT_ACTION and isinstance(info.get("comment_id"), int):
            comment_meta[_key(platform, info["comment_id"], multi)] = meta
        elif action in _POST_ACTIONS:
            pid = info.get("post_id")
            if not isinstance(pid, int) or isinstance(pid, bool):
                pid = info.get("new_post_id")
            if isinstance(pid, int) and not isinstance(pid, bool):
                post_meta[_key(platform, pid, multi)] = {
                    **meta, "action_type": action,
                }
    return post_meta, comment_meta, max_round


def _author_resolver(run_dir: Path, population: dict):
    """position (DB user_id) -> author card, via the verified bridge
    ``export_mapping.uid_to_position`` inverted then population by uid. Authors
    with no population row degrade to a ``user_<pos>`` card (mirrors report.py)
    rather than vanishing."""
    mapping = _load_json(run_dir / "export_mapping.json", {})
    pos_to_uid = {
        pos: uid
        for uid, pos in (mapping.get("uid_to_position") or {}).items()
        if isinstance(pos, int) and not isinstance(pos, bool)
    }
    agent_by_uid = {a.get("agent_uid"): a for a in population.get("agents", [])}
    protagonist_uids = set(population.get("protagonist_uids") or [])

    def resolve(position) -> dict:
        uid = pos_to_uid.get(position)
        agent = agent_by_uid.get(uid) or {}
        return {
            "agent_uid": uid,
            "name": agent.get("name"),
            "username": agent.get("username") or f"user_{position}",
            "tier": agent.get("tier") or "unknown",
            "faction": agent.get("faction") or None,
            "kind": agent.get("kind"),
            "country": agent.get("country"),
            "profession": agent.get("profession"),
            "protagonist": uid in protagonist_uids,
        }

    return resolve


def _platforms(run_dir: Path) -> tuple[str, tuple[str, ...]]:
    platform = _load_json(run_dir / "run.json", {}).get("platform") or "reddit"
    if platform == "both":
        return platform, ("twitter", "reddit")
    return platform, (platform,)


def _counts(row: dict) -> tuple[int, int]:
    return int(row.get("num_likes") or 0), int(row.get("num_dislikes") or 0)


def _comment_node(platform: str, row: dict, meta: dict, author: dict) -> dict:
    likes, dislikes = _counts(row)
    return {
        "comment_id": row["comment_id"],
        "platform": platform,
        "round": meta.get("round"),
        "seq": meta.get("seq"),
        "author": author,
        "content": row.get("content") or "",
        "num_likes": likes,
        "num_dislikes": dislikes,
        "score": likes - dislikes,
    }


def _post_node(platform, row, meta, author, content_by_post, multi) -> dict:
    """Build a post node. ``kind`` distinguishes original / quote / repost so
    the feed attributes text honestly: a quote_post shows the QUOTER'S words
    (``quote_content``), not the copied original; a repost has no words of its
    own and references the source. Driven off the engine-emitted action_type
    (reliable) rather than guessing from db columns."""
    likes, dislikes = _counts(row)
    action = meta.get("action_type") or "create_post"
    content = row.get("content") or ""
    quote = row.get("quote_content")
    node = {
        "post_id": row["post_id"],
        "platform": platform,
        "round": meta.get("round"),
        "seq": meta.get("seq"),
        "author": author,
        "content": content,
        "kind": "post",
        "quoted_content": None,
        "num_likes": likes,
        "num_dislikes": dislikes,
        "score": likes - dislikes,
    }
    if action == "quote_post":
        node["kind"] = "quote"
        if isinstance(quote, str) and quote.strip():
            node["content"] = quote          # the quoter's actual remark
            node["quoted_content"] = content  # OASIS copies the original here
    elif action == "repost":
        node["kind"] = "repost"
        node["content"] = ""  # a repost adds no words of its own
        orig = row.get("original_post_id")
        if isinstance(orig, int):
            node["quoted_content"] = content_by_post.get(_key(platform, orig, multi))
    return node


def _assemble(run_dir: Path) -> dict:
    population = _load_json(run_dir / "population.json", {})
    resolve = _author_resolver(run_dir, population)
    platform, platforms = _platforms(run_dir)
    multi = len(platforms) > 1
    post_meta, comment_meta, max_round = _round_index(run_dir, multi)

    # rows tagged with their source platform
    post_rows: list[tuple[str, dict]] = []
    comment_rows: list[tuple[str, dict]] = []
    for p in platforms:
        db = run_dir / f"{p}_simulation.db"
        post_rows.extend((p, r) for r in _db_rows(db, "SELECT * FROM post"))
        comment_rows.extend((p, r) for r in _db_rows(db, "SELECT * FROM comment"))

    content_by_post = {
        _key(p, r["post_id"], multi): (r.get("content") or "")
        for p, r in post_rows
    }

    comments_by_post: dict = {}
    for p, row in comment_rows:
        node = _comment_node(
            p, row, comment_meta.get(_key(p, row["comment_id"], multi), {}),
            resolve(row.get("user_id")),
        )
        comments_by_post.setdefault(_key(p, row.get("post_id"), multi), []).append(node)
    for nodes in comments_by_post.values():
        nodes.sort(key=_sort_key)

    posts = []
    for p, row in post_rows:
        node = _post_node(
            p, row, post_meta.get(_key(p, row["post_id"], multi), {}),
            resolve(row.get("user_id")), content_by_post, multi,
        )
        node["comments"] = comments_by_post.get(_key(p, row["post_id"], multi), [])
        posts.append(node)
    posts.sort(key=_sort_key)

    return {
        "schema": FEED_SCHEMA,
        "run_id": _load_json(run_dir / "run.json", {}).get("run_id")
        or run_dir.name,
        "platform": platform,
        "max_round": max_round,
        "posts": posts,
    }


def _sort_key(node: dict):
    """Chronological by event seq; ids tie-break when an event is absent."""
    seq = node.get("seq")
    return (0, seq) if isinstance(seq, int) else (1, 0)


def build_feed(run_dir) -> dict:
    """Assemble (or serve from cache) the threaded story feed for a run."""
    run_dir = Path(run_dir)
    cache = run_dir / FEED_CACHE
    events_file = run_dir / EVENTS_FILE
    if cache.exists() and events_file.exists():
        newest = events_file.stat().st_mtime
        for db in run_dir.glob("*_simulation.db"):
            newest = max(newest, db.stat().st_mtime)
        if cache.stat().st_mtime > newest:
            cached = _load_json(cache, None)
            if isinstance(cached, dict) and cached.get("schema") == FEED_SCHEMA:
                return cached

    feed = _assemble(run_dir)
    try:
        cache.write_text(json.dumps(feed, ensure_ascii=False), encoding="utf-8")
    except OSError:
        pass  # cache is an optimization; never fail the request over it
    return feed
