"""Per-run, per-agent Talk transcript persistence.

Operator ask: interview / persona-chat Q&A must survive switching agents,
reloading the page, and re-opening the project later — not vanish with the
Vue component's memory. Stored append-only as one JSONL file per agent under
run_dir/transcripts/<agent_uid>.jsonl. Persistence is best-effort: a write
failure must never break the live interview/chat response, so callers wrap
append_turn and swallow exceptions.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

TRANSCRIPTS_DIR = "transcripts"
# agent_uids are "agent_<16 hex>" — restrict to a safe filename charset so a
# crafted agent_uid can never escape the transcripts/ directory.
_AGENT_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _agent_file(run_dir, agent_uid: str) -> Path | None:
    if not _AGENT_RE.match(agent_uid or ""):
        return None
    return Path(run_dir) / TRANSCRIPTS_DIR / f"{agent_uid}.jsonl"


def append_turn(run_dir, agent_uid: str, question: str, answer, mode: str) -> None:
    """Append one Q&A turn for an agent. mode is 'interview' | 'chat'."""
    path = _agent_file(run_dir, agent_uid)
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    turn = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "question": str(question),
        "answer": answer,
    }
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(turn, ensure_ascii=False) + "\n")


def read_turns(run_dir, agent_uid: str) -> list[dict]:
    """All saved turns for an agent, oldest-first. Empty if none / unknown."""
    path = _agent_file(run_dir, agent_uid)
    if path is None or not path.exists():
        return []
    turns = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            turns.append(json.loads(line))
        except json.JSONDecodeError:
            continue  # a torn final line never loses the rest of the history
    return turns


def agents_with_transcripts(run_dir) -> list[str]:
    """agent_uids that have any saved transcript (for a 'has history' hint)."""
    d = Path(run_dir) / TRANSCRIPTS_DIR
    if not d.is_dir():
        return []
    return sorted(p.stem for p in d.glob("*.jsonl"))
