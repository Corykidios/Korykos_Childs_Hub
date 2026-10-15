"""Async simulation engine: the worker's integration heart.

Drives a real OasisEnv per platform with MIXED per-tier actions each round:
LLM tiers get ``LLMAction`` (only when that tier's endpoint is configured),
the policy crowd gets compiled-policy ``ManualAction``s — zero LLM calls for
policy agents. Progress is communicated exclusively through the append-only
event stream (events.jsonl) + the heartbeat file; control arrives via the
file-based IPC protocol (pause/resume/stop/interview).

v1 honest simplifications (documented per the plan):
- The observation feed is the GLOBAL recent-post list per platform, not a
  per-agent recsys feed (per-agent feeds come later).
- "both" runs interleave the two platforms sequentially inside each round
  (no concurrent stepping); cross_feed copies the top-J most-liked posts of
  each platform into the other via the position-0 wire agent each round.
"""

import asyncio
import json
import logging
import random
import sqlite3
import threading
import zlib
from dataclasses import dataclass, field
from pathlib import Path

import oasis
from oasis import ActionType, DefaultPlatformType, LLMAction, ManualAction

from simworker.brains.policy import PolicyAgentState, decide
from simworker.events import EventWriter
from simworker.feed import (
    descriptor_to_manual_action,
    recent_posts,
    trace_rows_since,
)
from simworker.graphbuild import build_agent_graph
from simworker.ipc import CommandServer, write_heartbeat
from simworker.runconfig import RunConfig, load_run_config
from simworker.scheduler import schedule_round

log = logging.getLogger("simworker.engine")

# Set by __main__'s SIGTERM/SIGINT handlers; checked each round and in the
# post-loop wait mode.
STOP_REQUESTED = threading.Event()


def _install_per_agent_isolation() -> None:
    """Make one agent's failed action non-fatal to the whole run.

    env.step runs every agent's action in ONE ``asyncio.gather(*tasks)`` with
    NO return_exceptions, so any task that raises aborts the entire step — and
    the run. OASIS already shields the LLM path (perform_action_by_llm catches
    and RETURNS the error), but NOT the manual-action path
    (perform_action_by_data), which can raise on a stale post_id, a missing
    target, or a DB hiccup. We wrap it to log + return the error instead of
    raising — matching OASIS's own LLM handling — so a single bad action can
    never collapse the simulation. Idempotent (safe to call repeatedly)."""
    from oasis.social_agent.agent import SocialAgent

    if getattr(SocialAgent.perform_action_by_data, "_ddg_isolated", False):
        return
    _orig = SocialAgent.perform_action_by_data

    async def _safe_perform_action_by_data(self, func_name, *args, **kwargs):
        try:
            return await _orig(self, func_name, *args, **kwargs)
        except Exception as exc:
            log.warning(
                "manual action %r isolated for agent %s (run continues): %s",
                func_name, getattr(self, "social_agent_id", "?"), exc,
            )
            return exc

    _safe_perform_action_by_data._ddg_isolated = True
    SocialAgent.perform_action_by_data = _safe_perform_action_by_data


_install_per_agent_isolation()

_PLATFORM_TYPES = {
    "twitter": DefaultPlatformType.TWITTER,
    "reddit": DefaultPlatformType.REDDIT,
}

_INTERVIEW_POLL_SECONDS = 0.5
_INTERVIEW_POLL_ATTEMPTS = 20  # ~10s
_WAIT_POLL_SECONDS = 0.5
_HEARTBEAT_INTERVAL_SECONDS = 15.0
# The round loop and the background heartbeat thread both write
# heartbeat.json; one writer at a time prevents torn files (the
# supervisor's reader tolerates a torn read, but don't produce them).
_HEARTBEAT_LOCK = threading.Lock()


def _write_heartbeat_safe(run_dir: Path, round_num: int, phase: str) -> None:
    with _HEARTBEAT_LOCK:
        try:
            write_heartbeat(run_dir, round_num, phase=phase)
        except OSError as exc:
            log.warning("heartbeat write failed: %s", exc)


