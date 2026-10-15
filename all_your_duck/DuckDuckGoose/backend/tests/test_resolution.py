import hashlib

import pytest

from app.services.resolution import normalize_name, resolve_entities


def fake_embed(texts: list[str]) -> list[list[float]]:
    """Deterministic 8-dim embeddings: similar first-token -> similar vector.
    Engineered so name-stem decides similarity for test purposes."""
    out = []
    for t in texts:
        stem = t.split(":")[0].casefold().replace("vladimir ", "").strip()[:6]
        h = hashlib.sha256(stem.encode()).digest()
        out.append([b / 255 for b in h[:8]])
    return out


class YesNoLLM:
    """Adjudicator fake: answers from a lookup of frozenset name pairs."""

    def __init__(self, verdicts):
        self.verdicts = verdicts
        self.calls = []

    def chat_json(self, messages, temperature=0.7):
        import json as _json
        self.calls.append(messages)
        # The service sends pairs as JSON with "a" and "b" names; reply per pair.
        payload = _json.loads(messages[-1]["content"].split("PAIRS:\n", 1)[1])
        return {
            "verdicts": [
                {"index": p["index"],
                 "same": self.verdicts.get(frozenset((p["a"], p["b"])), False)}
                for p in payload
            ]
        }


def _mention(name, type_="Person", summary="", doc="doc_a", chunk=0):
    return {"name": name, "type": type_, "summary": summary,
            "doc_id": doc, "chunk_index": chunk}


def test_normalize_name():
    assert normalize_name("President Vladimir Putin") == "vladimir putin"
    assert normalize_name("  The   Kremlin ") == "kremlin"
    assert normalize_name("Dr. Sarah Monroe") == "sarah monroe"
    assert normalize_name("OPEC") == "opec"


def test_exact_normalized_names_always_merge():
    mentions = [
        _mention("Vladimir Putin", doc="doc_a"),
        _mention("President Vladimir Putin", doc="doc_b", summary="Russia's leader"),
    ]
    entities = resolve_entities("proj_x", mentions, fake_embed, llm=None)
    assert len(entities) == 1
    ent = entities[0]
    assert ent["canonical_name"] == "President Vladimir Putin"  # longest form
    assert set(ent["doc_ids"]) == {"doc_a", "doc_b"}
    assert ent["mention_count"] == 2


def test_high_similarity_auto_merges_without_llm():
    # fake_embed strips "vladimir " so "Vladimir Putin" and "Putin" embed identically
    mentions = [
        _mention("Vladimir Putin", summary="Russian president", doc="doc_a"),
        _mention("Putin", summary="Russia's leader", doc="doc_b"),
    ]
    entities = resolve_entities("proj_x", mentions, fake_embed, llm=None)
    assert len(entities) == 1
    assert "Putin" in entities[0]["aliases"] or entities[0]["canonical_name"] == "Vladimir Putin"


def test_forbidden_merge_distinct_people_stay_separate():
    mentions = [
        _mention("Sarah Monroe", summary="US DOE advisor", doc="doc_a"),
        _mention("Sarah Connor", summary="fictional character", doc="doc_b"),
    ]
    entities = resolve_entities("proj_x", mentions, fake_embed, llm=None)
    assert len(entities) == 2


def test_wikilink_aliases_merge_unconditionally():
    mentions = [
        _mention("OPEC", type_="Organization", doc="doc_a"),
        _mention("the cartel", type_="Organization", doc="doc_b"),
    ]
    entities = resolve_entities(
        "proj_x", mentions, fake_embed, llm=None,
        alias_hints={"the cartel": "OPEC"},
    )
    assert len(entities) == 1
    assert entities[0]["canonical_name"] == "the cartel" or entities[0]["canonical_name"] == "OPEC"


def test_borderline_pairs_go_to_llm_adjudication(monkeypatch):
    import app.services.resolution as res
    # Force the borderline band wide open so the fake embeddings land in it.
    monkeypatch.setattr(res, "AUTO_MERGE_SIM", 1.01)   # nothing auto-merges
    monkeypatch.setattr(res, "ADJUDICATE_SIM", -1.0)   # everything adjudicates
    mentions = [
        _mention("Vladimir Putin", summary="Russian president", doc="doc_a"),
        _mention("The Kremlin", summary="Russian government", doc="doc_b"),
    ]
    llm = YesNoLLM({frozenset(("Vladimir Putin", "The Kremlin")): True})
    merged = res.resolve_entities("proj_x", mentions, fake_embed, llm=llm)
    assert len(merged) == 1
    assert len(llm.calls) == 1

    llm_no = YesNoLLM({frozenset(("Vladimir Putin", "The Kremlin")): False})
    separate = res.resolve_entities("proj_x", mentions, fake_embed, llm=llm_no)
    assert len(separate) == 2


def test_uuid_is_deterministic_per_project():
    mentions = [_mention("OPEC", type_="Organization")]
    a = resolve_entities("proj_x", mentions, fake_embed, llm=None)[0]["uuid"]
    b = resolve_entities("proj_x", mentions, fake_embed, llm=None)[0]["uuid"]
    c = resolve_entities("proj_y", mentions, fake_embed, llm=None)[0]["uuid"]
    assert a == b and a != c and a.startswith("ent_")


def test_type_majority_vote_and_merged_summary():
    mentions = [
        _mention("OPEC", type_="Organization", summary="Oil cartel", doc="d1"),
        _mention("OPEC", type_="Person", summary="Oil exporting group", doc="d2"),
        _mention("OPEC", type_="Organization", summary="Oil cartel", doc="d3"),
    ]
    ent = resolve_entities("proj_x", mentions, fake_embed, llm=None)[0]
    assert ent["type"] == "Organization"
    assert "Oil cartel" in ent["summary"] and "Oil exporting group" in ent["summary"]
