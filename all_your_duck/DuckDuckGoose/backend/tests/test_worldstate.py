from app.services.worldstate import assemble_world_state, world_state_digest


def _graph():
    return {
        "entities": [
            {"uuid": "p", "canonical_name": "Donald Trump", "type": "Person",
             "summary": "president", "mention_count": 150, "doc_ids": ["d1"]},
            {"uuid": "s", "canonical_name": "the Strait of Hormuz", "type": "Place",
             "summary": "the chokepoint", "mention_count": 800,
             "doc_ids": ["d1", "d2"]},
            {"uuid": "b", "canonical_name": "Brent crude", "type": "Market",
             "summary": "the oil benchmark", "mention_count": 79, "doc_ids": ["d2"]},
            {"uuid": "m", "canonical_name": "the Hormuz memorandum",
             "type": "Memorandum", "summary": "the unsigned deal",
             "mention_count": 20, "doc_ids": ["d3"]},
            {"uuid": "o", "canonical_name": "OPEC", "type": "Organization",
             "summary": "the cartel", "mention_count": 40, "doc_ids": ["d1"]},
        ],
        "edges": [],
    }


def test_assemble_keeps_only_world_state_entities_richest_first():
    ws = assemble_world_state(_graph())
    names = [w["name"] for w in ws]
    # Person and Organization are excluded; world-state entities only, by mentions
    assert names == ["the Strait of Hormuz", "Brent crude", "the Hormuz memorandum"]
    assert "Donald Trump" not in names
    assert "OPEC" not in names


def test_each_carries_its_state_schema():
    by_name = {w["name"]: w for w in assemble_world_state(_graph())}
    assert by_name["the Strait of Hormuz"]["state_schema"] == "open|restricted|closed"
    assert by_name["Brent crude"]["state_schema"] == "numeric"
    assert by_name["the Hormuz memorandum"]["state_schema"].startswith("unsigned")
    assert by_name["the Strait of Hormuz"]["doc_count"] == 2


def test_digest_is_compact_text_and_tolerates_empty():
    digest = world_state_digest(assemble_world_state(_graph()))
    assert "Strait of Hormuz" in digest and "Brent crude" in digest
    assert "Donald Trump" not in digest
    assert world_state_digest([]) == "(no world-state variables identified)"
