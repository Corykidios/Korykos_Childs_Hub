"""Faction-label canonicalization.

A domain-agnostic normalizer that merges the FORMATTING variants which bloat
the free-text faction vocabulary (~300 raw labels per run) at the SOURCE, so the
metrics don't need after-the-fact hand-clustering. It deliberately does NOT
impose a domain enum (the tool answers arbitrary questions) — it collapses
casing/whitespace/parenthetical/separator noise only.
"""

from app.services.factions import canonicalize_faction


def test_merges_formatting_variants_to_one_label():
    assert canonicalize_faction("Pro-Reopening") == "pro-reopening"
    assert canonicalize_faction("pro-reopening (conditional)") == "pro-reopening"
    assert canonicalize_faction("pro reopening") == "pro-reopening"
    assert canonicalize_faction("  pragmatic_reopening  ") == "pragmatic-reopening"
    assert canonicalize_faction("hardline-closure, economic angle") == "hardline-closure"


def test_keeps_distinct_stances_distinct():
    # it normalizes FORMAT, not semantics — opposite sides stay separate
    assert canonicalize_faction("pro-reopening") != canonicalize_faction("anti-reopening")


def test_empty_and_length():
    assert canonicalize_faction("") == "unaligned"
    assert canonicalize_faction(None) == "unaligned"
    assert canonicalize_faction("   ") == "unaligned"
    assert len(canonicalize_faction("x" * 100)) <= 40
