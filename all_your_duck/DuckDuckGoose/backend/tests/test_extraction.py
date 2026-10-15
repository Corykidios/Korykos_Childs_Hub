import json

import pytest

from app.core.projects import ProjectStore
from app.services.extraction import extract_document
from app.services.ingestion import register_upload


class BatchFakeLLM:
    """Returns payloads in sequence — one per chat_json call (= per batch)."""

    def __init__(self, payloads):
        self.payloads = list(payloads)
        self.calls = []

    def chat_json(self, messages, temperature=0.7):
        self.calls.append(messages)
        return self.payloads.pop(0)


BATCH1 = {
    "entities": [
        {"name": "Vladimir Putin", "type": "Person", "summary": "Russian president"},
        {"name": "OPEC", "type": "Organization", "summary": "Oil cartel"},
    ],
    "edges": [
        {"source": "Vladimir Putin", "target": "OPEC", "relation": "PRESSURES",
         "fact": "Putin pressured OPEC to cut output"}
    ],
}


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


def _project_with_doc(store, body: bytes):
    p = store.create(name="t", question="q")
    p["ontology"] = {
        "entity_types": [{"name": "Person", "description": ""},
                         {"name": "Organization", "description": ""}],
        "edge_types": [{"name": "PRESSURES", "description": ""}],
        "generated_at": "now",
    }
    store.save(p)
    doc = register_upload(store, p["id"], "a.md", body)
    return p, doc


def test_extract_document_writes_mentions_with_provenance(store):
    p, doc = _project_with_doc(store, b"Putin pressured OPEC. " * 100)
    llm = BatchFakeLLM([BATCH1])

    result = extract_document(store, p["id"], doc["doc_id"], llm, chunks_per_batch=99)

    assert len(result["mentions"]) == 2
    assert result["mentions"][0]["chunk_index"] == 0
    assert result["edges"][0]["relation"] == "PRESSURES"

    saved = json.loads(
        (store.project_dir(p["id"]) / "extraction" / f"{doc['doc_id']}.json")
        .read_text(encoding="utf-8")
    )
    assert saved["doc_id"] == doc["doc_id"]
    assert len(saved["mentions"]) == 2


def test_extract_document_batches_chunks(store):
    body = ("word " * 200).encode()  # several chunks at size 100
    p, doc = _project_with_doc(store, body)
    empty = {"entities": [], "edges": []}
    llm = BatchFakeLLM([BATCH1, empty, empty, empty, empty, empty])

    extract_document(
        store, p["id"], doc["doc_id"], llm, chunk_size=100, chunks_per_batch=2
    )
    assert len(llm.calls) >= 2  # more than one batch was sent
    # prompt includes ontology types
    assert "Organization" in json.dumps(llm.calls[0])


def test_extract_tolerates_malformed_batch(store):
    p, doc = _project_with_doc(store, b"text " * 100)

    class FlakyLLM:
        def __init__(self):
            self.n = 0

        def chat_json(self, messages, temperature=0.7):
            self.n += 1
            if self.n == 1:
                raise ValueError("unsalvageable")
            return BATCH1

    result = extract_document(
        store, p["id"], doc["doc_id"], FlakyLLM(), chunk_size=100, chunks_per_batch=1
    )
    # failed batch skipped but recorded; later batches still processed
    assert result["failed_batches"] >= 1
    assert len(result["mentions"]) >= 2


def test_extract_requires_ontology(store):
    p = store.create(name="t", question="q")
    doc = register_upload(store, p["id"], "a.md", b"x")
    with pytest.raises(ValueError):
        extract_document(store, p["id"], doc["doc_id"], BatchFakeLLM([]))
