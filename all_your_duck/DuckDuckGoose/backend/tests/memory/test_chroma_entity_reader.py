"""Entity reader: row decoding, type filtering, edge enrichment, legacy fallback.

These tests stub the Chroma collection so they exercise the decoding logic
without needing a live embedding endpoint.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services.memory.chroma_entity_reader import (
    ChromaEntityReader,
    EntityNode,
    FilteredEntities,
)

READER_MODULE = "app.services.memory.chroma_entity_reader.get_or_create_collection"


def _results(ids=(), metadatas=(), documents=()):
    return {
        "ids": list(ids),
        "metadatas": list(metadatas),
        "documents": list(documents),
    }


def _collection(*, get_returns=None, side_effect=None):
    collection = MagicMock()
    if side_effect is not None:
        collection.get.side_effect = side_effect
    else:
        collection.get.return_value = get_returns
    return collection


def _reading(collection):
    return patch(READER_MODULE, return_value=collection)


# -- EntityNode ------------------------------------------------------------


def test_entity_types_exclude_structural_labels():
    node = EntityNode(uuid="1", name="Test", labels=["Entity", "Node", "Organization"])
    assert node.get_entity_types() == ["Organization"]
    assert node.get_entity_type() == "Organization"


def test_entity_with_only_structural_labels_has_no_type():
    node = EntityNode(uuid="1", name="Test", labels=["Entity", "Node"])
    assert node.get_entity_types() == []
    assert node.get_entity_type() is None


def test_entity_node_round_trips_to_dict():
    node = EntityNode(uuid="u1", name="Aramco", labels=["Organization"], summary="oil")
    assert node.to_dict()["uuid"] == "u1"
    assert node.to_dict()["labels"] == ["Organization"]


# -- decoding --------------------------------------------------------------


def test_rows_decode_into_entities():
    collection = _collection(
        get_returns=_results(
            ids=["uuid-1"],
            metadatas=[{
                "doc_type": "entity",
                "name": "Saudi Aramco",
                "labels": "Organization,Entity",
                "type": "Organization",
            }],
            documents=["Major oil producer in Saudi Arabia"],
        )
    )
    with _reading(collection):
        result = ChromaEntityReader().filter_defined_entities("sim-001", ["Organization"])

    assert isinstance(result, FilteredEntities)
    assert result.count == 1
    entity = result.entities[0]
    assert entity.name == "Saudi Aramco"
    assert entity.summary == "Major oil producer in Saudi Arabia"
    assert entity.labels == ["Organization", "Entity"]
    assert result.entity_types_found == ["Organization"]


def test_missing_name_falls_back_to_the_row_id():
    collection = _collection(
        get_returns=_results(ids=["uuid-x"], metadatas=[{"doc_type": "entity"}], documents=[""])
    )
    with _reading(collection):
        result = ChromaEntityReader().filter_defined_entities("sim-001")

    assert result.entities[0].name == "uuid-x"


def test_empty_collection_yields_no_entities():
    with _reading(_collection(get_returns=_results())):
        result = ChromaEntityReader().filter_defined_entities("sim-empty", [])

    assert result.count == 0
    assert result.entity_types_found == []


def test_decoding_survives_results_without_documents():
    """Chroma omits keys that were not included in the query."""
    collection = _collection(get_returns={"ids": ["a"], "metadatas": [{"name": "A"}]})
    with _reading(collection):
        result = ChromaEntityReader().filter_defined_entities("sim-001")

    assert result.entities[0].summary == ""


# -- filtering -------------------------------------------------------------


def test_type_filter_is_combined_with_the_entity_doc_type():
    where = ChromaEntityReader._entity_filter(["Organization", "Person"])
    assert where == {
        "$and": [
            {"doc_type": "entity"},
            {"type": {"$in": ["Organization", "Person"]}},
        ]
    }


@pytest.mark.parametrize("types", [None, []])
def test_without_types_the_filter_is_doc_type_only(types):
    assert ChromaEntityReader._entity_filter(types) == {"doc_type": "entity"}


def test_legacy_collection_without_doc_type_falls_back_instead_of_raising():
    """Collections written before doc_type existed must stay readable."""
    legacy_rows = _results(
        ids=["uuid-1"], metadatas=[{"name": "Aramco", "type": "Organization"}], documents=["oil"]
    )
    # First call (filtered on doc_type) raises; the fallback call succeeds.
    collection = _collection(side_effect=[Exception("no such key: doc_type"), legacy_rows])

    with _reading(collection):
        result = ChromaEntityReader().filter_defined_entities("sim-old", ["Organization"])

    assert result.count == 1
    assert result.entities[0].name == "Aramco"


def test_both_reads_failing_yields_empty_rather_than_raising():
    collection = _collection(side_effect=Exception("collection unreadable"))
    with _reading(collection):
        result = ChromaEntityReader().filter_defined_entities("sim-broken", ["Organization"])

    assert result.count == 0


# -- edges and nodes -------------------------------------------------------


def test_get_all_edges_decodes_endpoints():
    collection = _collection(
        get_returns=_results(
            ids=["edge-1"],
            metadatas=[{
                "doc_type": "edge",
                "name": "WORKS_FOR",
                "source_node_uuid": "uuid-a",
                "target_node_uuid": "uuid-b",
                "source_name": "Dr. Smith",
                "target_name": "MIT",
            }],
            documents=["Dr. Smith works for MIT"],
        )
    )
    with _reading(collection):
        edges = ChromaEntityReader().get_all_edges("sim-001")

    assert len(edges) == 1
    assert edges[0]["name"] == "WORKS_FOR"
    assert edges[0]["source_name"] == "Dr. Smith"
    assert edges[0]["target_name"] == "MIT"
    assert edges[0]["fact"] == "Dr. Smith works for MIT"


def test_get_all_edges_returns_empty_when_the_read_fails():
    with _reading(_collection(side_effect=Exception("boom"))):
        assert ChromaEntityReader().get_all_edges("sim-001") == []


def test_get_all_nodes_skips_non_entity_rows():
    collection = _collection(
        get_returns=_results(
            ids=["e1", "c1", "edge1"],
            metadatas=[
                {"doc_type": "entity", "name": "Aramco"},
                {"doc_type": "text_chunk", "name": "chunk"},
                {"doc_type": "edge", "name": "WORKS_FOR"},
            ],
            documents=["oil", "some text", "a fact"],
        )
    )
    with _reading(collection):
        nodes = ChromaEntityReader().get_all_nodes("sim-001")

    assert [n["name"] for n in nodes] == ["Aramco"]


def test_enrichment_attaches_edges_in_both_directions():
    entity_rows = _results(
        ids=["uuid-a"], metadatas=[{"doc_type": "entity", "name": "Dr. Smith"}], documents=["x"]
    )
    edge_rows = _results(
        ids=["edge-1"],
        metadatas=[{
            "doc_type": "edge",
            "name": "WORKS_FOR",
            "source_node_uuid": "uuid-a",
            "target_node_uuid": "uuid-b",
        }],
        documents=["Dr. Smith works for MIT"],
    )
    node_rows = _results(
        ids=["uuid-b"], metadatas=[{"doc_type": "entity", "name": "MIT"}], documents=["uni"]
    )
    # filter_defined_entities, then get_all_edges, then get_all_nodes.
    collection = _collection(side_effect=[entity_rows, edge_rows, node_rows])

    with _reading(collection):
        result = ChromaEntityReader().filter_defined_entities(
            "sim-001", None, enrich_with_edges=True
        )

    entity = result.entities[0]
    assert len(entity.related_edges) == 1
    assert entity.related_edges[0]["direction"] == "outgoing"
    assert entity.related_edges[0]["target_node_uuid"] == "uuid-b"
    assert entity.related_edges[0]["edge_name"] == "WORKS_FOR"
    assert [n["name"] for n in entity.related_nodes] == ["MIT"]


def test_repeated_edges_do_not_duplicate_a_neighbour():
    owner = EntityNode(uuid="a", name="A")
    neighbour = {"uuid": "b", "name": "B", "labels": [], "summary": ""}

    ChromaEntityReader._add_neighbour(owner, neighbour, "b")
    ChromaEntityReader._add_neighbour(owner, neighbour, "b")

    assert len(owner.related_nodes) == 1


def test_unknown_neighbour_is_ignored():
    owner = EntityNode(uuid="a", name="A")
    ChromaEntityReader._add_neighbour(owner, None, "missing")
    assert owner.related_nodes == []
