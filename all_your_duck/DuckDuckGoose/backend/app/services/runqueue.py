"""Run queue: prepare run dirs, govern worker concurrency, stop workers.

Workers are SUBPROCESSES (``python -m simworker --run-dir <dir>``), not
threads: OASIS owns an event loop and the worker must be killable as a
process TREE. Everything a worker needs lives inside its run dir
(``project_dir/runs/<run_id>/``) — run.json with EMBEDDED endpoint dicts,
exported profiles, population, policies — so the worker never reads app
settings.

This module imports ``simworker.ipc`` / ``simworker.events`` /
``simworker.runconfig`` ONLY (the shared protocol; allowed direction —
simworker never imports app).

Run lifecycle, tracked in a sibling ``state.json`` (the worker never
touches it): queued -> running -> finished | failed | stopped.
- ``promote()`` flips queued->running (spawns a worker) and running->
  failed/finished when the pid is gone. It is polling-driven: every runs
  API request calls it; there is no background scheduler (honest v1).
  The whole scan+spawn pass is serialized by a module-level lock —
  parallel Flask request threads would otherwise double-spawn the SAME
  queued run.
- A live worker occupies a concurrency slot unless its heartbeat reports
  phase == "waiting" (post-loop wait mode: alive for interviews only).
  Heartbeat freshness does NOT gate the slot — one live-LLM round can
  outlast any fixed freshness window; pid liveness is authoritative.
- ``finished`` is set when a dead worker's event stream contains
  ``sim_finished``; otherwise a dead "running" run is ``failed``. (With
  run.json's default ``wait_after=True`` workers idle for interviews after
  the loop, so the normal terminal state is ``stopped`` via stop_run.)

State writes are plain last-writer-wins JSON — a single-operator local
tool does not need cross-process file locking.
"""

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import Config
from app.core.profiles import EndpointProfile, ProfileStore
from app.core.projects import ProjectStore
from app.services.population.export import export_population
from simworker.events import EventReader
from simworker.ipc import CommandClient, read_heartbeat
from simworker.runconfig import RunConfig

logger = logging.getLogger(__name__)

_BACKEND_DIR = Path(__file__).resolve().parents[2]

# Strict id format — also the path-traversal guard (mirrors ProjectStore):
# a run_id is only ever joined into filesystem paths after matching this.
_RUN_ID_RE = re.compile(r"^run_[0-9a-f]{12}$")

STATE_FILE = "state.json"
STOP_GRACE_SECONDS = 10.0  # tests shrink this
_STOP_POLL_SECONDS = 0.25

# Serializes the whole promote() scan+spawn pass. Every runs route
# promotes on entry and the UI polls several endpoints at once, so
# concurrent calls are the NORM — without this, two scans both see the
# same queued run and both spawn a worker into its run dir (corrupted
# events.jsonl seqs, two processes fighting over the sqlite file).
_PROMOTE_LOCK = threading.Lock()

_PLATFORM_FILES = {
    "twitter": "twitter_profiles.csv",
    "reddit": "reddit_profiles.json",
}

# pid -> Popen for workers spawned by THIS process. poll() both reaps the
# child (no POSIX zombies) and is immune to pid reuse; pids not in here
# (e.g. after a supervisor restart) fall back to the OS liveness check.
_POPENS: dict[int, subprocess.Popen] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_valid_run_id(run_id) -> bool:
    return bool(_RUN_ID_RE.match(run_id or ""))


def run_dir_for(store: ProjectStore, project_id: str, run_id: str):
    """The run dir, or None. Invalid ids (incl. traversal probes) and runs
    without a state.json read as absent — mirrors ProjectStore.get."""
    if not store.is_valid_id(project_id) or not is_valid_run_id(run_id):
        return None
    run_dir = store.project_dir(project_id) / "runs" / run_id
    return run_dir if (run_dir / STATE_FILE).exists() else None


def read_state(run_dir: Path) -> dict | None:
    path = Path(run_dir) / STATE_FILE
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _write_state(run_dir: Path, state: dict) -> None:
    (Path(run_dir) / STATE_FILE).write_text(
        json.dumps(state, indent=2), encoding="utf-8"
    )


def update_state(run_dir: Path, **fields) -> dict:
    state = read_state(run_dir) or {}
    state.update(fields)
    _write_state(run_dir, state)
    return state


# --- prepare ---------------------------------------------------------------


def _endpoint_dict(profile: EndpointProfile | None) -> dict | None:
    """EndpointProfile -> the embedded run.json shape (name dropped: the
    worker never resolves profiles)."""
    if profile is None:
        return None
    return {
        "base_url": profile.base_url,
        "api_key": profile.api_key,
        "model": profile.model,
        "max_concurrency": profile.max_concurrency,
    }


