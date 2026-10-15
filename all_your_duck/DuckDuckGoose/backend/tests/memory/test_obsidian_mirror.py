"""Obsidian mirror: note creation, memory appending, filename safety.

The vault directory comes from Config.OBSIDIAN_AGENTS_DIR, which the conftest
`isolated_dirs` fixture repoints at tmp_path / "agents".
"""

import pytest

from app.services.memory.obsidian_mirror import (
    _safe_filename,
    append_agent_memory,
    write_agent_note,
)


def _vault(tmp_path):
    return tmp_path / "agents"


def test_write_agent_note_records_every_field(tmp_path):
    write_agent_note(
        "TradingBot", "Aggressive momentum trader", ["Oil will rise"], "sim-001"
    )

    note = _vault(tmp_path) / "TradingBot.md"
    assert note.exists()

    content = note.read_text(encoding="utf-8")
    for expected in ("TradingBot", "Aggressive momentum trader", "Oil will rise", "sim-001"):
        assert expected in content


def test_note_opens_with_parseable_frontmatter(tmp_path):
    write_agent_note("Analyst", "Cautious", ["Rates hold"], "sim-002")

    lines = (_vault(tmp_path) / "Analyst.md").read_text(encoding="utf-8").splitlines()

    assert lines[0] == "---"
    closing = lines.index("---", 1)
    block = lines[1:closing]
    assert "agent: Analyst" in block
    assert "simulation: sim-002" in block
    # The vault tag is what makes these notes findable as a group in Obsidian.
    assert "  - duckduckgoose" in block


def test_empty_personality_and_beliefs_get_placeholders(tmp_path):
    write_agent_note("Ghost", "", [], "sim-003")

    content = (_vault(tmp_path) / "Ghost.md").read_text(encoding="utf-8")
    assert "(not yet defined)" in content
    assert "(none yet)" in content


def test_append_adds_a_timestamped_line_without_losing_the_note(tmp_path):
    write_agent_note("TradingBot", "Trader", ["Oil will rise"], "sim-001")
    append_agent_memory("TradingBot", "Noticed oil futures spiking")

    content = (_vault(tmp_path) / "TradingBot.md").read_text(encoding="utf-8")
    assert "Noticed oil futures spiking" in content
    # The original note survives the append.
    assert "Trader" in content
    assert "Oil will rise" in content


def test_appends_accumulate_in_order(tmp_path):
    write_agent_note("TradingBot", "Trader", [], "sim-001")
    append_agent_memory("TradingBot", "first observation")
    append_agent_memory("TradingBot", "second observation")

    content = (_vault(tmp_path) / "TradingBot.md").read_text(encoding="utf-8")
    assert content.index("first observation") < content.index("second observation")


def test_append_creates_the_note_when_it_is_missing(tmp_path):
    """A memory entry must never be silently dropped."""
    append_agent_memory("Newcomer", "arrived mid-run")

    note = _vault(tmp_path) / "Newcomer.md"
    assert note.exists()
    assert "arrived mid-run" in note.read_text(encoding="utf-8")


@pytest.mark.parametrize("raw", ['agent/name', 'agent:name', 'a<b>c|d?e*f"g\\h'])
def test_safe_filename_removes_every_illegal_character(raw):
    cleaned = _safe_filename(raw)
    assert not set(cleaned) & set('<>:"/\\|?*')


def test_safe_filename_is_bounded(tmp_path):
    assert len(_safe_filename("x" * 500)) <= 100


def test_illegal_characters_do_not_escape_the_vault(tmp_path):
    """A name with path separators must stay inside the vault directory."""
    write_agent_note("../../escapee", "x", [], "sim")

    written = list(_vault(tmp_path).glob("*.md"))
    assert len(written) == 1
    assert written[0].parent == _vault(tmp_path)
