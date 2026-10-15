import json

import pytest

from app.services.metrics import compute_metrics
from simworker.events import EventWriter


@pytest.fixture
def run_dir(tmp_path):
    (tmp_path / "population.json").write_text(json.dumps({
        "key_topics": ["oil prices"],
        "agents": [
            {"agent_uid": "agent_p", "tier": "protagonist"},
            {"agent_uid": "agent_c1", "tier": "crowd_policy"},
            {"agent_uid": "agent_c2", "tier": "crowd_policy"},
            {"agent_uid": "agent_idle", "tier": "crowd_policy"},
        ],
    }), encoding="utf-8")
    (tmp_path / "run.json").write_text(json.dumps({
        "run_id": "run_x", "platform": "reddit", "rounds": 2, "seed": 1,
        "endpoints": {"protagonist": None, "crowd_llm": None},
    }), encoding="utf-8")
    w = EventWriter(tmp_path)
    w.emit("worker_started", platform="reddit")
    w.emit("round_started", round=0)
    w.emit("action", round=0, agent_uid="agent_p", action_type="create_post",
           info={"content": "Oil prices may crash, panic is spreading"})
    w.emit("action", round=0, agent_uid="agent_c1", action_type="like_post",
           info={"post_id": 1})
    w.emit("round_finished", round=0, actions_taken=2)
    w.emit("round_started", round=1)
    w.emit("action", round=1, agent_uid="agent_c2", action_type="create_post",
           info={"content": "Staying calm, supplies look stable and optimistic"})
    w.emit("round_finished", round=1, actions_taken=1)
    w.emit("sim_finished")
    return tmp_path


def test_compute_metrics_full_structure(run_dir):
    m = compute_metrics(run_dir)
    assert m["rounds_observed"] == 2
    assert m["total_actions"] == 3
    assert m["actions_by_type"] == {"create_post": 2, "like_post": 1}
    assert m["actions_by_tier"] == {"protagonist": 1, "crowd_policy": 2}
    assert len(m["per_round"]) == 2
    r0 = m["per_round"][0]
    assert r0["actions"] == 2
    assert r0["sentiment"]["negative"] == 1  # crash/panic post
    assert m["per_round"][1]["sentiment"]["positive"] == 1
    assert m["topic_totals"]["oil prices"] == 1  # only the round-0 post matches
    assert m["sentiment_trend"][0]["score"] < 0 < m["sentiment_trend"][1]["score"]


def test_divergence_and_cascade(run_dir):
    m = compute_metrics(run_dir)
    assert m["divergence"][0]["protagonist_share"] == 0.5
    assert m["divergence"][1]["protagonist_share"] == 0.0
    assert m["cascade"]["agents_engaged"] == 3
    assert m["cascade"]["engaged_share"] == 0.75
    assert m["cascade"]["first_round_half_engaged"] == 0


def test_metrics_cached_and_invalidated(run_dir):
    m1 = compute_metrics(run_dir)
    cached = json.loads((run_dir / "metrics.json").read_text(encoding="utf-8"))
    assert cached["total_actions"] == m1["total_actions"]
    # appending an event invalidates the cache
    EventWriter(run_dir).emit("action", round=1, agent_uid="agent_c1",
                              action_type="like_post", info={"post_id": 2})
    m2 = compute_metrics(run_dir)
    assert m2["total_actions"] == 4


def test_empty_run_dir_degrades_to_zeroes(tmp_path):
    m = compute_metrics(tmp_path)
    assert m["total_actions"] == 0 and m["per_round"] == []
    assert m["cascade"]["first_round_half_engaged"] is None


