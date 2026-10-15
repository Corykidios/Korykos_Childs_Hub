"""Retrieval tools: search modes, result rendering, and the interview seam."""

import logging
from unittest.mock import MagicMock, patch

import pytest

from app.services.memory.chroma_tools import (
    AgentInterview,
    ChromaToolsService,
    InsightForgeResult,
    InterviewResult,
    PanoramaResult,
    SearchResult,
)

TOOLS_MODULE = "app.services.memory.chroma_tools"


def _query_results(*document_batches):
    """Chroma nests query results one level per query text."""
    return {
        "ids": [[f"id-{i}" for i, _ in enumerate(batch)] for batch in document_batches],
        "documents": [list(batch) for batch in document_batches],
        "metadatas": [[{}] * len(batch) for batch in document_batches],
        "distances": [[0.1] * len(batch) for batch in document_batches],
    }


def _collection(documents=("a fact",), count=10):
    collection = MagicMock()
    collection.query.return_value = _query_results(documents)
    collection.count.return_value = count
    return collection


def _using(collection):
    return patch(f"{TOOLS_MODULE}.get_or_create_collection", return_value=collection)


# -- search modes ----------------------------------------------------------


def test_quick_search_returns_the_matching_documents():
    collection = _collection(["Oil prices rise on OPEC cut news"])
    with _using(collection):
        result = ChromaToolsService().quick_search("sim-001", "oil price", limit=5)

    assert isinstance(result, SearchResult)
    assert result.facts == ["Oil prices rise on OPEC cut news"]
    assert result.query == "oil price"
    assert result.total_count == 1


def test_quick_search_respects_the_requested_limit():
    collection = _collection(count=100)
    with _using(collection):
        ChromaToolsService().quick_search("sim-001", "oil", limit=5)

    assert collection.query.call_args[1]["n_results"] == 5


def test_panorama_sweeps_wider_than_a_quick_search():
    collection = _collection(count=100)
    with _using(collection):
        ChromaToolsService().panorama_search("sim-001", "oil")

    assert collection.query.call_args[1]["n_results"] >= 10


def test_a_query_never_asks_for_zero_results():
    """Chroma rejects n_results=0, which an empty collection would produce."""
    collection = _collection(count=0)
    with _using(collection):
        ChromaToolsService().quick_search("sim-empty", "anything", limit=10)

    assert collection.query.call_args[1]["n_results"] == 1


def test_search_handles_a_response_with_no_documents():
    collection = MagicMock()
    collection.query.return_value = {"ids": [[]], "documents": []}
    collection.count.return_value = 5

    with _using(collection):
        result = ChromaToolsService().quick_search("sim-001", "oil")

    assert result.facts == []
    assert result.to_text() == "(no results)"


def test_insight_forge_merges_angles_without_duplicating():
    collection = MagicMock()
    collection.count.return_value = 50
    collection.query.side_effect = [
        _query_results(["shared fact", "from the question"]),
        _query_results(["shared fact", "from the framing"]),
    ]

    with _using(collection):
        result = ChromaToolsService().insight_forge(
            "sim-001", "will it reopen?", simulation_requirement="strait context"
        )

    assert isinstance(result, InsightForgeResult)
    assert result.semantic_facts == ["shared fact", "from the question", "from the framing"]
    assert result.sub_questions == ["will it reopen?"]


def test_insight_forge_skips_an_empty_angle():
    collection = _collection(["only angle"])
    with _using(collection):
        ChromaToolsService().insight_forge("sim-001", "the question")

    assert collection.query.call_count == 1


def test_graph_statistics_report_the_document_count():
    collection = MagicMock()
    collection.count.return_value = 42
    with _using(collection):
        stats = ChromaToolsService().get_graph_statistics("sim-001")

    assert stats["total_documents"] == 42
    assert stats["graph_id"] == "sim-001"


def test_entity_summary_falls_back_when_filtering_is_unsupported():
    collection = MagicMock()
    collection.count.return_value = 10
    collection.query.side_effect = [Exception("no such field"), _query_results(["a fact"])]

    with _using(collection):
        result = ChromaToolsService().get_entity_summary("sim-001", "TraderJoe")

    assert result.facts == ["a fact"]


