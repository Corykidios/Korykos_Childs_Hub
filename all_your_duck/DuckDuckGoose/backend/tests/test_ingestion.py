import pytest

from app.core.projects import ProjectStore
from app.services.ingestion import (
    extract_wikilinks,
    register_folder,
    register_upload,
    rescan,
)


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


@pytest.fixture
def project(store):
    return store.create(name="t", question="q")


def test_extract_wikilinks():
    text = "See [[Putin]] and [[OPEC|the cartel]]. No [[ here."
    assert extract_wikilinks(text) == ["Putin", "OPEC"]


def test_register_upload_stores_copy_and_record(store, project):
    doc = register_upload(store, project["id"], "report.md", b"# Oil\nBody [[OPEC]]")
    p = store.get(project["id"])
    assert doc["doc_id"].startswith("doc_") and len(doc["doc_id"]) == 20
    assert p["docs"][doc["doc_id"]]["title"] == "Oil"
    assert p["docs"][doc["doc_id"]]["source"] == "upload"
    assert p["docs"][doc["doc_id"]]["link_hints"] == ["OPEC"]
    stored = p["docs"][doc["doc_id"]]["stored_path"]
    assert (store.corpus_dir(project["id"]) / stored).read_text(encoding="utf-8").startswith("# Oil")


def test_upload_same_content_is_idempotent(store, project):
    a = register_upload(store, project["id"], "a.md", b"same")
    b = register_upload(store, project["id"], "b.md", b"same")
    assert a["doc_id"] == b["doc_id"]
    assert len(store.get(project["id"])["docs"]) == 1


def test_register_folder_and_rescan(store, project, tmp_path):
    vault = tmp_path / "vault"
    (vault / "sub").mkdir(parents=True)
    (vault / "one.md").write_text("# One\n[[Alpha]]", encoding="utf-8")
    (vault / "sub" / "two.txt").write_text("plain text", encoding="utf-8")
    (vault / "skip.pdf").write_bytes(b"%PDF")

    register_folder(store, project["id"], str(vault))
    added = rescan(store, project["id"])
    assert len(added) == 2

    p = store.get(project["id"])
    titles = {d["title"] for d in p["docs"].values()}
    assert titles == {"One", "two"}
    assert all(d["source"] == "folder" for d in p["docs"].values())


def test_rescan_is_idempotent_and_detects_changes(store, project, tmp_path):
    vault = tmp_path / "vault"
    vault.mkdir()
    f = vault / "doc.md"
    f.write_text("v1", encoding="utf-8")
    register_folder(store, project["id"], str(vault))

    first = rescan(store, project["id"])
    second = rescan(store, project["id"])
    assert len(first) == 1 and len(second) == 0

    f.write_text("v2 changed", encoding="utf-8")
    third = rescan(store, project["id"])
    assert len(third) == 1
    assert len(store.get(project["id"])["docs"]) == 2  # v1 kept, v2 added


def test_register_missing_folder_raises(store, project):
    with pytest.raises(ValueError):
        register_folder(store, project["id"], "Z:/definitely/not/here")