def test_metrics_aggregates_by_faction(tmp_path):
    # Faction is a SECOND axis next to tier: same agents, grouped by which
    # side of the question they're on. The reopening-side and hardline-side
    # posts must land in distinct buckets with opposite sentiment scores.
    (tmp_path / "population.json").write_text(json.dumps({
        "key_topics": [],
        "agents": [
            {"agent_uid": "a", "tier": "protagonist", "faction": "pro-reopening"},
            {"agent_uid": "b", "tier": "crowd_policy", "faction": "hardline"},
            {"agent_uid": "c", "tier": "crowd_policy"},  # no faction -> unaligned
        ],
    }), encoding="utf-8")
    (tmp_path / "run.json").write_text(json.dumps({
        "run_id": "run_y", "platform": "reddit", "rounds": 1, "seed": 1,
        "endpoints": {"protagonist": None, "crowd_llm": None},
    }), encoding="utf-8")
    w = EventWriter(tmp_path)
    w.emit("action", round=0, agent_uid="a", action_type="create_post",
           info={"content": "calm stable recovery, optimistic and steady"})
    w.emit("action", round=0, agent_uid="b", action_type="create_post",
           info={"content": "crash panic collapse, fear and chaos"})
    w.emit("action", round=0, agent_uid="c", action_type="like_post",
           info={"post_id": 1})
    w.emit("sim_finished")
    m = compute_metrics(tmp_path)
    assert m["actions_by_faction"] == {
        "pro-reopening": 1, "hardline": 1, "unaligned": 1,
    }
    assert m["faction_sentiment"]["pro-reopening"]["positive"] == 1
    assert m["faction_sentiment"]["hardline"]["negative"] == 1
    assert (m["faction_sentiment"]["pro-reopening"]["score"] > 0
            > m["faction_sentiment"]["hardline"]["score"])
    # a like carries no content -> the unaligned agent has no sentiment bucket
    assert "unaligned" not in m["faction_sentiment"]
    assert m["per_round"][0]["by_faction"] == {
        "pro-reopening": 1, "hardline": 1, "unaligned": 1,
    }


def test_topic_matching_uses_keyword_stems_not_literal_phrase():
    from app.services.metrics import _matches_topic

    # the undercounting bug: central topics rarely appear phrased verbatim
    assert _matches_topic("Iran's oil revenue losses keep mounting", "Iranian financial losses")
    assert _matches_topic("Oil prices climbed sharply on the news", "oil price and inflation")
    # full-phrase containment still matches
    assert _matches_topic("the strait of hormuz reopening soon", "Strait of Hormuz reopening")
    # a stem isn't enough on its own for a multi-keyword topic
    assert not _matches_topic("the weather is nice in Tehran today", "Iranian financial losses")
    assert not _matches_topic("a post about gardening and cats", "oil price and inflation")


def test_per_round_faction_sentiment_series(tmp_path):
    """The per-round x per-faction sentiment counts that power the faction
    divergence chart (1b). The pipeline already classifies sentiment per
    content action with the faction in hand — this just buckets it by round."""
    (tmp_path / "population.json").write_text(json.dumps({
        "key_topics": [],
        "agents": [
            {"agent_uid": "a", "tier": "protagonist", "faction": "pro-reopening"},
            {"agent_uid": "b", "tier": "crowd_policy", "faction": "hardline"},
        ],
    }), encoding="utf-8")
    (tmp_path / "run.json").write_text(json.dumps({
        "run_id": "run_fs", "platform": "reddit", "rounds": 2, "seed": 1,
    }), encoding="utf-8")
    w = EventWriter(tmp_path)
    w.emit("action", round=0, agent_uid="a", action_type="create_post",
           info={"content": "calm stable optimistic recovery"})
    w.emit("action", round=0, agent_uid="b", action_type="create_post",
           info={"content": "crash panic fear collapse"})
    w.emit("action", round=1, agent_uid="b", action_type="create_post",
           info={"content": "more chaos and disaster"})
    w.emit("sim_finished")
    m = compute_metrics(tmp_path)
    r0 = m["per_round"][0]["faction_sentiment"]
    assert r0["pro-reopening"] == {"positive": 1, "negative": 0, "neutral": 0}
    assert r0["hardline"] == {"positive": 0, "negative": 1, "neutral": 0}
    # round 1 had only a hardline negative post; pro-reopening absent that round
    r1 = m["per_round"][1]["faction_sentiment"]
    assert "pro-reopening" not in r1
    assert r1["hardline"]["negative"] == 1


def test_metrics_cache_busts_on_schema_change(run_dir):
    import os

    compute_metrics(run_dir)  # warm
    cache = run_dir / "metrics.json"
    data = json.loads(cache.read_text(encoding="utf-8"))
    data.pop("schema_version", None)  # simulate an older-schema cache
    data["total_actions"] = 999  # sentinel that must NOT be served
    cache.write_text(json.dumps(data), encoding="utf-8")
    events_mtime = (run_dir / "events.jsonl").stat().st_mtime
    os.utime(cache, (events_mtime + 10, events_mtime + 10))
    m = compute_metrics(run_dir)
    assert m["total_actions"] != 999  # rebuilt, not served from stale schema
    assert "schema_version" in m
