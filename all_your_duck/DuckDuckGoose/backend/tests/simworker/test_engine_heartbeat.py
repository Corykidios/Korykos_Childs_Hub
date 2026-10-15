"""Unit test for the engine's background heartbeat thread (no env, no
OASIS): the thread must beat on its interval and reflect the shared
round/phase status the round loop maintains."""

import time

from simworker import engine
from simworker.ipc import read_heartbeat


def _wait_for(predicate, timeout=5.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return True
        time.sleep(0.02)
    return False


def test_heartbeat_thread_beats_and_tracks_status(tmp_path, monkeypatch):
    monkeypatch.setattr(engine, "_HEARTBEAT_INTERVAL_SECONDS", 0.05)
    status = {"round": 3, "phase": "running"}
    stop = engine._start_heartbeat_thread(tmp_path, status)
    try:
        seen = {}

        def first_beat():
            hb = read_heartbeat(tmp_path)
            if hb is not None:
                seen.update(hb)
                return True
            return False

        assert _wait_for(first_beat)
        assert seen["round"] == 3
        assert seen["phase"] == "running"
        assert seen["pid"] > 0 and seen["ts"]

        # the round loop mutates the shared status; later beats reflect it
        status["round"] = 4
        status["phase"] = "waiting"

        def waiting_seen():
            hb = read_heartbeat(tmp_path)
            return (
                hb is not None
                and hb.get("phase") == "waiting"
                and hb.get("round") == 4
            )

        assert _wait_for(waiting_seen)
    finally:
        stop.set()
