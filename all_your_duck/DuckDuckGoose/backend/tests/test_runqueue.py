"""Run queue tests. No real OASIS worker anywhere.

Workers are faked through the ``runqueue._worker_argv`` seam: a tiny
``python -c`` script that writes heartbeat.json (its own pid) into its cwd
(the run dir, because the spawner sets cwd=run_dir) and then sleeps. It
deliberately IGNORES IPC so stop_run's tree-kill fallback gets exercised
for real."""

import json
import subprocess
import sys
import threading
import time
from datetime import datetime, timedelta, timezone

import pytest

import app.core.config as config_mod
from app.core.profiles import EndpointProfile, ProfileStore
from app.core.projects import ProjectStore
from app.services import runqueue
from simworker.events import EventWriter
from simworker.runconfig import load_run_config

PROTO_UID = "agent_" + "a" * 16
CROWD_LLM_UID = "agent_" + "b" * 16
POLICY_UID = "agent_" + "c" * 16

FAKE_WORKER_ARGV = [
    sys.executable,
    "-c",
    (
        "import datetime as dt, json, os, time\n"
        "f = open('heartbeat.json', 'w')\n"
        "json.dump({'pid': os.getpid(),"
        " 'ts': dt.datetime.now(dt.timezone.utc).isoformat(),"
        " 'round': 0}, f)\n"
        "f.close()\n"
        "time.sleep(60)\n"
    ),
]


def fake_worker_argv(run_dir):
    return list(FAKE_WORKER_ARGV)


def wait_for(predicate, timeout=10.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.05)
    return False


def _agent(uid, name, tier):
    return {
        "agent_uid": uid, "kind": "public", "name": name,
        "username": f"u_{uid[-4:]}", "bio": f"bio {name}",
        "persona": f"persona {name}", "age": 30, "gender": "female",
        "mbti": "ENFP", "country": "France", "profession": "p",
        "interested_topics": [], "anchor_uuid": None,
        "source_entity_uuid": None, "persona_status": "ok", "tier": tier,
        "activity_level": 1.0, "active_hours": list(range(24)),
    }


def write_population(project_dir):
    """population.json + policies/ for one protagonist, one crowd_llm and
    one crowd_policy agent (mirrors tests/population/test_export.py)."""
    population = {
        "agents": [
            _agent(PROTO_UID, "Alice", "protagonist"),
            _agent(CROWD_LLM_UID, "Bob", "crowd_llm"),
            _agent(POLICY_UID, "Cara", "crowd_policy"),
        ],
        "follow_edges": [{"follower": POLICY_UID, "followee": PROTO_UID}],
        "protagonist_uids": [PROTO_UID],
        "dials": {}, "key_topics": [],
        "persona_failures": [], "policy_failures": [],
    }
    (project_dir / "population.json").write_text(
        json.dumps(population), encoding="utf-8"
    )
    policies = project_dir / "policies"
    policies.mkdir(exist_ok=True)
    (policies / f"{POLICY_UID}.json").write_text(
        json.dumps({"agent_uid": POLICY_UID}), encoding="utf-8"
    )


def bind_profiles(protagonist=True, crowd=False):
    profiles = ProfileStore(config_mod.Config.SETTINGS_FILE)
    if protagonist:
        profiles.upsert(EndpointProfile(
            name="proto", base_url="http://localhost:1/v1", api_key="k",
            model="proto-model", max_concurrency=2,
        ))
        profiles.bind_role("protagonist_brain", "proto")
    if crowd:
        profiles.upsert(EndpointProfile(
            name="crowd", base_url="http://localhost:1/v1", api_key="k",
            model="crowd-model", max_concurrency=2,
        ))
        profiles.bind_role("crowd_llm_brain", "crowd")


def _dials(**overrides):
    dials = {"platform": "twitter", "rounds": 2, "seed": 7}
    dials.update(overrides)
    return dials