def prepare_run(store: ProjectStore, project_id: str, dials: dict) -> Path:
    """Create and queue ``project_dir/runs/<run_id>/``.

    Copies population.json + export_mapping.json + policies/ + the exported
    profile file(s) for the chosen platform(s), resolves endpoint profiles
    from settings into EMBEDDED dicts (tiered: protagonist_brain +
    crowd_llm_brain; untiered: protagonist only — crowd_llm-tier agents
    then have a null endpoint and the engine leaves them dormant at
    routing, the null-tier rule), writes a validated run.json and a
    state.json of ``{status: queued, batch_id, created_at}``.

    Raises ValueError when the population is not built, the platform is
    unknown, or no protagonist_brain profile is bound; pydantic
    ValidationError (a ValueError) when dials don't form a valid RunConfig.
    """
    project_dir = store.project_dir(project_id)
    if not (project_dir / "population.json").exists():
        raise ValueError("population not built")
    platform = dials.get("platform")
    if platform not in ("twitter", "reddit", "both"):
        raise ValueError(f"unknown platform: {platform!r}")

    profiles = ProfileStore(Config.SETTINGS_FILE)
    protagonist = profiles.resolve_role("protagonist_brain")
    if protagonist is None:
        raise ValueError("no protagonist_brain profile bound in settings")
    tiered = bool(dials.get("tiered", True))
    crowd_llm = profiles.resolve_role("crowd_llm_brain") if tiered else None

    run_id = "run_" + uuid.uuid4().hex[:12]
    run_dir = project_dir / "runs" / run_id
    run_dir.mkdir(parents=True)

    # Exports write into the PROJECT dir; copy the
    # results into the run dir so the worker is self-contained.
    platforms = ("twitter", "reddit") if platform == "both" else (platform,)
    for p in platforms:
        export_population(store, project_id, p)
        shutil.copy2(project_dir / _PLATFORM_FILES[p],
                     run_dir / _PLATFORM_FILES[p])
    shutil.copy2(project_dir / "population.json", run_dir / "population.json")
    shutil.copy2(project_dir / "export_mapping.json",
                 run_dir / "export_mapping.json")
    policies_src = project_dir / "policies"
    if policies_src.is_dir():
        shutil.copytree(policies_src, run_dir / "policies")
    else:
        (run_dir / "policies").mkdir()  # engine treats missing files as skip

    raw = {
        "run_id": run_id,
        "platform": platform,
        "rounds": dials.get("rounds", 1),
        "seed": dials.get("seed", 0),
        "endpoints": {
            "protagonist": _endpoint_dict(protagonist),
            "crowd_llm": _endpoint_dict(crowd_llm),
        },
        "initial_posts": dials.get("initial_posts") or [],
        "cross_feed": bool(dials.get("cross_feed", False)),
    }
    if dials.get("time_dials"):
        raw["time_dials"] = dials["time_dials"]
    config = RunConfig(**raw)  # run.json MUST validate before it is written
    (run_dir / "run.json").write_text(
        config.model_dump_json(indent=2), encoding="utf-8"
    )
    _write_state(run_dir, {
        "status": "queued",
        "batch_id": dials.get("batch_id") or "batch_" + uuid.uuid4().hex[:12],
        "created_at": _now(),
    })
    return run_dir


# --- liveness --------------------------------------------------------------


def _win_pid_alive(pid: int) -> bool:
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.windll.kernel32
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
    STILL_ACTIVE = 259
    handle = kernel32.OpenProcess(
        PROCESS_QUERY_LIMITED_INFORMATION, False, pid
    )
    if not handle:
        return False
    try:
        code = wintypes.DWORD()
        if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
            return False
        return code.value == STILL_ACTIVE
    finally:
        kernel32.CloseHandle(handle)


def _pid_alive(pid) -> bool:
    """True when pid refers to a live process. NEVER os.kill(pid, 0) on
    Windows — signal 0 is CTRL_C_EVENT there and would hit our own console
    group; use OpenProcess/GetExitCodeProcess instead."""
    if not isinstance(pid, int) or pid <= 0:
        return False
    proc = _POPENS.get(pid)
    if proc is not None:
        return proc.poll() is None
    if sys.platform == "win32":
        return _win_pid_alive(pid)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def _occupies_slot(run_dir: Path) -> bool:
    """A LIVE worker (pid-alive is checked by the caller) holds a
    concurrency slot unless its heartbeat reports phase == "waiting"
    (post-loop wait mode: idling for interviews only).

    Heartbeat freshness deliberately does NOT gate the slot: the worker
    beats from a background thread every ~15s, but more importantly a
    single live-LLM round can outlast any fixed freshness window, and
    freeing the slot mid-round would admit a second heavy worker (GPU
    contention — exactly what the governor exists to prevent). Missing,
    torn, or phase-less heartbeats read as occupied (conservative)."""
    heartbeat = read_heartbeat(run_dir)
    if heartbeat is None:
        return True
    return heartbeat.get("phase", "running") != "waiting"


def _finished_cleanly(run_dir: Path) -> bool:
    return any(
        event.get("kind") == "sim_finished"
        for event in EventReader(run_dir).read_from(0)
    )


# --- promote ---------------------------------------------------------------


