"""Graph assembly: extractions -> resolved entities -> graph.json + Chroma.

Writes the EXACT row schema the ported ChromaEntityReader consumes
(doc_type entity/edge, comma-joined labels, source/target uuid+name).
Alias hints come from Obsidian wikilinks: [[hint]] inside a doc maps the
hint to that doc's title (vault convention: a note IS its entity)."""

import hashlib
import json
import logging
from datetime import datetime, timezone

from app.core.projects import ProjectStore
from app.services.memory.chroma_client import get_or_create_collection
from app.services.resolution import normalize_name, resolve_entities

logger = logging.getLogger(__name__)

# Chroma rejects any single upsert larger than its max batch size (5461 in the
# current build). A large corpus + rich ontology yields more entities/edges than
# that, so the mirror is chunked. (A 9527-edge graph crashed the unbatched
# upsert; on smaller corpora every batch had slipped under the ceiling.)
_CHROMA_MAX_BATCH = 5000


def _upsert_batched(collection, ids, documents, metadatas) -> None:
    for i in range(0, len(ids), _CHROMA_MAX_BATCH):
        sl = slice(i, i + _CHROMA_MAX_BATCH)
        collection.upsert(
            ids=ids[sl], documents=documents[sl], metadatas=metadatas[sl]
        )


def _mirror_to_chroma(collection, entities: list, edges: list) -> None:
    """Mirror resolved entities + edges into the Chroma reader collection,
    chunked under Chroma's per-upsert batch ceiling."""
    if entities:
        _upsert_batched(
            collection,
            [e["uuid"] for e in entities],
            [e["summary"] or e["canonical_name"] for e in entities],
            [
                {
                    "doc_type": "entity",
                    "name": e["canonical_name"],
                    "type": e["type"],
                    "labels": f"Entity,{e['type']}",
                    "doc_ids": ",".join(e["doc_ids"]),
                    "mention_count": e["mention_count"],
                }
                for e in entities
            ],
        )
    if edges:
        _upsert_batched(
            collection,
            [e["uuid"] for e in edges],
            [e["fact"] or e["relation"] for e in edges],
            [
                {
                    "doc_type": "edge",
                    "name": e["relation"],
                    "source_node_uuid": e["source_uuid"],
                    "target_node_uuid": e["target_uuid"],
                    "source_name": e["source_name"],
                    "target_name": e["target_name"],
                }
                for e in edges
            ],
        )


def _load_mentions(store: ProjectStore, project: dict):
    """Mentions + edges from every per-doc extraction file, plus the
    aggregated batch-failure tally (per-doc failed/total batches summed, so
    extraction failures stay visible at the graph level)."""
    mentions, edges = [], []
    failures = {"failed": 0, "total": 0}
    ext_dir = store.project_dir(project["id"]) / "extraction"
    if not ext_dir.is_dir():
        return mentions, edges, failures
    for f in sorted(ext_dir.glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for m in data.get("mentions", []):
            mentions.append({**m, "doc_id": data["doc_id"]})
        for e in data.get("edges", []):
            edges.append({**e, "doc_id": data["doc_id"]})
        failures["failed"] += int(data.get("failed_batches", 0) or 0)
        failures["total"] += int(data.get("total_batches", 0) or 0)
    return mentions, edges, failures


def _alias_hints(project: dict) -> dict[str, str]:
    hints = {}
    for record in project["docs"].values():
        for hint in record.get("link_hints", []):
            hints[hint] = record["title"]
    return hints


def build_graph(store: ProjectStore, project_id: str, embed_fn, llm=None) -> dict:
    project = store.get(project_id)
    if project is None:
        raise ValueError(f"unknown project: {project_id}")

    mentions, raw_edges, extraction_failures = _load_mentions(store, project)
    entities = resolve_entities(
        project_id, mentions, embed_fn, llm=llm,
        alias_hints=_alias_hints(project),
    )

    # ---- resolve edge endpoints to canonical entities ----------------------
    by_norm: dict[str, dict] = {}
    for e in entities:
        for name in [e["canonical_name"], *e["aliases"]]:
            by_norm[normalize_name(name)] = e
    resolved_edges, dropped = [], 0
    for edge in raw_edges:
        src = by_norm.get(normalize_name(edge["source"]))
        tgt = by_norm.get(normalize_name(edge["target"]))
        if src is None or tgt is None or src["uuid"] == tgt["uuid"]:
            dropped += 1
            continue
        uid = "rel_" + hashlib.sha256(
            f"{src['uuid']}|{edge['relation']}|{tgt['uuid']}|{edge['fact']}".encode()
        ).hexdigest()[:16]
        resolved_edges.append({
            "uuid": uid,
            "relation": edge["relation"],
            "fact": edge["fact"],
            "source_uuid": src["uuid"], "source_name": src["canonical_name"],
            "target_uuid": tgt["uuid"], "target_name": tgt["canonical_name"],
            "doc_id": edge["doc_id"],
        })
    # dedup identical edges
    resolved_edges = list({e["uuid"]: e for e in resolved_edges}.values())

    graph = {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "entity_count": len(entities),
        "edge_count": len(resolved_edges),
        "dropped_edges": dropped,
        "extraction_failures": extraction_failures,
        "entities": entities,
        "edges": resolved_edges,
    }
    (store.project_dir(project_id) / "graph.json").write_text(
        json.dumps(graph, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    # ---- mirror into Chroma in the reader schema ---------------------------
    collection = get_or_create_collection(store.graph_id(project_id))
    _mirror_to_chroma(collection, entities, resolved_edges)
    logger.info(
        f"graph built: {len(entities)} entities, {len(resolved_edges)} edges, "
        f"{dropped} edges dropped"
    )
    return graph