def test_entities_by_type_falls_back_to_semantic_search():
    collection = MagicMock()
    collection.count.return_value = 10
    collection.get.side_effect = Exception("no type field")
    collection.query.return_value = _query_results(["an org"])

    with _using(collection):
        result = ChromaToolsService().get_entities_by_type("sim-001", "Organization")

    assert result.facts == ["an org"]


# -- rendering -------------------------------------------------------------


def test_search_result_text_lists_every_fact():
    text = SearchResult(
        facts=["Oil prices rose", "OPEC cut supply"], query="oil", total_count=2
    ).to_text()

    assert "Oil prices rose" in text
    assert "OPEC cut supply" in text
    assert "oil" in text


@pytest.mark.parametrize(
    "result,expected",
    [
        (SearchResult(), "(no results)"),
        (PanoramaResult(), "(no results)"),
        (InsightForgeResult(), "(no insights found)"),
        (InterviewResult(), "(no interviews)"),
    ],
)
def test_empty_results_say_so_rather_than_rendering_blank(result, expected):
    assert result.to_text() == expected


def test_insight_text_omits_sections_that_have_nothing_in_them():
    text = InsightForgeResult(semantic_facts=["a fact"], sub_questions=["a question"]).to_text()

    assert "a fact" in text
    assert "a question" in text
    assert "Connections:" not in text


def test_panorama_separates_superseded_material():
    text = PanoramaResult(all_facts=["current"], expired_facts=["old"]).to_text()

    assert text.index("current") < text.index("old")
    assert "Superseded:" in text


def test_interview_text_attributes_every_quote():
    text = InterviewResult(
        interviews=[AgentInterview("Alice", "worried", "reddit")]
    ).to_text()

    assert "Alice" in text and "worried" in text and "reddit" in text


def test_results_round_trip_to_dict():
    assert SearchResult(facts=["f"], query="q").to_dict()["facts"] == ["f"]
    assert InterviewResult(
        interviews=[AgentInterview("Alice", "worried", "reddit")]
    ).to_dict()["interviews"][0]["agent"] == "Alice"


# -- interview seam --------------------------------------------------------


def test_without_a_fetcher_interviews_are_empty_and_explain_why(caplog):
    """There must be no reaching for a hardcoded worker URL."""
    with caplog.at_level(logging.WARNING, logger=TOOLS_MODULE):
        result = ChromaToolsService().interview_agents("sim-001", "how do you feel", "req")

    assert result.interviews == []
    assert any("running worker" in record.message for record in caplog.records)


def test_injected_fetcher_is_used_and_max_agents_respected():
    calls = []

    def fetcher(simulation_id, interview_requirement, simulation_requirement, max_agents):
        calls.append((simulation_id, max_agents))
        return [
            {"agent_name": "Alice", "quote": "worried", "platform": "reddit"},
            {"agent_name": "Bob", "quote": "calm", "platform": "twitter"},
        ]

    result = ChromaToolsService(interview_fetcher=fetcher).interview_agents(
        "sim-1", "q", "r", max_agents=1
    )

    assert calls == [("sim-1", 1)]
    assert len(result.interviews) == 1
    assert result.interviews[0].agent_name == "Alice"
    assert result.interviews[0].quote == "worried"


def test_fetcher_may_return_interview_objects_directly():
    fetcher = lambda *args: [AgentInterview("Alice", "worried", "reddit")]  # noqa: E731
    result = ChromaToolsService(interview_fetcher=fetcher).interview_agents("s", "q", "r")

    assert result.interviews[0].agent_name == "Alice"


def test_malformed_fetcher_rows_are_dropped():
    fetcher = lambda *args: ["not a dict", None, {"agent_name": "Alice"}]  # noqa: E731
    result = ChromaToolsService(interview_fetcher=fetcher).interview_agents("s", "q", "r")

    assert len(result.interviews) == 1
    assert result.interviews[0].quote == ""


def test_a_failing_fetcher_degrades_to_empty():
    def fetcher(*args):
        raise RuntimeError("worker gone")

    result = ChromaToolsService(interview_fetcher=fetcher).interview_agents("sim-1", "q", "r")
    assert result.interviews == []
