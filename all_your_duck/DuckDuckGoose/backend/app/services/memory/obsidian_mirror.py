"""Mirror agent state into an Obsidian-compatible vault of Markdown notes.

One note per agent. The note is a plain Markdown file with a YAML frontmatter
block, so it is readable in Obsidian, in any editor, or by `cat`. Memory
entries are appended as a running timestamped log rather than rewritten, so a
long simulation leaves a chronological trail instead of a single final state.

Nothing in the app reads these notes back; they are an export surface.
"""

import logging
from datetime import datetime
from pathlib import Path

from app.core.config import Config

logger = logging.getLogger(__name__)

# Characters Windows forbids in a filename, mapped to a single safe stand-in.
_ILLEGAL_FILENAME_CHARS = '<>:"/\\|?*'
_FILENAME_TRANSLATION = {ord(c): "_" for c in _ILLEGAL_FILENAME_CHARS}
_MAX_FILENAME_STEM = 100

_VAULT_TAGS = ("duckduckgoose", "agent")

_PERSONALITY_HEADING = "Personality"
_BELIEFS_HEADING = "Current Beliefs"
_MEMORY_HEADING = "Memory Log"


def _vault_path() -> Path:
    """Resolve the agents vault directory at call time.

    Read on every call rather than cached at import, so tests (and a settings
    change at runtime) can repoint the vault without reloading the module.
    """
    return Path(Config.OBSIDIAN_AGENTS_DIR)


def _safe_filename(name: str) -> str:
    """Reduce an agent name to something safe to use as a file stem."""
    collapsed = " ".join(name.split())
    return collapsed.translate(_FILENAME_TRANSLATION)[:_MAX_FILENAME_STEM]


def _note_path(agent_name: str) -> Path:
    """Absolute path of an agent's note, creating the vault dir if needed."""
    vault = _vault_path()
    vault.mkdir(parents=True, exist_ok=True)
    return vault / f"{_safe_filename(agent_name)}.md"


def _frontmatter(agent_name: str, simulation_id: str) -> list[str]:
    """YAML frontmatter block, as individual lines."""
    fields = {
        "agent": agent_name,
        "simulation": simulation_id,
        "updated": datetime.now().strftime("%Y-%m-%d"),
    }
    lines = ["---"]
    lines += [f"{key}: {value}" for key, value in fields.items()]
    lines.append("tags:")
    lines += [f"  - {tag}" for tag in _VAULT_TAGS]
    lines.append("---")
    return lines


def _bulleted(items: list[str], empty: str) -> str:
    """Render a bullet list, or a placeholder when there is nothing to show."""
    if not items:
        return empty
    return "\n".join(f"- {item}" for item in items)


def _format_note(
    agent_name: str,
    personality: str,
    beliefs: list[str],
    simulation_id: str,
) -> str:
    """Assemble the full note body."""
    sections = [
        (_PERSONALITY_HEADING, personality or "(not yet defined)"),
        (_BELIEFS_HEADING, _bulleted(beliefs, "- (none yet)")),
        (_MEMORY_HEADING, ""),
    ]

    blocks = ["\n".join(_frontmatter(agent_name, simulation_id)), f"# {agent_name}"]
    blocks += [f"## {heading}\n{body}".rstrip() for heading, body in sections]
    return "\n\n".join(blocks) + "\n"


def write_agent_note(
    agent_name: str,
    personality: str,
    beliefs: list[str],
    simulation_id: str,
) -> None:
    """Create or replace an agent's note.

    Overwrites any existing note, including its memory log. Use
    `append_agent_memory` to add to a note without discarding history.
    """
    path = _note_path(agent_name)
    path.write_text(
        _format_note(agent_name, personality, beliefs, simulation_id),
        encoding="utf-8",
    )
    logger.debug("Wrote Obsidian note for agent '%s'", agent_name)


def append_agent_memory(agent_name: str, memory_entry: str) -> None:
    """Append one timestamped line to an agent's memory log.

    If the agent has no note yet, a minimal one is created first so the entry
    is never silently dropped.
    """
    path = _note_path(agent_name)
    if not path.exists():
        write_agent_note(agent_name, "", [], "unknown")

    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    with path.open("a", encoding="utf-8") as handle:
        handle.write(f"- {stamp}: {memory_entry}\n")
