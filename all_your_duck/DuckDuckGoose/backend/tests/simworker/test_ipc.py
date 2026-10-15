import pytest

from simworker.ipc import (
    CommandClient,
    CommandServer,
    read_heartbeat,
    write_heartbeat,
)


def test_command_roundtrip(tmp_path):
    client = CommandClient(tmp_path)
    server = CommandServer(tmp_path)

    cmd_id = client.send("interview", {"agent_uid": "agent_x", "prompt": "hi"})
    cmd = server.poll()
    assert cmd["command_id"] == cmd_id
    assert cmd["command_type"] == "interview"
    assert cmd["args"]["agent_uid"] == "agent_x"

    server.respond(cmd_id, "completed", result={"response": "hello"})
    resp = client.read_response(cmd_id)
    assert resp["status"] == "completed"
    assert resp["result"]["response"] == "hello"
    # command file consumed
    assert server.poll() is None


def test_poll_returns_oldest_first(tmp_path):
    client = CommandClient(tmp_path)
    server = CommandServer(tmp_path)
    a = client.send("pause", {})
    b = client.send("stop", {})
    first = server.poll()
    server.respond(first["command_id"], "completed")
    second = server.poll()
    assert [first["command_id"], second["command_id"]] == [a, b]


def test_read_response_missing_returns_none(tmp_path):
    assert CommandClient(tmp_path).read_response("nope") is None


def test_heartbeat_roundtrip(tmp_path):
    write_heartbeat(tmp_path, round_num=3)
    hb = read_heartbeat(tmp_path)
    assert hb["round"] == 3
    assert hb["pid"] > 0
    assert hb["ts"]


def test_heartbeat_phase_default_and_explicit(tmp_path):
    write_heartbeat(tmp_path, round_num=1)
    assert read_heartbeat(tmp_path)["phase"] == "running"
    write_heartbeat(tmp_path, round_num=2, phase="waiting")
    hb = read_heartbeat(tmp_path)
    assert hb["phase"] == "waiting"
    assert hb["round"] == 2


def test_read_heartbeat_missing_returns_none(tmp_path):
    assert read_heartbeat(tmp_path) is None
