"""Shared ChromaDB client and the embedding function collections are built with.

Embeddings come from whatever profile is bound to the `embeddings` role, which
must be any OpenAI-compatible `/embeddings` endpoint (Ollama serves one at
`/v1/embeddings`). With nothing bound, Chroma's own default embedder is used,
so the app still runs with no embedding service configured at all.

Embeddings are deliberately their own role rather than being derived from the
chat endpoint. Deriving them means switching chat provider silently repoints
the embedder, which changes the vector space and quietly breaks recall against
everything already stored.

The client and embedding function are process-wide singletons because Chroma's
persistent client owns a file lock on its data directory, so a second client
over the same path in one process is a mistake. `reset_singletons` exists for
tests and for picking up a settings change without a restart.
"""

import logging
import re
from pathlib import Path
from typing import Optional

import chromadb
from chromadb import Documents, EmbeddingFunction, Embeddings
from openai import OpenAI

from app.core.config import Config
from app.core.profiles import EndpointProfile, ProfileStore

logger = logging.getLogger(__name__)

# Chroma's own constraints on a collection name.
_NAME_MAX = 63
_NAME_MIN = 3
_NAME_PAD = "x"
_NAME_FALLBACK = "default"
_DISALLOWED_IN_NAME = re.compile(r"[^a-zA-Z0-9-]")

_client: Optional[chromadb.PersistentClient] = None
_embedding_fn: Optional[EmbeddingFunction] = None
# Distinct from `_embedding_fn is None`, which is also the legitimate "resolved,
# nothing bound" state. Without this the lookup would retry on every call.
_embedding_checked = False


class ProfileEmbeddingFunction(EmbeddingFunction):
    """Embeds through any OpenAI-compatible `/embeddings` endpoint."""

    def __init__(self, profile: EndpointProfile):
        self.model = profile.model
        # Local endpoints usually want no key, but the client requires one.
        self._client = OpenAI(base_url=profile.base_url, api_key=profile.api_key or "none")

    def __call__(self, input: Documents) -> Embeddings:
        response = self._client.embeddings.create(model=self.model, input=list(input))
        return [item.embedding for item in response.data]


def get_client() -> chromadb.PersistentClient:
    """The process-wide persistent client, created on first use."""
    global _client
    if _client is None:
        data_dir = Path(Config.CHROMA_DATA_DIR)
        data_dir.mkdir(parents=True, exist_ok=True)
        _client = chromadb.PersistentClient(path=str(data_dir))
    return _client


def get_embedding_fn() -> Optional[EmbeddingFunction]:
    """The bound embedding function, or None to fall back to Chroma's default.

    Resolved once. A misconfigured profile degrades to the default rather than
    raising, so a bad endpoint cannot make existing projects unopenable.
    """
    global _embedding_fn, _embedding_checked

    if _embedding_checked:
        return _embedding_fn
    _embedding_checked = True

    try:
        profile = ProfileStore(Config.SETTINGS_FILE).resolve_role("embeddings")
    except Exception as exc:
        logger.warning("Embeddings profile unavailable (%s); using Chroma defaults", exc)
        return _embedding_fn

    if profile is None:
        logger.info("No embeddings profile bound; using Chroma default embeddings")
        return _embedding_fn

    _embedding_fn = ProfileEmbeddingFunction(profile)
    logger.info("Using embeddings profile: %s", profile.name)
    return _embedding_fn


def reset_singletons() -> None:
    """Drop the cached client and embedding function."""
    global _client, _embedding_fn, _embedding_checked
    _client = None
    _embedding_fn = None
    _embedding_checked = False


def _sanitize_collection_name(name: str) -> str:
    """Coerce an identifier into a legal Chroma collection name.

    This mapping is load-bearing: it is how a project id is resolved to its
    stored collection, so changing it would orphan existing project data.
    """
    cleaned = _DISALLOWED_IN_NAME.sub("-", name)[:_NAME_MAX].strip("-")
    # Padding runs before the fallback: a name that sanitized away entirely
    # becomes the pad character repeated, not the fallback.
    return cleaned.ljust(_NAME_MIN, _NAME_PAD) or _NAME_FALLBACK


def get_or_create_collection(collection_id: str) -> chromadb.Collection:
    """Open (or create) the collection backing one project."""
    options = {"name": _sanitize_collection_name(collection_id)}

    embedding_fn = get_embedding_fn()
    if embedding_fn is not None:
        options["embedding_function"] = embedding_fn

    return get_client().get_or_create_collection(**options)
