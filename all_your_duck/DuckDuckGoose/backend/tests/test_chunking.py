import pytest

import app.core.config as config_mod
from app.core.projects import ProjectStore
from app.services.chunking import chunk_text, index_document
from app.services.ingestion import register_upload
from app.services.memory import chroma_client


@pytest.fixture(autouse=True)
def isolated_chroma(tmp_path, monkeypatch):
    monkeypatch.setattr(config_mod.Config, "CHROMA_DATA_DIR", tmp_path / "chroma")
    monkeypatch.setattr(config_mod.Config, "SETTINGS_FILE", tmp_path / "settings.json")
    chroma_client.reset_singletons()
    yield
    chroma_client.reset_singletons()


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


def test_chunk_text_respects_size_and_overlap():
    words = " ".join(f"w{i}" for i in range(300))
    chunks = chunk_text(words, chunk_size=100, overlap=20)
    assert len(chunks) > 1
    assert all(len(c) <= 100 for c in chunks)
    # consecutive chunks share content (overlap)
    assert chunks[0][-10:] in chunks[0] and chunks[1]


def test_chunk_text_short_input_single_chunk():
    assert chunk_text("tiny", chunk_size=100, overlap=10) == ["tiny"]


def test_chunk_text_never_splits_words():
    text = "alpha bravo charlie delta echo foxtrot " * 20
    for c in chunk_text(text, chunk_size=50, overlap=10):
        assert not c.startswith(" ") and not c.endswith(" ")
        for w in c.split(" "):
            assert w in {"alpha", "bravo", "charlie", "delta", "echo", "foxtrot"}


def test_index_document_writes_provenance_rows(store):
    project = store.create(name="t", question="q")
    body = ("OPEC announced a surprise production cut. " * 40).encode()
    doc = register_upload(store, project["id"], "news.md", body)

    n = index_document(store, project["id"], doc["doc_id"])
    assert n > 1

    collection = chroma_client.get_or_create_collection(store.graph_id(project["id"]))
    rows = collection.get(where={"doc_type": "text_chunk"}, include=["metadatas"])
    assert len(rows["ids"]) == n
    metas = rows["metadatas"]
    assert all(m["doc_id"] == doc["doc_id"] for m in metas)
    assert sorted(m["chunk_index"] for m in metas) == list(range(n))
    assert all(m["doc_title"] == "news" for m in metas)
    assert rows["ids"][0].startswith(doc["doc_id"])


def test_index_document_is_idempotent(store):
    project = store.create(name="t", question="q")
    doc = register_upload(store, project["id"], "a.md", b"hello corpus " * 100)
    first = index_document(store, project["id"], doc["doc_id"])
    second = index_document(store, project["id"], doc["doc_id"])
    assert first == second
    collection = chroma_client.get_or_create_collection(store.graph_id(project["id"]))
    rows = collection.get(where={"doc_type": "text_chunk"})
    assert len(rows["ids"]) == first


def test_index_document_marks_doc_indexed(store):
    project = store.create(name="t", question="q")
    doc = register_upload(store, project["id"], "a.md", b"hello")
    index_document(store, project["id"], doc["doc_id"])
    assert store.get(project["id"])["docs"][doc["doc_id"]]["status"] == "indexed"
