"""Word-boundary chunking + per-project Chroma indexing with provenance.

Every chunk row carries doc_id + chunk_index — the corpus-blob
pattern (no provenance) is the #1 thing this module exists to kill.
"""

from app.core.projects import ProjectStore
from app.services.memory.chroma_client import get_or_create_collection

DEFAULT_CHUNK_SIZE = 500
DEFAULT_OVERLAP = 50


def chunk_text(
    text: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> list[str]:
    """Split on word boundaries into <=chunk_size chars with ~overlap carry."""
    text = text.strip()
    if len(text) <= chunk_size:
        return [text] if text else []
    words = text.split()
    chunks: list[str] = []
    current: list[str] = []
    length = 0
    for word in words:
        added = len(word) + (1 if current else 0)
        if length + added > chunk_size and current:
            chunks.append(" ".join(current))
            # carry whole trailing words up to `overlap` chars
            carry: list[str] = []
            carry_len = 0
            for w in reversed(current):
                if carry_len + len(w) + (1 if carry else 0) > overlap:
                    break
                carry.insert(0, w)
                carry_len += len(w) + (1 if len(carry) > 1 else 0)
            current = carry
            length = carry_len
            added = len(word) + (1 if current else 0)
        current.append(word)
        length += added
    if current:
        chunks.append(" ".join(current))
    return chunks


def index_document(
    store: ProjectStore,
    project_id: str,
    doc_id: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    overlap: int = DEFAULT_OVERLAP,
) -> int:
    """Chunk one stored document into the project collection. Idempotent
    (fixed ids per doc_id+index; re-indexing upserts the same rows).
    Returns the number of chunks."""
    project = store.get(project_id)
    if project is None or doc_id not in project["docs"]:
        raise ValueError(f"unknown doc {doc_id} in project {project_id}")
    record = project["docs"][doc_id]
    text = (store.corpus_dir(project_id) / record["stored_path"]).read_text(
        encoding="utf-8", errors="replace"
    )
    chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)

    collection = get_or_create_collection(store.graph_id(project_id))
    if chunks:
        collection.upsert(
            ids=[f"{doc_id}-chunk-{i:04d}" for i in range(len(chunks))],
            documents=chunks,
            metadatas=[
                {
                    "doc_type": "text_chunk",
                    "doc_id": doc_id,
                    "chunk_index": i,
                    "doc_title": record["title"],
                    "source_path": record["source_path"],
                }
                for i in range(len(chunks))
            ],
        )
    record["status"] = "indexed"
    store.save(project)
    return len(chunks)