def _iter_runs(store: ProjectStore):
    for project in store.list():
        runs_root = store.project_dir(project["id"]) / "runs"
        if not runs_root.is_dir():
            continue
        for run_dir in sorted(runs_root.iterdir()):
            if not is_valid_run_id(run_dir.name):
                continue
            state = read_state(run_dir)
            if state is not None:
                yield run_dir, state


def _worker_argv(run_dir: Path) -> list[str]:
    """Worker command line. A SEAM: tests monkeypatch this to substitute a
    fake worker (a tiny ``python -c`` heartbeat-then-sleep script) so no
    real OASIS worker is ever spawned in the suite."""
    return [sys.executable, "-m", "simworker", "--run-dir", str(run_dir)]


def _spawn_worker(run_dir: Path) -> int:
    env = {**os.environ, "PYTHONPATH": str(_BACKEND_DIR), "PYTHONUTF8": "1"}
    kwargs: dict = {}
    if sys.platform == "win32":
        # Own process group: immune to our console's Ctrl+C, and
        # taskkill /T can take the whole tree down.
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    else:
        kwargs["start_new_session"] = True  # killable via os.killpg
    with (run_dir / "worker.log").open("ab") as log_file:
        proc = subprocess.Popen(
            _worker_argv(run_dir),
            cwd=str(run_dir),
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            **kwargs,
        )
    _POPENS[proc.pid] = proc
    logger.info("started worker pid=%s for %s", proc.pid, run_dir.name)
    return proc.pid


def promote(store: ProjectStore, max_concurrent: int) -> dict:
    """One governor pass over ALL projects' runs, serialized by
    _PROMOTE_LOCK (concurrent request threads must not double-spawn).

    1) Audit ``running`` runs: dead pid -> ``finished`` when the event
       stream has sim_finished, else ``failed`` (message recorded);
       live -> occupies a slot unless its heartbeat phase is "waiting".
    2) Start the oldest ``queued`` runs (created_at order) while occupied
       slots < max_concurrent, recording pid + started_at.

    Returns {"running": <occupied slots>, "started": [run_ids]}.
    """
    with _PROMOTE_LOCK:
        return _promote_locked(store, max_concurrent)


def _promote_locked(store: ProjectStore, max_concurrent: int) -> dict:
    occupied = 0
    queued: list[tuple[str, str, Path]] = []
    for run_dir, state in _iter_runs(store):
        status = state.get("status")
        if status == "running":
            if not _pid_alive(state.get("pid")):
                if _finished_cleanly(run_dir):
                    update_state(run_dir, status="finished")
                else:
                    update_state(
                        run_dir, status="failed",
                        message=(
                            "worker process exited without finishing "
                            f"(pid {state.get('pid')} not running)"
                        ),
                    )
            elif _occupies_slot(run_dir):
                occupied += 1
            else:
                # Alive but idling in post-loop wait mode: no slot held and the
                # rounds are done. Surface phase="waiting" into state so the UI
                # shows "interviewable" instead of a misleading "running r{n}".
                # status STAYS "running" — the worker is live and
                # interview-capable, per the wait_after design.
                if state.get("phase") != "waiting":
                    update_state(run_dir, phase="waiting")
        elif status == "queued":
            queued.append(
                (state.get("created_at", ""), run_dir.name, run_dir)
            )

    started: list[str] = []
    for _, run_id, run_dir in sorted(queued):
        if occupied >= max_concurrent:
            break
        pid = _spawn_worker(run_dir)
        update_state(run_dir, status="running", pid=pid, started_at=_now())
        started.append(run_id)
        occupied += 1
    return {"running": occupied, "started": started}


# --- stop ------------------------------------------------------------------


def _kill_tree(pid: int) -> None:
    if sys.platform == "win32":
        subprocess.run(
            ["taskkill", "/T", "/F", "/PID", str(pid)],
            capture_output=True, check=False,
        )
    else:
        import signal

        try:
            os.killpg(os.getpgid(pid), signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            pass


def stop_run(run_dir: Path) -> dict:
    """Stop a run: send the IPC stop command, give the worker up to
    STOP_GRACE_SECONDS to exit on its own, then kill the process tree
    (taskkill /T /F on win32, killpg elsewhere). Always ends with state
    ``stopped``; queued runs are simply dequeued."""
    run_dir = Path(run_dir)
    state = read_state(run_dir) or {}
    pid = state.get("pid")
    if state.get("status") == "running" and _pid_alive(pid):
        try:
            CommandClient(run_dir).send("stop", {})
        except OSError as exc:
            logger.warning("could not send stop command: %s", exc)
        deadline = time.monotonic() + STOP_GRACE_SECONDS
        while _pid_alive(pid) and time.monotonic() < deadline:
            time.sleep(_STOP_POLL_SECONDS)
        if _pid_alive(pid):
            logger.info("worker pid=%s ignored stop; killing tree", pid)
            _kill_tree(pid)
        proc = _POPENS.pop(pid, None)
        if proc is not None:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                logger.warning("worker pid=%s did not exit after kill", pid)
    return update_state(run_dir, status="stopped")
