"""Faction-label canonicalization.

The persona/archetype LLM emits a free-text `faction` stance label. Across a run
that produced ~300 near-duplicate variants ("Pro-Reopening", "pro-reopening
(conditional)", "pro reopening") that had to be hand-clustered before metrics
aggregated cleanly. This collapses the FORMATTING noise at the source so
population.json stores a consistent label.

Deliberately domain-AGNOSTIC: the tool answers arbitrary operator questions, so
imposing a fixed Hormuz-style enum here would be wrong. It only normalizes
casing / whitespace / parentheticals / separators / trailing clauses — never
the stance itself. Semantic clustering for DISPLAY (the ~7 blocs) stays in the
frontend (storyfeed.js normalizeFaction), which is question-tunable.
"""

import re

_PARENS = re.compile(r"\s*\([^)]*\)")  # "(conditional)" etc.
_SEPARATORS = re.compile(r"[\s_/]+")
_MULTIHYPHEN = re.compile(r"-{2,}")

MAX_LEN = 40


def canonicalize_faction(raw) -> str:
    """Normalize a free-text faction label's FORMAT (not its meaning). Empty ->
    'unaligned'. Capped at MAX_LEN chars."""
    s = str(raw or "").strip().casefold()
    if not s:
        return "unaligned"
    s = _PARENS.sub("", s)        # drop parentheticals
    s = s.split(",")[0]           # keep the primary label before a comma/clause
    s = _SEPARATORS.sub("-", s.strip())  # spaces/underscores/slashes -> hyphen
    s = _MULTIHYPHEN.sub("-", s).strip("-")
    return (s or "unaligned")[:MAX_LEN]
