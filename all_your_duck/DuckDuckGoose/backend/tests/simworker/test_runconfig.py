import json

import pytest
from pydantic import ValidationError

from simworker.runconfig import RunConfig, load_run_config

GOOD = {
    "run_id": "run_abc123", "platform": "reddit", "rounds": 3, "seed": 42,
    "endpoints": {
        "protagonist": {"base_url": "http://localhost:11434/v1",
                        "api_key": "x", "model": "gemma3:4b",
                        "max_concurrency": 2},
        "crowd_llm": None,
    },
    "time_dials": {"minutes_per_round": 30, "agents_per_round_min": 2,
                   "agents_per_round_max": 4, "peak_hours": [9],
                   "off_peak_hours": [3], "peak_multiplier": 1.5,
                   "off_peak_multiplier": 0.3},
    "initial_posts": [{"agent_uid": "agent_x", "content": "seed"}],
    "cross_feed": False, "cross_feed_top_j": 3, "semaphore": 4,
}


def test_load_run_config(tmp_path):
    (tmp_path / "run.json").write_text(json.dumps(GOOD), encoding="utf-8")
    cfg = load_run_config(tmp_path)
    assert cfg.platform == "reddit" and cfg.rounds == 3
    assert cfg.endpoints.protagonist.model == "gemma3:4b"
    assert cfg.endpoints.crowd_llm is None


def test_rejects_bad_platform():
    with pytest.raises(ValidationError):
        RunConfig(**{**GOOD, "platform": "myspace"})


def test_rejects_zero_rounds():
    with pytest.raises(ValidationError):
        RunConfig(**{**GOOD, "rounds": 0})


def test_defaults_applied():
    minimal = {k: v for k, v in GOOD.items()
               if k in ("run_id", "platform", "rounds", "seed", "endpoints")}
    cfg = RunConfig(**minimal)
    assert cfg.time_dials.minutes_per_round == 30
    assert cfg.cross_feed is False and cfg.semaphore == 8