def _start_heartbeat_thread(run_dir: Path, status: dict) -> threading.Event:
    """Beat every _HEARTBEAT_INTERVAL_SECONDS for the life of the run, so
    a long LLM round (which can exceed any fixed freshness window) never
    reads as a dead worker and the supervisor's governor never over-admits
    mid-round. ``status`` is a shared mutable dict {"round": int,
    "phase": "running"|"waiting"} owned by the round loop. Returns the
    stop Event (set it in finally); the thread is a daemon either way."""
    stop = threading.Event()

    def beat() -> None:
        while not stop.is_set():
            _write_heartbeat_safe(run_dir, status["round"], status["phase"])
            stop.wait(_HEARTBEAT_INTERVAL_SECONDS)

    threading.Thread(target=beat, name="heartbeat", daemon=True).start()
    return stop


@dataclass
class _PlatformContext:
    platform: str
    env: object
    by_position: dict
    uid_to_position: dict
    position_to_uid: dict
    db_path: Path
    last_rowid: int = 0
    states: dict = field(default_factory=dict)  # uid -> PolicyAgentState


def _agent_rng(seed: int, platform: str, uid: str, round_num: int):
    """Per-agent, per-round decorrelated rng. crc32 (not built-in hash):
    Python salts str hashes per process, which would break cross-process
    determinism."""
    key = f"{seed}:{platform}:{uid}:{round_num}".encode("utf-8")
    return random.Random(zlib.crc32(key) & 0xFFFFFFFF)


def _load_policies(run_dir: Path, population: dict):
    """Load compiled policies once. Returns (policies_by_uid,
    policy_missing_count) — missing files mean those agents simply never
    act (counted once on worker_started)."""
    policies: dict[str, dict] = {}
    missing = 0
    policies_dir = run_dir / "policies"
    for agent in population.get("agents", []):
        if agent.get("tier", "crowd_policy") != "crowd_policy":
            continue
        uid = agent["agent_uid"]
        path = policies_dir / f"{uid}.json"
        if not path.exists():
            missing += 1
            continue
        try:
            policies[uid] = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            log.warning("unreadable policy for %s: %s", uid, exc)
            missing += 1
    return policies, missing


def _top_posts_by_likes(db_path: Path, limit: int) -> list[dict]:
    """Top-J posts by num_likes for cross-feed. Already-crosswired posts are
    excluded so the two platforms cannot echo each other forever."""
    if not Path(db_path).exists():
        return []
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT post_id, content, num_likes FROM post"
            " WHERE content NOT LIKE '[crosswire]%'"
            " ORDER BY num_likes DESC, post_id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError:
        return []
    finally:
        conn.close()


async def _build_context(
    platform: str, run_dir: Path, config: RunConfig
) -> _PlatformContext:
    graph, by_position, uid_to_position = build_agent_graph(
        platform, run_dir, config
    )
    db_path = run_dir / f"{platform}_simulation.db"
    env = oasis.make(
        agent_graph=graph,
        platform=_PLATFORM_TYPES[platform],
        database_path=str(db_path),
        semaphore=config.semaphore,
    )
    return _PlatformContext(
        platform=platform,
        env=env,
        by_position=by_position,
        uid_to_position=uid_to_position,
        position_to_uid={v: k for k, v in uid_to_position.items()},
        db_path=db_path,
    )