def patch_config(monkeypatch, tmp_path):
    """Point Config paths at tmp_path. tests/test_config.py reloads
    app.core.config, so modules imported at collection time (runqueue,
    the api blueprints) can hold a DIFFERENT Config class object than
    app.core.config.Config — patch every distinct one."""
    for cls in {config_mod.Config, runqueue.Config}:
        monkeypatch.setattr(cls, "PROJECTS_DIR", tmp_path / "projects")
        monkeypatch.setattr(cls, "TASK_DB_PATH", tmp_path / "app.db")
        monkeypatch.setattr(cls, "SETTINGS_FILE", tmp_path / "settings.json")


@pytest.fixture
def store(tmp_path, monkeypatch):
    patch_config(monkeypatch, tmp_path)
    return ProjectStore(tmp_path / "projects")


@pytest.fixture(autouse=True)
def kill_leftover_workers():
    yield
    for pid, proc in list(runqueue._POPENS.items()):
        if proc.poll() is None:
            proc.kill()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                pass
        runqueue._POPENS.pop(pid, None)


def _population_project(store):
    p = store.create(name="t", question="q?")
    write_population(store.project_dir(p["id"]))
    return p


# --- prepare_run -----------------------------------------------------------


def test_prepare_run_creates_complete_run_dir(store):
    bind_profiles()
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials())

    assert runqueue.is_valid_run_id(run_dir.name)
    assert run_dir.parent == store.project_dir(p["id"]) / "runs"
    for name in ("population.json", "export_mapping.json",
                 "twitter_profiles.csv", "run.json", "state.json"):
        assert (run_dir / name).exists(), name
    assert (run_dir / "policies" / f"{POLICY_UID}.json").exists()

    cfg = load_run_config(run_dir)  # run.json must validate as RunConfig
    assert cfg.run_id == run_dir.name
    assert cfg.platform == "twitter" and cfg.rounds == 2 and cfg.seed == 7
    assert cfg.endpoints.protagonist.model == "proto-model"

    state = runqueue.read_state(run_dir)
    assert state["status"] == "queued"
    assert state["batch_id"].startswith("batch_")
    assert state["created_at"]


def test_prepare_run_both_platforms_copies_both_exports(store):
    bind_profiles()
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials(platform="both"))
    assert (run_dir / "twitter_profiles.csv").exists()
    assert (run_dir / "reddit_profiles.json").exists()
    assert load_run_config(run_dir).platform == "both"


def test_prepare_run_tiered_embeds_crowd_llm_when_bound(store):
    bind_profiles(crowd=True)
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials(tiered=True))
    cfg = load_run_config(run_dir)
    assert cfg.endpoints.protagonist.model == "proto-model"
    assert cfg.endpoints.crowd_llm.model == "crowd-model"


def test_prepare_run_tiered_without_crowd_binding_embeds_null(store):
    bind_profiles(crowd=False)
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials(tiered=True))
    assert load_run_config(run_dir).endpoints.crowd_llm is None


def test_prepare_run_untiered_embeds_protagonist_only(store):
    bind_profiles(crowd=True)  # bound, but tiered=False must ignore it
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials(tiered=False))
    cfg = load_run_config(run_dir)
    assert cfg.endpoints.protagonist is not None
    assert cfg.endpoints.crowd_llm is None


def test_prepare_run_missing_protagonist_binding_raises(store):
    bind_profiles(protagonist=False)
    p = _population_project(store)
    with pytest.raises(ValueError, match="protagonist"):
        runqueue.prepare_run(store, p["id"], _dials())


def test_prepare_run_requires_population(store):
    bind_profiles()
    p = store.create(name="t", question="q?")
    with pytest.raises(ValueError, match="population"):
        runqueue.prepare_run(store, p["id"], _dials())


# --- promote ---------------------------------------------------------------


def test_promote_cap_zero_starts_nothing(store, monkeypatch):
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    bind_profiles()
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials())

    result = runqueue.promote(store, 0)

    assert result["started"] == []
    state = runqueue.read_state(run_dir)
    assert state["status"] == "queued" and "pid" not in state


