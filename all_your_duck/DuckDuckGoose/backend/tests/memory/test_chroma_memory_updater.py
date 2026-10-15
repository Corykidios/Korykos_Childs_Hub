"""Memory updater: sentence rendering, intake rules, batching, manager lifecycle."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.memory.chroma_memory_updater import (
    AgentActivity,
    ChromaGraphMemoryManager,
    ChromaGraphMemoryUpdater,
)

UPDATER_MODULE = "app.services.memory.chroma_memory_updater"


def _activity(action_type="CREATE_POST", platform="twitter", **action_args):
    return AgentActivity(
        platform=platform,
        agent_id=1,
        agent_name="TraderJoe",
        action_type=action_type,
        action_args=action_args,
    )


@pytest.fixture
def captured_writes():
    """Intercept the Chroma collection and the vault mirror."""
    collection = MagicMock()
    with patch(f"{UPDATER_MODULE}.get_or_create_collection", return_value=collection), patch(
        f"{UPDATER_MODULE}.append_agent_memory"
    ) as mirror:
        yield collection, mirror


# -- sentence rendering ----------------------------------------------------


def test_episode_text_names_the_agent_and_the_venue():
    text = _activity(content="Oil going up").to_episode_text()
    assert "TraderJoe" in text
    assert "Microblog" in text
    assert "Oil going up" in text


def test_reddit_renders_as_a_forum():
    assert "Forum" in _activity(platform="reddit").to_episode_text()


def test_stored_memory_does_not_name_the_real_services():
    for platform in ("twitter", "reddit"):
        text = _activity(platform=platform, content="x").to_episode_text()
        assert "twitter" not in text.lower()
        assert "reddit" not in text.lower()


def test_unknown_platform_is_passed_through_rather_than_dropped():
    assert "mastodon" in _activity(platform="mastodon").to_episode_text()


@pytest.mark.parametrize(
    "action_type,args,expected",
    [
        ("CREATE_POST", {"content": "Oil up"}, "Oil up"),
        ("CREATE_COMMENT", {"content": "Disagree"}, "Disagree"),
        ("LIKE_POST", {"post_author_name": "Ada"}, "Ada"),
        ("DISLIKE_POST", {"post_author_name": "Ada"}, "Ada"),
        ("REPOST", {"original_author_name": "Ada"}, "Ada"),
        ("FOLLOW", {"target_user_name": "Ada"}, "Ada"),
        ("MUTE", {"target_user_name": "Ada"}, "Ada"),
    ],
)
def test_detail_is_included_when_present(action_type, args, expected):
    assert expected in _activity(action_type, **args).to_episode_text()


@pytest.mark.parametrize(
    "action_type",
    ["CREATE_POST", "CREATE_COMMENT", "LIKE_POST", "REPOST", "FOLLOW", "MUTE", "QUOTE_POST"],
)
def test_missing_arguments_still_render_a_readable_line(action_type):
    """A record with no arguments must not produce a dangling sentence."""
    text = _activity(action_type).to_episode_text()
    assert text.strip().endswith(("post", "posts", "reply", "someone", "a user"))
    assert "{" not in text
    assert "None" not in text


@pytest.mark.parametrize("keys", [{"quote_content": "the real quote"}, {"content": "fallback"}])
def test_quote_post_prefers_the_quote_then_falls_back(keys):
    text = _activity("QUOTE_POST", **keys).to_episode_text()
    assert list(keys.values())[0] in text


def test_quote_content_wins_over_content():
    text = _activity("QUOTE_POST", quote_content="chosen", content="ignored").to_episode_text()
    assert "chosen" in text
    assert "ignored" not in text


@pytest.mark.parametrize("key", ["query", "keyword"])
def test_search_accepts_either_argument_name(key):
    assert "hormuz" in _activity("SEARCH_POSTS", **{key: "hormuz"}).to_episode_text()


def test_unrecognised_action_falls_back_to_naming_it():
    assert "WARP_DRIVE" in _activity("WARP_DRIVE").to_episode_text()


# -- intake ----------------------------------------------------------------


def test_do_nothing_is_counted_as_skipped_not_stored():
    updater = ChromaGraphMemoryUpdater("sim-001", batch_size=5)
    updater.add_activity(_activity("DO_NOTHING"))

    stats = updater.get_stats()
    assert stats["skipped_count"] == 1
    assert stats["total_activities"] == 0
    assert stats["queue_size"] == 0


def test_real_activity_is_queued_and_counted():
    updater = ChromaGraphMemoryUpdater("sim-001")
    updater.add_activity(_activity(content="x"))

    assert updater.get_stats()["total_activities"] == 1
    assert updater.get_stats()["queue_size"] == 1


def test_lifecycle_events_are_ignored():
    """The event stream mixes lifecycle events in with actions."""
    updater = ChromaGraphMemoryUpdater("sim-001")
    updater.add_activity_from_dict({"event_type": "round_started", "round": 3}, "twitter")

    assert updater.get_stats()["total_activities"] == 0


def test_activity_from_dict_maps_the_payload():
    updater = ChromaGraphMemoryUpdater("sim-001")
    updater.add_activity_from_dict(
        {
            "agent_id": 7,
            "agent_name": "Ada",
            "action_type": "CREATE_POST",
            "action_args": {"content": "hello"},
            "round": 4,
        },
        "reddit",
    )

    queued = updater._activity_queue.get_nowait()
    assert (queued.agent_name, queued.agent_id, queued.round_num) == ("Ada", 7, 4)
    assert queued.platform == "reddit"


# -- batching --------------------------------------------------------------


def test_buffer_holds_records_until_the_batch_is_full():
    updater = ChromaGraphMemoryUpdater("sim-001", batch_size=3)

    assert updater._buffer(_activity())[0] == []
    assert updater._buffer(_activity())[0] == []
    batch, platform = updater._buffer(_activity())

    assert len(batch) == 3
    assert platform == "twitter"
    assert updater.get_stats()["buffer_sizes"]["twitter"] == 0


def test_platforms_are_buffered_independently():
    updater = ChromaGraphMemoryUpdater("sim-001", batch_size=2)
    updater._buffer(_activity(platform="twitter"))
    batch, _ = updater._buffer(_activity(platform="reddit"))

    assert batch == []
    sizes = updater.get_stats()["buffer_sizes"]
    assert sizes["twitter"] == 1 and sizes["reddit"] == 1


def test_send_batch_writes_to_chroma_and_the_vault(captured_writes):
    collection, mirror = captured_writes
    updater = ChromaGraphMemoryUpdater("sim-001")

    updater._send_batch([_activity(content="a"), _activity(content="b")], "twitter")

    assert collection.add.call_count == 2
    assert mirror.call_count == 2
    stats = updater.get_stats()
    assert stats["batches_sent"] == 1
    assert stats["items_sent"] == 2
    assert stats["failed_count"] == 0


def test_a_failed_write_is_counted_and_swallowed():
    """Telemetry failures must never propagate into the run."""
    updater = ChromaGraphMemoryUpdater("sim-001")
    with patch(f"{UPDATER_MODULE}.get_or_create_collection", side_effect=Exception("chroma down")):
        updater._send_batch([_activity(content="a")], "twitter")

    stats = updater.get_stats()
    assert stats["failed_count"] == 1
    assert stats["items_sent"] == 0


def test_empty_batch_is_not_written(captured_writes):
    collection, _ = captured_writes
    ChromaGraphMemoryUpdater("sim-001")._send_batch([], "twitter")
    collection.add.assert_not_called()


def test_flush_sends_partial_buffers_and_drains_the_queue(captured_writes):
    collection, _ = captured_writes
    updater = ChromaGraphMemoryUpdater("sim-001", batch_size=10)
    updater.add_activity(_activity(content="queued"))
    updater._buffer(_activity(content="buffered"))

    updater._flush_remaining()

    assert collection.add.call_count == 2
    assert updater.get_stats()["queue_size"] == 0
    assert all(size == 0 for size in updater.get_stats()["buffer_sizes"].values())


# -- manager ---------------------------------------------------------------


def test_manager_keeps_one_updater_per_simulation():
    first = ChromaGraphMemoryManager.create_updater("sim-001", "graph-001")
    second = ChromaGraphMemoryManager.create_updater("sim-002", "graph-002")
    try:
        assert first is not second
        assert ChromaGraphMemoryManager.get_updater("sim-001") is first
    finally:
        ChromaGraphMemoryManager.stop_all()


def test_recreating_a_simulation_replaces_and_stops_the_old_updater():
    original = ChromaGraphMemoryManager.create_updater("sim-dup", "graph-a")
    replacement = ChromaGraphMemoryManager.create_updater("sim-dup", "graph-b")
    try:
        assert replacement is not original
        assert original.get_stats()["running"] is False
        assert ChromaGraphMemoryManager.get_updater("sim-dup") is replacement
    finally:
        ChromaGraphMemoryManager.stop_all()


def test_stop_updater_deregisters_it():
    ChromaGraphMemoryManager.create_updater("sim-gone", "graph-x")
    ChromaGraphMemoryManager.stop_updater("sim-gone")
    assert ChromaGraphMemoryManager.get_updater("sim-gone") is None


def test_stop_updater_on_an_unknown_simulation_is_harmless():
    ChromaGraphMemoryManager.stop_updater("never-existed")


def test_stop_all_is_not_one_shot():
    """A second stop_all must still stop updaters created after the first."""
    ChromaGraphMemoryManager.stop_all()

    updater = ChromaGraphMemoryManager.create_updater("sim-reuse-test", "graph-reuse-test")
    assert ChromaGraphMemoryManager.get_updater("sim-reuse-test") is updater

    ChromaGraphMemoryManager.stop_all()

    assert ChromaGraphMemoryManager.get_updater("sim-reuse-test") is None
    assert updater.get_stats()["running"] is False


def test_start_twice_does_not_spawn_a_second_thread():
    updater = ChromaGraphMemoryUpdater("sim-001")
    updater.start()
    thread = updater._worker_thread
    updater.start()
    try:
        assert updater._worker_thread is thread
    finally:
        updater.stop()