async def _seed_round_zero(
    ctx: _PlatformContext, population: dict, config: RunConfig
) -> None:
    """Pre-loop seeds: follow edges (positional ids) + initial posts,
    batched into ONE env.step. Failures are logged, never fatal."""
    actions: dict = {}
    for edge in population.get("follow_edges", []):
        follower_pos = ctx.uid_to_position.get(edge.get("follower"))
        followee_pos = ctx.uid_to_position.get(edge.get("followee"))
        if follower_pos is None or followee_pos is None:
            log.warning("follow edge with unknown uid skipped: %s", edge)
            continue
        agent = ctx.by_position.get(follower_pos)
        if agent is None:
            continue
        actions.setdefault(agent, []).append(
            ManualAction(
                action_type=ActionType.FOLLOW,
                action_args={"followee_id": followee_pos},
            )
        )
    for post in config.initial_posts:
        pos = ctx.uid_to_position.get(post.agent_uid)
        agent = ctx.by_position.get(pos) if pos is not None else None
        if agent is None:
            log.warning(
                "initial post for unknown agent_uid %s skipped",
                post.agent_uid,
            )
            continue
        actions.setdefault(agent, []).append(
            ManualAction(
                action_type=ActionType.CREATE_POST,
                action_args={"content": post.content},
            )
        )
    if not actions:
        return
    try:
        await ctx.env.step(actions)
    except Exception as exc:
        log.warning("round-0 seed step failed on %s: %s", ctx.platform, exc)


def _emit_trace_diff(
    ctx: _PlatformContext,
    events: EventWriter,
    round_num: int,
    degraded_positions: set[int],
) -> None:
    """Diff the sqlite trace by rowid and emit action events. sign_up rows
    are reset noise; everything else is kept."""
    rows, ctx.last_rowid = trace_rows_since(ctx.db_path, ctx.last_rowid)
    for row in rows:
        if row["action"] == "sign_up":
            continue
        uid = ctx.position_to_uid.get(row["user_id"], "")
        events.emit(
            "action",
            round=round_num,
            platform=ctx.platform,
            agent_uid=uid,
            action_type=row["action"],
            info=row["info"],
            degraded=row["user_id"] in degraded_positions,
        )


async def _run_platform_round(
    ctx: _PlatformContext,
    round_num: int,
    config: RunConfig,
    population_agents: list[dict],
    policies: dict[str, dict],
    sched_rng,
    events: EventWriter,
) -> int:
    """One platform's slice of a round: feed -> schedule -> route -> single
    step -> trace diff -> action events. Returns the number of acting
    agents."""
    feed = recent_posts(ctx.db_path)
    sched = schedule_round(
        population_agents, round_num, config.time_dials.model_dump(),
        sched_rng,
    )
    actions: dict = {}
    degraded_positions: set[int] = set()
    for decision in sched["decisions"]:
        uid = decision["agent_uid"]
        route = decision["route"]
        pos = ctx.uid_to_position.get(uid)
        agent = ctx.by_position.get(pos) if pos is not None else None
        if agent is None:
            continue
        if route == "llm_protagonist":
            if config.endpoints.protagonist is None:
                continue  # tier endpoint not configured -> no LLM route
            actions[agent] = LLMAction()
        elif route == "llm_crowd":
            if config.endpoints.crowd_llm is None:
                continue
            actions[agent] = LLMAction()
        else:  # policy
            policy = policies.get(uid)
            if policy is None:
                continue  # missing policy file == decide() returned None
            state = ctx.states.setdefault(uid, PolicyAgentState())
            rng = _agent_rng(config.seed, ctx.platform, uid, round_num)
            descriptor = decide(policy, state, feed, rng)
            if descriptor is None:
                continue
            action, degraded = descriptor_to_manual_action(
                descriptor, ctx.platform
            )
            actions[agent] = action
            if degraded:
                degraded_positions.add(pos)
    if actions:
        try:
            await ctx.env.step(actions)
        except Exception as exc:
            # Per-agent failures are already isolated (LLM path by OASIS,
            # manual path by _install_per_agent_isolation). This is the
            # round-level safety net for a residual step failure (e.g. the
            # rec-table update): skip this platform-round, never the run.
            log.warning(
                "step failed on %s round %d (skipped, run continues): %s",
                ctx.platform, round_num, exc,
            )
            events.emit(
                "round_step_failed", round=round_num,
                platform=ctx.platform, error=str(exc)[:300],
            )
    _emit_trace_diff(ctx, events, round_num, degraded_positions)
    return len(actions)