def test_promote_cap_one_starts_exactly_oldest(store, monkeypatch):
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    bind_profiles()
    p = _population_project(store)
    older = runqueue.prepare_run(store, p["id"], _dials())
    newer = runqueue.prepare_run(store, p["id"], _dials())
    runqueue.update_state(older, created_at="2026-01-01T00:00:00+00:00")
    runqueue.update_state(newer, created_at="2026-01-02T00:00:00+00:00")

    result = runqueue.promote(store, 1)

    assert result["started"] == [older.name]
    state = runqueue.read_state(older)
    assert state["status"] == "running"
    assert isinstance(state["pid"], int) and state["pid"] > 0
    assert state["started_at"]
    assert runqueue.read_state(newer)["status"] == "queued"

    # the fake worker writes its heartbeat into the run dir (cwd)
    assert wait_for(lambda: (older / "heartbeat.json").exists())
    # cap still honored on the next pass: the live worker holds the slot
    again = runqueue.promote(store, 1)
    assert again["started"] == [] and again["running"] == 1
    assert runqueue.read_state(newer)["status"] == "queued"


def test_promote_concurrent_calls_spawn_exactly_once(store, monkeypatch):
    """Regression: promote() is called from parallel Flask request threads
    (every runs route promotes on entry); without serialization two scans
    could each spawn a worker for the SAME queued run."""
    spawn_calls = []

    def counting_argv(run_dir):
        spawn_calls.append(run_dir.name)
        return list(FAKE_WORKER_ARGV)

    monkeypatch.setattr(runqueue, "_worker_argv", counting_argv)
    bind_profiles()
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials())

    barrier = threading.Barrier(2)
    results = []

    def promote_once():
        barrier.wait()
        results.append(runqueue.promote(store, 1))

    threads = [threading.Thread(target=promote_once) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)

    assert spawn_calls == [run_dir.name]  # exactly ONE Popen, ever
    assert sorted(r["started"] for r in results) == [[], [run_dir.name]]
    state = runqueue.read_state(run_dir)
    assert state["status"] == "running"
    assert isinstance(state["pid"], int) and state["pid"] > 0


def _write_heartbeat_file(run_dir, ts, phase=None, pid=12345):
    payload = {"pid": pid, "ts": ts, "round": 1}
    if phase is not None:
        payload["phase"] = phase
    (run_dir / "heartbeat.json").write_text(
        json.dumps(payload), encoding="utf-8"
    )


def test_promote_alive_stale_heartbeat_still_occupies_slot(store, monkeypatch):
    """Over-admit regression: a single live-LLM round can exceed any fixed
    heartbeat freshness window; a live worker whose heartbeat says
    phase=running must KEEP its slot no matter how old the beat is."""
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    bind_profiles()
    p = _population_project(store)
    first = runqueue.prepare_run(store, p["id"], _dials())
    runqueue.update_state(first, created_at="2026-01-01T00:00:00+00:00")
    assert runqueue.promote(store, 1)["started"] == [first.name]
    assert wait_for(lambda: (first / "heartbeat.json").exists())

    # simulate being 10 minutes into one long round: stale heartbeat ts,
    # stale started_at, phase still "running", process alive
    old_ts = (datetime.now(timezone.utc) - timedelta(seconds=600)).isoformat()
    _write_heartbeat_file(first, old_ts, phase="running")
    runqueue.update_state(first, started_at=old_ts)
    queued = runqueue.prepare_run(store, p["id"], _dials())

    result = runqueue.promote(store, 1)
    assert result["started"] == []
    assert result["running"] == 1
    assert runqueue.read_state(queued)["status"] == "queued"
    assert runqueue.read_state(first)["status"] == "running"


def test_promote_waiting_phase_frees_slot(store, monkeypatch):
    """A live worker idling in post-loop wait mode (phase=waiting, kept
    alive for interviews) must NOT hold a concurrency slot."""
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    bind_profiles()
    p = _population_project(store)
    first = runqueue.prepare_run(store, p["id"], _dials())
    runqueue.update_state(first, created_at="2026-01-01T00:00:00+00:00")
    runqueue.promote(store, 1)
    assert wait_for(lambda: (first / "heartbeat.json").exists())

    fresh_ts = datetime.now(timezone.utc).isoformat()
    _write_heartbeat_file(first, fresh_ts, phase="waiting")
    queued = runqueue.prepare_run(store, p["id"], _dials())

    result = runqueue.promote(store, 1)
    assert result["started"] == [queued.name]
    # the waiting worker is left alone, still up for interviews
    assert runqueue.read_state(first)["status"] == "running"


