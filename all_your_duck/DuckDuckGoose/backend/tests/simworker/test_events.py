from simworker.events import EventReader, EventWriter


def test_writer_assigns_sequence_and_schema(tmp_path):
    w = EventWriter(tmp_path)
    w.emit("worker_started", platform="twitter")
    w.emit("action", agent_uid="agent_x", action_type="CREATE_POST",
           content="hi", round=1)
    events = EventReader(tmp_path).read_from(0)
    assert [e["seq"] for e in events] == [0, 1]
    assert all(e["v"] == 1 and e["ts"] for e in events)
    assert events[1]["kind"] == "action"
    assert events[1]["agent_uid"] == "agent_x"


def test_reader_tails_incrementally(tmp_path):
    w = EventWriter(tmp_path)
    w.emit("round_started", round=0)
    r = EventReader(tmp_path)
    first = r.read_from(0)
    assert len(first) == 1
    w.emit("round_finished", round=0)
    more = r.read_from(first[-1]["seq"] + 1)
    assert len(more) == 1 and more[0]["kind"] == "round_finished"


def test_reader_skips_corrupt_lines(tmp_path):
    w = EventWriter(tmp_path)
    w.emit("worker_started")
    with (tmp_path / "events.jsonl").open("a", encoding="utf-8") as f:
        f.write("{corrupt json\n")
    w.emit("sim_finished")
    events = EventReader(tmp_path).read_from(0)
    assert [e["kind"] for e in events] == ["worker_started", "sim_finished"]


def test_reader_empty_dir(tmp_path):
    assert EventReader(tmp_path).read_from(0) == []
