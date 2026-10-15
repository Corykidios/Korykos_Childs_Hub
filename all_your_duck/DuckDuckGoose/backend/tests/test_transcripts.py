from app.services import transcripts


def test_append_then_read_roundtrips_oldest_first(tmp_path):
    transcripts.append_turn(tmp_path, "agent_abc", "Q1?", "A1", "interview")
    transcripts.append_turn(tmp_path, "agent_abc", "Q2?", "A2", "chat")
    turns = transcripts.read_turns(tmp_path, "agent_abc")
    assert [t["question"] for t in turns] == ["Q1?", "Q2?"]
    assert [t["answer"] for t in turns] == ["A1", "A2"]
    assert [t["mode"] for t in turns] == ["interview", "chat"]
    assert all(t.get("ts") for t in turns)


def test_turns_are_isolated_per_agent_and_per_run(tmp_path):
    run_a, run_b = tmp_path / "runA", tmp_path / "runB"
    transcripts.append_turn(run_a, "agent_1", "to one", "x", "interview")
    transcripts.append_turn(run_a, "agent_2", "to two", "y", "interview")
    transcripts.append_turn(run_b, "agent_1", "other run", "z", "interview")
    assert [t["question"] for t in transcripts.read_turns(run_a, "agent_1")] == ["to one"]
    assert [t["question"] for t in transcripts.read_turns(run_a, "agent_2")] == ["to two"]
    assert [t["question"] for t in transcripts.read_turns(run_b, "agent_1")] == ["other run"]


def test_unknown_agent_or_run_reads_empty(tmp_path):
    assert transcripts.read_turns(tmp_path, "agent_missing") == []
    assert transcripts.agents_with_transcripts(tmp_path) == []


def test_answer_can_be_a_structured_object(tmp_path):
    payload = {"result": {"response": "in character"}, "post_id": 7}
    transcripts.append_turn(tmp_path, "agent_x", "say something", payload, "interview")
    assert transcripts.read_turns(tmp_path, "agent_x")[0]["answer"] == payload


def test_path_traversal_agent_uid_is_refused_not_written(tmp_path):
    transcripts.append_turn(tmp_path, "../../etc/passwd", "hack", "no", "interview")
    transcripts.append_turn(tmp_path, "a/b", "hack", "no", "chat")
    # nothing escaped the run dir; unsafe ids simply no-op
    assert not (tmp_path / transcripts.TRANSCRIPTS_DIR).exists()
    assert transcripts.read_turns(tmp_path, "../../etc/passwd") == []


def test_agents_with_transcripts_lists_only_written(tmp_path):
    transcripts.append_turn(tmp_path, "agent_b", "q", "a", "interview")
    transcripts.append_turn(tmp_path, "agent_a", "q", "a", "chat")
    assert transcripts.agents_with_transcripts(tmp_path) == ["agent_a", "agent_b"]


def test_torn_final_line_does_not_lose_prior_history(tmp_path):
    transcripts.append_turn(tmp_path, "agent_z", "good", "ok", "interview")
    path = tmp_path / transcripts.TRANSCRIPTS_DIR / "agent_z.jsonl"
    with path.open("a", encoding="utf-8") as f:
        f.write('{"ts": "x", "question": "torn"')  # no newline, invalid JSON
    turns = transcripts.read_turns(tmp_path, "agent_z")
    assert [t["question"] for t in turns] == ["good"]
