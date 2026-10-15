"""Chroma client: singleton behaviour, embedding-profile resolution, naming.

The collection-name mapping is pinned here on purpose. It is how a project id
resolves to its stored collection, so a change would orphan existing data
rather than fail loudly.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.services.memory import chroma_client
from app.services.memory.chroma_client import (
    _sanitize_collection_name,
    get_client,
    get_embedding_fn,
    get_or_create_collection,
    reset_singletons,
)

CLIENT_MODULE = "app.services.memory.chroma_client"


@pytest.fixture(autouse=True)
def _clean_singletons():
    """Every test starts and ends with no cached client or embedder."""
    reset_singletons()
    yield
    reset_singletons()


# -- client ----------------------------------------------------------------


def test_client_is_persistent():
    with patch("chromadb.PersistentClient", return_value=MagicMock()) as constructor:
        get_client()

    assert constructor.called


def test_client_is_created_once_and_reused():
    """A second persistent client over the same path would contend on its lock."""
    with patch("chromadb.PersistentClient", return_value=MagicMock()) as constructor:
        first = get_client()
        second = get_client()

    assert first is second
    assert constructor.call_count == 1


def test_reset_forces_a_fresh_client():
    with patch("chromadb.PersistentClient", return_value=MagicMock()) as constructor:
        get_client()
        reset_singletons()
        get_client()

    assert constructor.call_count == 2


# -- embedding profile -----------------------------------------------------


def test_no_bound_profile_falls_back_to_the_chroma_default():
    store = MagicMock()
    store.resolve_role.return_value = None
    with patch(f"{CLIENT_MODULE}.ProfileStore", return_value=store):
        assert get_embedding_fn() is None


def test_a_bound_profile_produces_an_embedding_function():
    profile = MagicMock(model="nomic-embed-text", base_url="http://localhost:11434/v1")
    profile.name = "local"
    store = MagicMock()
    store.resolve_role.return_value = profile

    with patch(f"{CLIENT_MODULE}.ProfileStore", return_value=store), patch(
        f"{CLIENT_MODULE}.OpenAI"
    ):
        assert get_embedding_fn() is not None


def test_a_broken_profile_degrades_instead_of_raising():
    """A bad endpoint must not make existing projects unopenable."""
    with patch(f"{CLIENT_MODULE}.ProfileStore", side_effect=Exception("settings unreadable")):
        assert get_embedding_fn() is None


def test_the_profile_is_resolved_only_once():
    store = MagicMock()
    store.resolve_role.return_value = None
    with patch(f"{CLIENT_MODULE}.ProfileStore", return_value=store) as constructor:
        get_embedding_fn()
        get_embedding_fn()

    assert constructor.call_count == 1


def test_embedding_function_embeds_a_batch():
    profile = MagicMock(model="nomic-embed-text", base_url="http://localhost:11434/v1")
    response = MagicMock(data=[MagicMock(embedding=[0.1, 0.2]), MagicMock(embedding=[0.3, 0.4])])

    with patch(f"{CLIENT_MODULE}.OpenAI") as openai:
        openai.return_value.embeddings.create.return_value = response
        vectors = chroma_client.ProfileEmbeddingFunction(profile)(["one", "two"])

    # Chroma's base class normalizes returned embeddings into numpy arrays.
    assert [list(vector) for vector in vectors] == [[0.1, 0.2], [0.3, 0.4]]
    assert openai.return_value.embeddings.create.call_args[1]["input"] == ["one", "two"]


def test_a_profile_without_a_key_still_builds_a_client():
    """Local endpoints take no key, but the OpenAI client demands one."""
    profile = MagicMock(model="m", base_url="http://localhost:11434/v1", api_key="")

    with patch(f"{CLIENT_MODULE}.OpenAI") as openai:
        chroma_client.ProfileEmbeddingFunction(profile)

    assert openai.call_args[1]["api_key"] == "none"


# -- collection naming -----------------------------------------------------


@pytest.mark.parametrize(
    "raw,expected",
    [
        # Pinned: the real project-id shape must keep resolving to this name.
        ("proj_b100b0a7f5a7", "proj-b100b0a7f5a7"),
        ("sim-123", "sim-123"),
        ("graph-001", "graph-001"),
        ("sim_123", "sim-123"),
        ("ab", "abx"),          # padded up to the 3-char minimum
        ("-lead", "lead"),      # edge hyphens stripped
        ("trail-", "trail"),
        ("---", "xxx"),         # sanitized away entirely, then padded
        ("", "xxx"),
    ],
)
def test_collection_name_mapping_is_stable(raw, expected):
    assert _sanitize_collection_name(raw) == expected


def test_collection_name_is_truncated_to_the_chroma_limit():
    assert len(_sanitize_collection_name("a" * 100)) == 63


@pytest.mark.parametrize("raw", ["sim_123!@#", "p!@#$%^&*()", "已经测试", "a b/c:d"])
def test_collection_name_only_ever_contains_legal_characters(raw):
    name = _sanitize_collection_name(raw)
    assert all(char.isalnum() or char == "-" for char in name)
    assert 3 <= len(name) <= 63
    assert not name.startswith("-") and not name.endswith("-")


# -- collection construction -----------------------------------------------


def test_collection_is_opened_under_the_sanitized_name():
    client = MagicMock()
    with patch(f"{CLIENT_MODULE}.get_client", return_value=client), patch(
        f"{CLIENT_MODULE}.get_embedding_fn", return_value=None
    ):
        get_or_create_collection("proj_b100b0a7f5a7")

    assert client.get_or_create_collection.call_args[1]["name"] == "proj-b100b0a7f5a7"


def test_no_embedding_function_is_passed_when_none_is_bound():
    """Omitting the argument is what makes Chroma use its own default."""
    client = MagicMock()
    with patch(f"{CLIENT_MODULE}.get_client", return_value=client), patch(
        f"{CLIENT_MODULE}.get_embedding_fn", return_value=None
    ):
        get_or_create_collection("sim-1")

    assert "embedding_function" not in client.get_or_create_collection.call_args[1]


def test_a_bound_embedding_function_is_passed_through():
    client = MagicMock()
    embedder = MagicMock()
    with patch(f"{CLIENT_MODULE}.get_client", return_value=client), patch(
        f"{CLIENT_MODULE}.get_embedding_fn", return_value=embedder
    ):
        get_or_create_collection("sim-1")

    assert client.get_or_create_collection.call_args[1]["embedding_function"] is embedder
