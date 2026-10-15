"""File-based IPC between supervisor (client) and worker (server).

ONE module, imported by BOTH sides — the protocol cannot drift
(MiroFish re-implemented it from constants in three scripts; that bug
class dies here). stdlib only; no app.* imports."""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

COMMANDS_DIR = "ipc/commands"
RESPONSES_DIR = "ipc/responses"
HEARTBEAT_FILE = "heartbeat.json"

COMMAND_TYPES = ("interview", "pause", "resume", "stop")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CommandClient:
    """Supervisor side: send commands, read responses."""

    def __init__(self, run_dir: Path):
        self._commands = Path(run_dir) / COMMANDS_DIR
        self._responses = Path(run_dir) / RESPONSES_DIR

    def send(self, command_type: str, args: dict) -> str:
        if command_type not in COMMAND_TYPES:
            raise ValueError(f"unknown command type: {command_type}")
        command_id = uuid.uuid4().hex[:12]
        self._commands.mkdir(parents=True, exist_ok=True)
        payload = {
            "command_id": command_id,
            "command_type": command_type,
            "args": args,
            "ts": _now(),
        }
        # write-then-rename so the server never reads a half-written file
        tmp = self._commands / f".{command_id}.tmp"
        tmp.write_text(json.dumps(payload), encoding="utf-8")
        tmp.rename(self._commands / f"{command_id}.json")
        return command_id

    def read_response(self, command_id: str) -> dict | None:
        path = self._responses / f"{command_id}.json"
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))


class CommandServer:
    """Worker side: poll commands oldest-first, write responses."""

    def __init__(self, run_dir: Path):
        self._commands = Path(run_dir) / COMMANDS_DIR
        self._responses = Path(run_dir) / RESPONSES_DIR

    def poll(self) -> dict | None:
        if not self._commands.is_dir():
            return None
        files = sorted(
            (f for f in self._commands.glob("*.json")),
            key=lambda f: f.stat().st_mtime,
        )
        for f in files:
            try:
                return json.loads(f.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                continue
        return None

    def respond(
        self, command_id: str, status: str,
        result: dict | None = None, error: str | None = None,
    ) -> None:
        self._responses.mkdir(parents=True, exist_ok=True)
        (self._responses / f"{command_id}.json").write_text(
            json.dumps({
                "command_id": command_id,
                "status": status,
                "result": result,
                "error": error,
                "ts": _now(),
            }),
            encoding="utf-8",
        )
        try:
            (self._commands / f"{command_id}.json").unlink()
        except OSError:
            pass


def write_heartbeat(
    run_dir: Path, round_num: int, phase: str = "running"
) -> None:
    """phase: "running" while the round loop owns the process, "waiting"
    in post-loop wait mode (alive for interviews only). The supervisor's
    governor frees the concurrency slot of "waiting" workers."""
    (Path(run_dir) / HEARTBEAT_FILE).write_text(
        json.dumps({
            "pid": os.getpid(),
            "ts": _now(),
            "round": round_num,
            "phase": phase,
        }),
        encoding="utf-8",
    )


def read_heartbeat(run_dir: Path) -> dict | None:
    path = Path(run_dir) / HEARTBEAT_FILE
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
