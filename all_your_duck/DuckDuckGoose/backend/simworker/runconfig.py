"""Run configuration (run.json) — the worker's ONLY input contract."""

import json
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field


class EndpointConfig(BaseModel):
    base_url: str
    api_key: str = ""
    model: str
    max_concurrency: int = Field(default=4, gt=0)


class TierEndpoints(BaseModel):
    protagonist: Optional[EndpointConfig] = None
    crowd_llm: Optional[EndpointConfig] = None


class TimeDials(BaseModel):
    minutes_per_round: int = Field(default=30, gt=0)
    agents_per_round_min: int = Field(default=5, ge=0)
    agents_per_round_max: int = Field(default=20, ge=0)
    peak_hours: list[int] = [9, 10, 11, 14, 15, 20, 21, 22]
    off_peak_hours: list[int] = [0, 1, 2, 3, 4, 5]
    peak_multiplier: float = 1.5
    off_peak_multiplier: float = 0.3


class InitialPost(BaseModel):
    agent_uid: str
    content: str


class RunConfig(BaseModel):
    run_id: str
    platform: Literal["twitter", "reddit", "both"]
    rounds: int = Field(ge=1)
    seed: int = 0
    endpoints: TierEndpoints
    time_dials: TimeDials = TimeDials()
    initial_posts: list[InitialPost] = []
    cross_feed: bool = False
    cross_feed_top_j: int = Field(default=3, ge=1)
    semaphore: int = Field(default=8, gt=0)
    # When False the engine returns right after sim_finished instead of
    # entering the post-loop IPC wait mode (used by the offline E2E smoke).
    wait_after: bool = True


def load_run_config(run_dir: Path) -> RunConfig:
    return RunConfig(
        **json.loads((Path(run_dir) / "run.json").read_text(encoding="utf-8"))
    )
