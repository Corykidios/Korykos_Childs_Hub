"""Append-only, schema-versioned event stream.

The worker emits raw events; the supervisor derives everything (metrics,
run state) from this file. v=1 on every line; corrupt lines are skipped
on read (append-only file may catch a torn final line)."""

import json
from datetime import datetime, timezone
from pathlib import Path

EVENTS_FILE = "events.jsonl"
SCHEMA_VERSION = 1


class EventWriter:
    def __init__(self, run_dir: Path):
        self._path = Path(run_dir) / EVENTS_FILE
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._seq = self._resume_seq()

    def _resume_seq(self) -> int:
        if not self._path.exists():
            return 0
        last = -1
        with self._path.open(encoding="utf-8") as f:
            for line in f:
                try:
                    last = json.loads(line)["seq"]
                except (json.JSONDecodeError, KeyError):
                    continue
        return last + 1

    def emit(self, kind: str, **fields) -> dict:
        event = {
            "v": SCHEMA_VERSION,
            "seq": self._seq,
            "ts": datetime.now(timezone.utc).isoformat(),
            "kind": kind,
            **fields,
        }
        with self._path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
        self._seq += 1
        return event


class EventReader:
    def __init__(self, run_dir: Path):
        self._path = Path(run_dir) / EVENTS_FILE

    def read_from(self, seq: int) -> list[dict]:
        if not self._path.exists():
            return []
        out = []
        with self._path.open(encoding="utf-8") as f:
            for line in f:
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if event.get("seq", -1) >= seq:
                    out.append(event)
        return out
