"""Record what agents did during a run into ChromaDB and the Obsidian vault.

The simulation emits one record per agent action. Writing each straight to
Chroma would put a network round trip on the hot path of every round, so
records are queued, grouped per platform, and flushed in batches by a
background thread.

Each record is also rendered to a short natural-language sentence. That
sentence is what gets embedded, so later retrieval ("what did this agent do
about the strait?") searches readable prose rather than a JSON blob.

Writes here are best-effort telemetry. A failure is counted and logged but
never propagated, because losing a memory record must not take down a run
that is otherwise fine.
"""

import logging
import threading
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from queue import Empty, Queue
from typing import Any, Dict, List, Optional, Tuple

from app.services.memory.chroma_client import get_or_create_collection
from app.services.memory.obsidian_mirror import append_agent_memory

logger = logging.getLogger(__name__)

# Stored memory names the *kind* of venue rather than the real service the
# engine models, so a recalled memory does not read as though the agent was
# actually on Twitter or Reddit. Unknown platforms pass through unchanged.
PLATFORM_NAMES = {"twitter": "Microblog", "reddit": "Forum"}

_DEFAULT_BATCH_SIZE = 5
_QUEUE_POLL_SECONDS = 1
_STOP_JOIN_TIMEOUT = 10

# Actions that carry no information worth remembering.
_IGNORED_ACTIONS = frozenset({"DO_NOTHING"})


@dataclass(frozen=True)
class _Phrasing:
    """How one action type is turned into a sentence.

    `keys` are checked in order against the action's arguments; the first with
    a value fills `detailed`. When none has a value, `plain` is used, so a
    record with missing arguments still produces a readable line.
    """

    plain: str
    detailed: str = ""
    keys: Tuple[str, ...] = ()

    def render(self, action_args: Dict[str, Any]) -> str:
        if not self.detailed:
            return self.plain
        for key in self.keys:
            value = action_args.get(key)
            if value:
                return self.detailed.format(value=value)
        return self.plain


# plain fallback, detailed template, argument keys tried in order.
_PHRASINGS: Dict[str, _Phrasing] = {
    "CREATE_POST": _Phrasing("wrote a post", 'wrote a post: "{value}"', ("content",)),
    "CREATE_COMMENT": _Phrasing("replied to a post", 'replied: "{value}"', ("content",)),
    "QUOTE_POST": _Phrasing(
        "quoted a post",
        'quoted a post, adding: "{value}"',
        ("quote_content", "content"),
    ),
    "REPOST": _Phrasing("shared a post", "shared a post by {value}", ("original_author_name",)),
    "LIKE_POST": _Phrasing("upvoted a post", "upvoted a post by {value}", ("post_author_name",)),
    "DISLIKE_POST": _Phrasing(
        "downvoted a post", "downvoted a post by {value}", ("post_author_name",)
    ),
    "LIKE_COMMENT": _Phrasing("upvoted a reply"),
    "DISLIKE_COMMENT": _Phrasing("downvoted a reply"),
    "FOLLOW": _Phrasing(
        "started following someone", "started following {value}", ("target_user_name",)
    ),
    "MUTE": _Phrasing("muted someone", "muted {value}", ("target_user_name",)),
    "SEARCH_POSTS": _Phrasing(
        "searched posts", 'searched posts for "{value}"', ("query", "keyword")
    ),
    "SEARCH_USER": _Phrasing(
        "looked up a user", 'looked up the user "{value}"', ("query", "username")
    ),
}


@dataclass
class AgentActivity:
    """One thing one agent did in one round."""

    platform: str
    agent_id: int
    agent_name: str
    action_type: str
    action_args: Dict[str, Any] = field(default_factory=dict)
    round_num: int = 0
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_episode_text(self) -> str:
        """Render the record as one embeddable sentence."""
        world = PLATFORM_NAMES.get(self.platform, self.platform)
        phrasing = _PHRASINGS.get(self.action_type)
        description = (
            phrasing.render(self.action_args)
            if phrasing
            else f"performed {self.action_type}"
        )
        return f"[{world}] {self.agent_name} {description}"


