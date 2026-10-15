"""Per-document entity/edge extraction.

Chunks are batched into builder-LLM calls. Every mention keeps its
chunk_index (provenance). A failed batch is skipped and COUNTED, never
silently papered over (visible failures)."""

import json
import logging
from pathlib import Path

from app.core.projects import ProjectStore
from app.services.chunking import DEFAULT_CHUNK_SIZE, DEFAULT_OVERLAP, chunk_text

logger = logging.getLogger(__name__)

DEFAULT_CHUNKS_PER_BATCH = 5

_SYSTEM_TEMPLATE = (
    "You extract entities and relationships from text for a social "
    "simulation. Use ONLY these entity types: {entity_types}. "
    "Use ONLY these relation types: {edge_types}. "
    'Reply with JSON: {{"entities": [{{"name": str, "type": str, '
    '"summary": str}}], "edges": [{{"source": str, "target": str, '
    '"relation": str, "fact": str}}]}}. '
    "Entity names are the most complete form seen in the text. Summaries "
    "are 1-2 sentences grounded in the text. Edge source/target must be "
    "entity names from your entities list. English only."
)


def extract_document(
    store: ProjectStore,
    project_id: str,
    doc_id: str,
    llm,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunks_per_batch: int = DEFAULT_CHUNKS_PER_BATCH,
    persist_status: bool = True,
) -> dict:
    project = store.get(project_id)
    if project is None or doc_id not in project["docs"]:
        raise ValueError(f"unknown doc {doc_id} in project {project_id}")
    ontology = project.get("ontology")
    if not ontology or not ontology.get("entity_types"):
        raise ValueError("project has no ontology — generate or edit one first")

    record = project["docs"][doc_id]
    text = (store.corpus_dir(project_id) / record["stored_path"]).read_text(
        encoding="utf-8", errors="replace"
    )
    chunks = chunk_text(text, chunk_size=chunk_size, overlap=DEFAULT_OVERLAP)

    system = _SYSTEM_TEMPLATE.format(
        entity_types=", ".join(t["name"] for t in ontology["entity_types"]),
        edge_types=", ".join(t["name"] for t in ontology["edge_types"]) or "RELATED",
    )
    valid_types = {t["name"].casefold() for t in ontology["entity_types"]}

    mentions, edges, failed = [], [], 0
    for start in range(0, len(chunks), chunks_per_batch):
        batch = chunks[start:start + chunks_per_batch]
        numbered = "\n\n".join(
            f"[chunk {start + j}]\n{c}" for j, c in enumerate(batch)
        )
        try:
            raw = llm.chat_json(
                [
                    {"role": "system", "content": system},
                    {"role": "user", "content": numbered},
                ],
                temperature=0.2,
            )
        except Exception as e:
            failed += 1
            logger.warning(f"extraction batch at chunk {start} failed: {e}")
            continue

        for ent in raw.get("entities") or []:
            if not isinstance(ent, dict) or not ent.get("name"):
                continue
            etype = str(ent.get("type", "")).strip()
            if etype.casefold() not in valid_types:
                etype = ontology["entity_types"][0]["name"]
            mentions.append({
                "name": str(ent["name"]).strip(),
                "type": etype,
                "summary": str(ent.get("summary", "")).strip(),
                "chunk_index": start,
            })
        for edge in raw.get("edges") or []:
            if not isinstance(edge, dict):
                continue
            if not edge.get("source") or not edge.get("target"):
                continue
            edges.append({
                "source": str(edge["source"]).strip(),
                "target": str(edge["target"]).strip(),
                "relation": str(edge.get("relation", "RELATED")).strip() or "RELATED",
                "fact": str(edge.get("fact", "")).strip(),
                "chunk_index": start,
            })

    result = {
        "doc_id": doc_id,
        "mentions": mentions,
        "edges": edges,
        "failed_batches": failed,
        "total_batches": (len(chunks) + chunks_per_batch - 1) // chunks_per_batch,
    }
    out_dir = Path(store.project_dir(project_id)) / "extraction"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{doc_id}.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    if persist_status:
        record["status"] = "extracted"
        store.save(project)
    return result
