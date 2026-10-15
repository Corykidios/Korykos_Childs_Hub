import pytest

from app.core.profiles import (
    ROLES,
    EndpointProfile,
    ProfileStore,
    UnknownProfileError,
    get_setting,
    put_setting,
)


@pytest.fixture
def store(tmp_path):
    return ProfileStore(tmp_path / "settings.json")


def _ollama() -> EndpointProfile:
    return EndpointProfile(
        name="ollama-local",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
        model="gemma3:4b",
        max_concurrency=2,
    )


def test_roundtrip_persists_to_disk(store, tmp_path):
    store.upsert(_ollama())
    reloaded = ProfileStore(tmp_path / "settings.json")
    assert reloaded.get("ollama-local").model == "gemma3:4b"


def test_roles_constant():
    assert ROLES == (
        "protagonist_brain",
        "crowd_llm_brain",
        "builder",
        "report_writer",
        "embeddings",
    )


def test_bind_and_resolve_role(store):
    store.upsert(_ollama())
    store.bind_role("builder", "ollama-local")
    assert store.resolve_role("builder").name == "ollama-local"


def test_bind_unknown_profile_raises(store):
    with pytest.raises(UnknownProfileError):
        store.bind_role("builder", "nope")


def test_unbound_role_resolves_none(store):
    assert store.resolve_role("embeddings") is None


def test_invalid_role_raises(store):
    store.upsert(_ollama())
    with pytest.raises(ValueError):
        store.bind_role("god_mode", "ollama-local")


def test_delete_profile_clears_bindings(store):
    store.upsert(_ollama())
    store.bind_role("builder", "ollama-local")
    store.delete("ollama-local")
    assert store.resolve_role("builder") is None
    with pytest.raises(UnknownProfileError):
        store.get("ollama-local")


def test_max_concurrency_must_be_positive():
    with pytest.raises(ValueError):
        EndpointProfile(
            name="x", base_url="http://h/v1", api_key="k", model="m",
            max_concurrency=0,
        )


# --- top-level settings helpers (run queue concurrency etc.) ---------------


def test_get_setting_missing_file_returns_default(tmp_path):
    assert get_setting(tmp_path / "settings.json", "max_concurrent_runs", 1) == 1


def test_put_then_get_setting_roundtrip(tmp_path):
    path = tmp_path / "settings.json"
    put_setting(path, "max_concurrent_runs", 3)
    assert get_setting(path, "max_concurrent_runs", 1) == 3


def test_profile_store_save_preserves_top_level_settings(tmp_path):
    path = tmp_path / "settings.json"
    put_setting(path, "max_concurrent_runs", 2)
    store = ProfileStore(path)
    store.upsert(_ollama())
    store.bind_role("builder", "ollama-local")
    assert get_setting(path, "max_concurrent_runs", 1) == 2


def test_put_setting_preserves_profiles(tmp_path):
    path = tmp_path / "settings.json"
    store = ProfileStore(path)
    store.upsert(_ollama())
    put_setting(path, "max_concurrent_runs", 2)
    assert ProfileStore(path).get("ollama-local").model == "gemma3:4b"