class ChromaGraphMemoryUpdater:
    """Queues activity records and flushes them per platform in batches."""

    BATCH_SIZE = _DEFAULT_BATCH_SIZE

    def __init__(self, graph_id: str, batch_size: int = _DEFAULT_BATCH_SIZE):
        self.graph_id = graph_id
        self.batch_size = batch_size

        self._activity_queue: Queue = Queue()
        self._platform_buffers: Dict[str, List[AgentActivity]] = {
            "twitter": [],
            "reddit": [],
        }
        self._buffer_lock = threading.Lock()
        self._running = False
        self._worker_thread: Optional[threading.Thread] = None
        self._stats = {
            "total_activities": 0,
            "batches_sent": 0,
            "items_sent": 0,
            "failed_count": 0,
            "skipped_count": 0,
        }

    # -- lifecycle ----------------------------------------------------------

    def start(self) -> None:
        """Start the flush thread. Calling this twice is a no-op."""
        if self._running:
            return
        self._running = True
        self._worker_thread = threading.Thread(
            target=self._worker_loop,
            daemon=True,
            name=f"ChromaMemoryUpdater-{self.graph_id[:8]}",
        )
        self._worker_thread.start()

    def stop(self) -> None:
        """Stop accepting work, flush whatever is pending, and join."""
        self._running = False
        self._flush_remaining()
        if self._worker_thread and self._worker_thread.is_alive():
            self._worker_thread.join(timeout=_STOP_JOIN_TIMEOUT)

    # -- intake -------------------------------------------------------------

    def add_activity(self, activity: AgentActivity) -> None:
        """Queue one record, unless it is an action not worth storing."""
        if activity.action_type in _IGNORED_ACTIONS:
            self._stats["skipped_count"] += 1
            return
        self._activity_queue.put(activity)
        self._stats["total_activities"] += 1

    def add_activity_from_dict(self, data: Dict[str, Any], platform: str) -> None:
        """Queue a record from a raw event payload.

        The worker's event stream carries lifecycle events alongside actions;
        anything tagged `event_type` is a lifecycle event, not an action.
        """
        if "event_type" in data:
            return

        self.add_activity(
            AgentActivity(
                platform=platform,
                agent_id=data.get("agent_id", 0),
                agent_name=data.get("agent_name", ""),
                action_type=data.get("action_type", ""),
                action_args=data.get("action_args", {}),
                round_num=data.get("round", 0),
                timestamp=data.get("timestamp", datetime.now().isoformat()),
            )
        )

    # -- flushing -----------------------------------------------------------

    def _worker_loop(self) -> None:
        """Drain the queue until stopped, then until it is empty."""
        while self._running or not self._activity_queue.empty():
            try:
                activity = self._activity_queue.get(timeout=_QUEUE_POLL_SECONDS)
            except Empty:
                continue

            try:
                batch, platform = self._buffer(activity)
                if batch:
                    self._send_batch(batch, platform)
            except Exception:
                logger.error("Memory updater worker loop error", exc_info=True)

    def _buffer(self, activity: AgentActivity) -> Tuple[List[AgentActivity], str]:
        """Add to the platform buffer, returning a full batch when ready.

        The send itself happens outside the lock, so a slow Chroma write does
        not stall the simulation thread that is still enqueueing records.
        """
        platform = activity.platform.lower()
        with self._buffer_lock:
            buffer = self._platform_buffers.setdefault(platform, [])
            buffer.append(activity)
            if len(buffer) < self.batch_size:
                return [], platform
            batch = buffer[: self.batch_size]
            self._platform_buffers[platform] = buffer[self.batch_size :]
        return batch, platform

    def _send_batch(self, activities: List[AgentActivity], platform: str) -> None:
        """Write one batch to Chroma and mirror it into the vault."""
        if not activities:
            return

        try:
            collection = get_or_create_collection(self.graph_id)
            for activity in activities:
                text = activity.to_episode_text()
                collection.add(
                    ids=[str(uuid.uuid4())],
                    documents=[text],
                    metadatas=[
                        {
                            "agent_id": str(activity.agent_id),
                            "agent_name": activity.agent_name,
                            "action_type": activity.action_type,
                            "platform": activity.platform,
                            "timestamp": activity.timestamp,
                            "type": "activity",
                        }
                    ],
                )
                append_agent_memory(activity.agent_name, text)
        except Exception:
            logger.error("Failed to flush %d activity records", len(activities), exc_info=True)
            self._stats["failed_count"] += 1
            return

        self._stats["batches_sent"] += 1
        self._stats["items_sent"] += len(activities)

    def _flush_remaining(self) -> None:
        """Send everything still queued or buffered, ignoring batch size."""
        while True:
            try:
                activity = self._activity_queue.get_nowait()
            except Empty:
                break
            platform = activity.platform.lower()
            with self._buffer_lock:
                self._platform_buffers.setdefault(platform, []).append(activity)

        with self._buffer_lock:
            pending = {p: b for p, b in self._platform_buffers.items() if b}
            for platform in self._platform_buffers:
                self._platform_buffers[platform] = []

        for platform, batch in pending.items():
            self._send_batch(batch, platform)

    # -- reporting ----------------------------------------------------------

    def get_stats(self) -> Dict[str, Any]:
        with self._buffer_lock:
            buffer_sizes = {p: len(b) for p, b in self._platform_buffers.items()}
        return {
            "graph_id": self.graph_id,
            "batch_size": self.batch_size,
            **self._stats,
            "queue_size": self._activity_queue.qsize(),
            "buffer_sizes": buffer_sizes,
            "running": self._running,
        }


class ChromaGraphMemoryManager:
    """Tracks one updater per simulation."""

    _updaters: Dict[str, ChromaGraphMemoryUpdater] = {}
    _lock = threading.Lock()
    # True only while a stop_all is in flight, to stop it recursing. It is
    # always cleared afterwards so the manager stays usable for another run.
    _stopping_all = False

    @classmethod
    def create_updater(cls, simulation_id: str, graph_id: str) -> ChromaGraphMemoryUpdater:
        """Start an updater, replacing any existing one for this simulation."""
        with cls._lock:
            existing = cls._updaters.get(simulation_id)
            if existing is not None:
                existing.stop()

            updater = ChromaGraphMemoryUpdater(graph_id)
            updater.start()
            cls._updaters[simulation_id] = updater
            return updater

    @classmethod
    def get_updater(cls, simulation_id: str) -> Optional[ChromaGraphMemoryUpdater]:
        return cls._updaters.get(simulation_id)

    @classmethod
    def stop_updater(cls, simulation_id: str) -> None:
        with cls._lock:
            updater = cls._updaters.pop(simulation_id, None)
        if updater is not None:
            updater.stop()

    @classmethod
    def stop_all(cls) -> None:
        """Stop and deregister every updater. Safe to call repeatedly."""
        if cls._stopping_all:
            return
        cls._stopping_all = True
        try:
            with cls._lock:
                updaters = list(cls._updaters.values())
                cls._updaters.clear()

            for updater in updaters:
                try:
                    updater.stop()
                except Exception:
                    logger.error("Failed to stop a memory updater", exc_info=True)
        finally:
            cls._stopping_all = False

    @classmethod
    def get_all_stats(cls) -> Dict[str, Dict[str, Any]]:
        return {sid: updater.get_stats() for sid, updater in cls._updaters.items()}
