import json

import pytest

import app.core.config as config_mod
from app.core.projects import ProjectStore
from app.services.graph_build import build_graph
from app.services.ingestion import register_upload
from app.services.memory import chroma_client
from app.services.memory.chroma_entity_reader import ChromaEntityReader
from tests.test_resolution import fake_embed


@pytest.fixture(autouse=True)
def isolated_chroma(tmp_path, monkeypatch):
    monkeypatch.setattr(config_mod.Config, "CHROMA_DATA_DIR", tmp_path / "chroma")
    monkeypatch.setattr(config_mod.Config, "SETTINGS_FILE", tmp_path / "settings.json")
    chroma_client.reset_singletons()
    yield
    chroma_client.reset_singletons()


def test_mirror_to_chroma_chunks_under_batch_ceiling():
    # regression: a 9527-edge graph exceeded Chroma's 5461 max batch and crashed
    # the unbatched upsert. The mirror must split every upsert under the ceiling.
    from app.services.graph_build import _CHROMA_MAX_BATCH, _mirror_to_chroma

    batch_sizes = []

    class FakeCollection:
        def upsert(self, ids, documents, metadatas):
            assert len(ids) == len(documents) == len(metadatas)
            batch_sizes.append(len(ids))

    entities = [
        {"uuid": f"e{i}", "summary": "", "canonical_name": f"E{i}",
         "type": "Person", "doc_ids": ["d1"], "mention_count": 1}
        for i in range(12000)
    ]
    edges = [
        {"uuid": f"r{i}", "fact": "", "relation": "KNOWS",
         "source_uuid": "e0", "target_uuid": "e1",
         "source_name": "E0", "target_name": "E1"}
        for i in range(9527)
    ]
    _mirror_to_chroma(FakeCollection(), entities, edges)

    assert sum(batch_sizes) == 12000 + 9527            # nothing dropped
    assert all(b <= _CHROMA_MAX_BATCH for b in batch_sizes)  # none over ceiling


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


def _seed_extractions(store, p, extractions):
    out = store.project_dir(p["id"]) / "extraction"
    out.mkdir(parents=True, exist_ok=True)
    for doc_id, data in extractions.items():
        (out / f"{doc_id}.json").write_text(
            json.dumps({"doc_id": doc_id, "failed_batches": 0,
                        "total_batches": 1, **data}),
            encoding="utf-8",
        )


def test_build_graph_dedups_across_documents(store):
    p = store.create(name="t", question="q")
    register_upload(store, p["id"], "a.md", b"doc a")
    _seed_extractions(store, p, {
        "doc_a": {
            "mentions": [{"name": "Vladimir Putin", "type": "Person",
                          "summary": "Russian president", "chunk_index": 0}],
            "edges": [{"source": "Vladimir Putin", "target": "OPEC",
                       "relation": "PRESSURES", "fact": "pressure", "chunk_index": 0}],
        },
        "doc_b": {
            "mentions": [
                {"name": "President Vladimir Putin", "type": "Person",
                 "summary": "Russia's leader", "chunk_index": 0},
                {"name": "OPEC", "type": "Organization",
                 "summary": "Oil cartel", "chunk_index": 0},
            ],
            "edges": [],
        },
    })

    result = build_graph(store, p["id"], fake_embed, llm=None)

    assert result["entity_count"] == 2  # Putin merged across docs; OPEC
    putin = next(e for e in result["entities"] if "Putin" in e["canonical_name"])
    assert set(putin["doc_ids"]) == {"doc_a", "doc_b"}

    # clean extractions -> zero aggregated failures
    assert result["extraction_failures"] == {"failed": 0, "total": 2}

    # graph.json persisted
    saved = json.loads(
        (store.project_dir(p["id"]) / "graph.json").read_text(encoding="utf-8")
    )
    assert saved["entity_count"] == 2

    # Chroma rows readable through the ported reader
    reader = ChromaEntityReader()
    nodes = reader.get_all_nodes(store.graph_id(p["id"]))
    assert len(nodes) == 2
    edges = reader.get_all_edges(store.graph_id(p["id"]))
    assert len(edges) == 1
    assert edges[0]["source_name"] and edges[0]["target_name"] == "OPEC"


def test_build_graph_drops_unresolvable_edge_endpoints(store):
    p = store.create(name="t", question="q")
    _seed_extractions(store, p, {
        "doc_a": {
            "mentions": [{"name": "OPEC", "type": "Organization",
                          "summary": "", "chunk_index": 0}],
            "edges": [{"source": "OPEC", "target": "Ghost Entity",
                       "relation": "KNOWS", "fact": "", "chunk_index": 0}],
        },
    })
    result = build_graph(store, p["id"], fake_embed, llm=None)
    assert result["edge_count"] == 0
    assert result["dropped_edges"] == 1


def test_build_graph_uses_wikilink_alias_hints(store):
    p = store.create(name="t", question="q")
    # doc with title "OPEC" and a hint "the cartel" -> alias maps to title
    doc = register_upload(store, p["id"], "opec.md", b"# OPEC\n[[the cartel]] cut")
    _seed_extractions(store, p, {
        doc["doc_id"]: {
            "mentions": [
                {"name": "OPEC", "type": "Organization", "summary": "cartel",
                 "chunk_index": 0},
                {"name": "the cartel", "type": "Organization", "summary": "",
                 "chunk_index": 0},
            ],
            "edges": [],
        },
    })
    result = build_graph(store, p["id"], fake_embed, llm=None)
    assert result["entity_count"] == 1


def test_build_graph_aggregates_extraction_failures(store):
    p = store.create(name="t", question="q")
    _seed_extractions(store, p, {
        "doc_a": {"mentions": [], "edges": [],
                  "failed_batches": 1, "total_batches": 2},
        "doc_b": {
            "mentions": [{"name": "OPEC", "type": "Organization",
                          "summary": "", "chunk_index": 0}],
            "edges": [],
        },
    })
    result = build_graph(store, p["id"], fake_embed, llm=None)
    assert result["extraction_failures"] == {"failed": 1, "total": 3}
    saved = json.loads(
        (store.project_dir(p["id"]) / "graph.json").read_text(encoding="utf-8")
    )
    assert saved["extraction_failures"] == {"failed": 1, "total": 3}


def test_build_graph_empty_project(store):
    p = store.create(name="t", question="q")
    result = build_graph(store, p["id"], fake_embed, llm=None)
    assert result["entity_count"] == 0 and result["edge_count"] == 0
    assert result["extraction_failures"] == {"failed": 0, "total": 0}