async def _cross_feed(
    ctxs: list[_PlatformContext], config: RunConfig
) -> None:
    """Copy each platform's top-J most-liked posts into the OTHER platform
    via its position-0 wire agent, '[crosswire] '-prefixed."""
    for src, dst in ((ctxs[0], ctxs[1]), (ctxs[1], ctxs[0])):
        top = _top_posts_by_likes(src.db_path, config.cross_feed_top_j)
        wire = dst.by_position.get(0)
        if not top or wire is None:
            continue
        msgs = [
            ManualAction(
                action_type=ActionType.CREATE_POST,
                action_args={
                    "content": "[crosswire] " + (p["content"] or "")
                },
            )
            for p in top
        ]
        try:
            await dst.env.step({wire: msgs})
        except Exception as exc:
            log.warning(
                "cross-feed %s->%s failed: %s",
                src.platform, dst.platform, exc,
            )


def _find_interview_ctx(
    ctxs: list[_PlatformContext], uid: str, platform: str | None
) -> _PlatformContext | None:
    for ctx in ctxs:
        if platform and ctx.platform != platform:
            continue
        if uid in ctx.uid_to_position:
            return ctx
    return None


async def _do_interview(
    cmd: dict,
    ctxs: list[_PlatformContext],
    events: EventWriter,
    server: CommandServer,
) -> None:
    args = cmd.get("args", {}) or {}
    uid = args.get("agent_uid", "")
    prompt = args.get("prompt", "")
    command_id = cmd["command_id"]
    ctx = _find_interview_ctx(ctxs, uid, args.get("platform"))
    if ctx is None:
        server.respond(
            command_id, "failed", error=f"unknown agent_uid: {uid}"
        )
        return
    pos = ctx.uid_to_position[uid]
    agent = ctx.by_position[pos]
    try:
        await ctx.env.step({
            agent: ManualAction(
                action_type=ActionType.INTERVIEW,
                action_args={"prompt": prompt},
            )
        })
    except Exception as exc:
        server.respond(command_id, "failed", error=str(exc))
        return
    # Poll the trace for the interview row WITHOUT advancing last_rowid —
    # the regular round diff still owns the cursor.
    response = None
    for _ in range(_INTERVIEW_POLL_ATTEMPTS):
        rows, _new_last = trace_rows_since(ctx.db_path, ctx.last_rowid)
        for row in rows:
            if row["action"] != "interview" or row["user_id"] != pos:
                continue
            info = row["info"]
            if isinstance(info, dict) and info.get("prompt") == prompt:
                response = info.get("response")
        if response is not None:
            break
        await asyncio.sleep(_INTERVIEW_POLL_SECONDS)
    events.emit(
        "interview_result",
        agent_uid=uid,
        platform=ctx.platform,
        prompt=prompt,
        response=response,
    )
    server.respond(
        command_id, "completed",
        result={"agent_uid": uid, "response": response},
    )


async def _handle_ipc(
    server: CommandServer,
    ctxs: list[_PlatformContext],
    events: EventWriter,
) -> bool:
    """Drain pending commands. Returns True when a stop was received.
    pause busy-waits (0.5s poll) until resume/stop; interview executes
    inline against the live env."""
    while True:
        cmd = server.poll()
        if cmd is None:
            return False
        command_id = cmd["command_id"]
        command_type = cmd["command_type"]
        if command_type == "stop":
            server.respond(command_id, "completed")
            return True
        if command_type == "interview":
            await _do_interview(cmd, ctxs, events, server)
        elif command_type == "pause":
            server.respond(command_id, "completed")
            events.emit("paused")
            while not STOP_REQUESTED.is_set():
                await asyncio.sleep(_WAIT_POLL_SECONDS)
                nxt = server.poll()
                if nxt is None:
                    continue
                if nxt["command_type"] == "resume":
                    server.respond(nxt["command_id"], "completed")
                    events.emit("resumed")
                    break
                if nxt["command_type"] == "stop":
                    server.respond(nxt["command_id"], "completed")
                    return True
                if nxt["command_type"] == "interview":
                    await _do_interview(nxt, ctxs, events, server)
                else:
                    server.respond(
                        nxt["command_id"], "failed",
                        error=f"invalid while paused: {nxt['command_type']}",
                    )
        elif command_type == "resume":
            server.respond(command_id, "completed")  # not paused: no-op
        else:
            server.respond(
                command_id, "failed",
                error=f"unknown command: {command_type}",
            )


