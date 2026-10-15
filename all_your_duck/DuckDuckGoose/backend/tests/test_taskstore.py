import pytest

from app.core.taskstore import TaskStore


@pytest.fixture
def store(tmp_path):
    return TaskStore(tmp_path / "app.db")


def test_create_returns_pending_task(store):
    t = store.create(kind="ingest", payload={"folder": "x"})
    assert t["status"] == "pending"
    assert t["kind"] == "ingest"
    assert t["payload"] == {"folder": "x"}
    assert t["progress"] == 0.0


def test_update_and_get(store):
    t = store.create(kind="ingest")
    store.update(t["id"], status="running", progress=0.5, message="halfway")
    got = store.get(t["id"])
    assert (got["status"], got["progress"], got["message"]) == (
        "running", 0.5, "halfway"
    )


def test_survives_reopen(store, tmp_path):
    t = store.create(kind="build")
    store.update(t["id"], status="done", progress=1.0)
    reopened = TaskStore(tmp_path / "app.db")
    assert reopened.get(t["id"])["status"] == "done"


def test_list_filters_by_kind_and_status(store):
    a = store.create(kind="ingest")
    store.create(kind="build")
    store.update(a["id"], status="running")
    assert [t["id"] for t in store.list(kind="ingest")] == [a["id"]]
    assert [t["id"] for t in store.list(status="running")] == [a["id"]]


def test_get_missing_returns_none(store):
    assert store.get("nope") is None


def test_invalid_status_rejected(store):
    t = store.create(kind="x")
    with pytest.raises(ValueError):
        store.update(t["id"], status="exploded")
