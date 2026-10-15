import pytest

from app.core.projects import ProjectStore


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


def test_create_returns_project_with_id_and_dirs(store):
    p = store.create(name="oil shock", question="Will Brent exceed $95?")
    assert p["id"].startswith("proj_") and len(p["id"]) == 17
    assert p["name"] == "oil shock"
    assert p["question"] == "Will Brent exceed $95?"
    assert p["folders"] == [] and p["docs"] == {}
    assert store.project_dir(p["id"]).is_dir()
    assert store.corpus_dir(p["id"]).is_dir()


def test_get_and_list(store):
    a = store.create(name="a", question="qa")
    b = store.create(name="b", question="qb")
    assert store.get(a["id"])["name"] == "a"
    assert {p["id"] for p in store.list()} == {a["id"], b["id"]}


def test_get_missing_returns_none(store):
    assert store.get("proj_nope") is None


def test_save_roundtrip_persists(store, tmp_path):
    p = store.create(name="x", question="q")
    p["folders"].append("C:/somewhere")
    store.save(p)
    reloaded = ProjectStore(tmp_path / "projects")
    assert reloaded.get(p["id"])["folders"] == ["C:/somewhere"]


def test_graph_id_is_stable_and_collection_safe(store):
    p = store.create(name="x", question="q")
    assert store.graph_id(p["id"]) == f"graph-{p['id']}"


def test_traversal_ids_read_as_absent(store, tmp_path):
    # Plant a decoy project.json one level above the projects root —
    # a traversal id must NOT reach it (Windows backslash variant included).
    (tmp_path / "project.json").write_text('{"id": "evil"}', encoding="utf-8")
    for bad in ("..", "..\\..", "../..", "proj_..", "proj_ABCDEF123456", "proj_short"):
        assert store.get(bad) is None
        assert not store.is_valid_id(bad)


def test_path_helpers_reject_invalid_ids(store):
    with pytest.raises(ValueError):
        store.corpus_dir("..\\..")
    with pytest.raises(ValueError):
        store.project_dir("../escape")
    with pytest.raises(ValueError):
        store.graph_id("proj_XYZ")