async def _wait_mode(
    server: CommandServer,
    ctxs: list[_PlatformContext],
    events: EventWriter,
) -> None:
    """Post-loop wait: keep the envs alive for interviews until stop."""
    while not STOP_REQUESTED.is_set():
        if await _handle_ipc(server, ctxs, events):
            return
        await asyncio.sleep(_WAIT_POLL_SECONDS)


async def run(run_dir) -> None:
    """Engine entrypoint. Any exception emits worker_error and re-raises
    (the worker process exits nonzero)."""
    run_dir = Path(run_dir)
    config = load_run_config(run_dir)
    events = EventWriter(run_dir)
    try:
        await _run(run_dir, config, events)
    except Exception as exc:
        events.emit("worker_error", error=str(exc))
        raise


async def _run(run_dir: Path, config: RunConfig, events: EventWriter) -> None:
    population = json.loads(
        (run_dir / "population.json").read_text(encoding="utf-8")
    )
    population_agents = population.get("agents", [])
    policies, policy_missing = _load_policies(run_dir, population)
    server = CommandServer(run_dir)

    events.emit(
        "worker_started",
        run_id=config.run_id,
        platform=config.platform,
        policy_missing=policy_missing,
    )

    platforms = (
        ["twitter", "reddit"] if config.platform == "both"
        else [config.platform]
    )
    ctxs: list[_PlatformContext] = []
    hb_status = {"round": 0, "phase": "running"}
    hb_stop = _start_heartbeat_thread(run_dir, hb_status)
    try:
        for platform in platforms:
            ctxs.append(await _build_context(platform, run_dir, config))
        for ctx in ctxs:
            await ctx.env.reset()
            await _seed_round_zero(ctx, population, config)

        stopped = False
        for round_num in range(config.rounds):
            if STOP_REQUESTED.is_set():
                stopped = True
                break
            if await _handle_ipc(server, ctxs, events):
                stopped = True
                break
            hb_status["round"] = round_num
            # keep the prompt per-round beat too (it carries the new round
            # number immediately; the thread fills the gaps in between)
            _write_heartbeat_safe(run_dir, round_num, "running")
            events.emit("round_started", round=round_num)
            sched_rng = random.Random(config.seed * 100003 + round_num)
            actions_taken = 0
            for ctx in ctxs:
                actions_taken += await _run_platform_round(
                    ctx, round_num, config, population_agents, policies,
                    sched_rng, events,
                )
            if config.cross_feed and len(ctxs) == 2:
                await _cross_feed(ctxs, config)
            events.emit(
                "round_finished", round=round_num,
                actions_taken=actions_taken,
            )

        events.emit("sim_finished", stopped=stopped)
        if config.wait_after and not stopped:
            # flip the heartbeat phase so the supervisor's governor frees
            # this run's concurrency slot while we idle for interviews
            hb_status["phase"] = "waiting"
            _write_heartbeat_safe(run_dir, hb_status["round"], "waiting")
            await _wait_mode(server, ctxs, events)
    finally:
        hb_stop.set()
        for ctx in ctxs:
            try:
                await ctx.env.close()
            except Exception as exc:  # shutdown must not mask body errors
                log.warning("env.close failed on %s: %s", ctx.platform, exc)