def test_occupies_slot_conservative_without_phase(tmp_path):
    # no heartbeat yet (worker still building its graph) -> occupied
    assert runqueue._occupies_slot(tmp_path) is True
    # heartbeat without a phase key (older format) -> occupied
    _write_heartbeat_file(
        tmp_path, datetime.now(timezone.utc).isoformat()
    )
    assert runqueue._occupies_slot(tmp_path) is True


def _dead_pid() -> int:
    proc = subprocess.Popen([sys.executable, "-c", "pass"])
    proc.wait()
    return proc.pid


def test_promote_marks_stale_dead_run_failed(store, monkeypatch):
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    bind_profiles()
    p = _population_project(store)
    dead = runqueue.prepare_run(store, p["id"], _dials())
    queued = runqueue.prepare_run(store, p["id"], _dials())
    runqueue.update_state(queued, created_at="2026-01-02T00:00:00+00:00")
    old_ts = (datetime.now(timezone.utc) - timedelta(seconds=300)).isoformat()
    runqueue.update_state(
        dead, status="running", pid=_dead_pid(),
        started_at=old_ts, created_at="2026-01-01T00:00:00+00:00",
    )
    (dead / "heartbeat.json").write_text(
        json.dumps({"pid": 0, "ts": old_ts, "round": 0}), encoding="utf-8"
    )

    result = runqueue.promote(store, 1)

    state = runqueue.read_state(dead)
    assert state["status"] == "failed"
    assert state["message"]
    # the freed slot goes to the queued run
    assert result["started"] == [queued.name]


def test_promote_marks_clean_dead_run_finished(store, monkeypatch):
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    bind_profiles()
    p = _population_project(store)
    dead = runqueue.prepare_run(store, p["id"], _dials())
    old_ts = (datetime.now(timezone.utc) - timedelta(seconds=300)).isoformat()
    runqueue.update_state(dead, status="running", pid=_dead_pid(),
                          started_at=old_ts)
    EventWriter(dead).emit("sim_finished", stopped=False)

    runqueue.promote(store, 1)

    assert runqueue.read_state(dead)["status"] == "finished"


# --- stop_run --------------------------------------------------------------


def test_stop_run_kills_fake_worker(store, monkeypatch):
    monkeypatch.setattr(runqueue, "_worker_argv", fake_worker_argv)
    monkeypatch.setattr(runqueue, "STOP_GRACE_SECONDS", 0.5)
    bind_profiles()
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials())
    runqueue.promote(store, 1)
    pid = runqueue.read_state(run_dir)["pid"]
    assert wait_for(lambda: (run_dir / "heartbeat.json").exists())

    state = runqueue.stop_run(run_dir)

    assert state["status"] == "stopped"
    assert wait_for(lambda: not runqueue._pid_alive(pid))
    # the IPC stop was sent before the kill (fake worker never consumes it)
    assert list((run_dir / "ipc" / "commands").glob("*.json"))


def test_stop_run_on_queued_run_dequeues(store):
    bind_profiles()
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials())
    assert runqueue.stop_run(run_dir)["status"] == "stopped"


# --- run id guard ----------------------------------------------------------


def test_run_id_guard_rejects_invalid_ids():
    assert runqueue.is_valid_run_id("run_" + "a1" * 6)
    for bad in ("", None, "run_" + "A" * 12, "run_" + "a" * 11,
                "run_" + "a" * 13, "run_../../etc", "..\\..\\x",
                "run_zzzzzzzzzzzz", "proj_" + "a" * 12):
        assert not runqueue.is_valid_run_id(bad), bad


def test_run_dir_for_invalid_or_absent_reads_as_none(store):
    bind_profiles()
    p = _population_project(store)
    run_dir = runqueue.prepare_run(store, p["id"], _dials())
    assert runqueue.run_dir_for(store, p["id"], run_dir.name) == run_dir
    assert runqueue.run_dir_for(store, p["id"], "run_" + "f" * 12) is None
    assert runqueue.run_dir_for(store, p["id"], "../escape") is None
    assert runqueue.run_dir_for(store, "../escape", run_dir.name) is None
