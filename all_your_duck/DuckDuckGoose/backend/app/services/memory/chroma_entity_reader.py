"""Read the project knowledge graph back out of ChromaDB.

`graph_build` writes three kinds of row into a per-project collection, tagged
by a `doc_type` metadata field: `entity`, `edge`, and `text_chunk` (plus an
`ontology` row). This module is the read side. It turns those flat rows back
into entity objects, optionally wired up with the edges that touch them.

Chroma returns results as parallel arrays (`ids`, `metadatas`, `documents`)
rather than a list of records, so everything here funnels through `_iter_rows`,
which zips them into dicts once and lets the rest of the module stay readable.

Collections written by older builds predate the `doc_type` tag. Reads that
filter on it therefore fall back rather than raising, so an old project stays
openable instead of erroring at the UI.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, Iterator, List, Optional, Set

from app.services.memory.chroma_client import get_or_create_collection

logger = logging.getLogger(__name__)

# Labels every node carries; they describe the storage shape, not the entity,
# so they are stripped when reporting an entity's real type.
_STRUCTURAL_LABELS = ("Entity", "Node")

_NON_ENTITY_DOC_TYPES = ("text_chunk", "ontology", "edge")

_DEFAULT_LABEL = "Entity"
_DEFAULT_EDGE_NAME = "RELATED"


@dataclass
class EntityNode:
    """One resolved real-world actor, plus whatever context was asked for."""

    uuid: str
    name: str
    labels: List[str] = field(default_factory=list)
    summary: str = ""
    attributes: Dict[str, Any] = field(default_factory=dict)
    related_edges: List[Dict[str, Any]] = field(default_factory=list)
    related_nodes: List[Dict[str, Any]] = field(default_factory=list)

    def get_entity_types(self) -> List[str]:
        """The entity's meaningful types, structural labels removed."""
        return [label for label in self.labels if label not in _STRUCTURAL_LABELS]

    def get_entity_type(self) -> Optional[str]:
        """The first meaningful type, or None if the entity only has labels."""
        types = self.get_entity_types()
        return types[0] if types else None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "uuid": self.uuid,
            "name": self.name,
            "labels": self.labels,
            "summary": self.summary,
            "attributes": self.attributes,
            "related_edges": self.related_edges,
            "related_nodes": self.related_nodes,
        }


@dataclass
class FilteredEntities:
    """Result of an entity query, with the types actually encountered."""

    entities: List[EntityNode] = field(default_factory=list)
    entity_types: Set[str] = field(default_factory=set)
    total_count: int = 0
    filtered_count: int = 0

    @property
    def count(self) -> int:
        return len(self.entities)

    @property
    def entity_types_found(self) -> List[str]:
        return list(self.entity_types)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entities": [entity.to_dict() for entity in self.entities],
            "entity_types": list(self.entity_types),
            "total_count": self.total_count,
            "filtered_count": self.filtered_count,
        }


_EMPTY_RESULT: Dict[str, list] = {"ids": [], "metadatas": [], "documents": []}


def _iter_rows(results: Optional[dict]) -> Iterator[Dict[str, Any]]:
    """Zip Chroma's parallel result arrays into one dict per row.

    Chroma omits `metadatas`/`documents` entirely when they were not included
    in the query, so both are treated as optional and defaulted per row.
    """
    if not results:
        return
    ids = results.get("ids") or []
    metadatas = results.get("metadatas") or []
    documents = results.get("documents") or []

    for index, row_id in enumerate(ids):
        yield {
            "id": row_id,
            "meta": metadatas[index] if index < len(metadatas) else {},
            "document": documents[index] if index < len(documents) else "",
        }


def _labels_of(meta: Dict[str, Any]) -> List[str]:
    """Labels are stored comma-joined because Chroma metadata is scalar-only."""
    return str(meta.get("labels", _DEFAULT_LABEL)).split(",")


def _query(collection, **kwargs) -> Optional[dict]:
    """Run a Chroma `get`, returning None instead of raising.

    A filtered read against a collection written before `doc_type` existed
    raises rather than returning nothing, and that must not surface as a 500.
    """
    try:
        return collection.get(**kwargs)
    except Exception:
        logger.debug("Chroma get failed for %s", kwargs.get("where"), exc_info=True)
        return None


class ChromaEntityReader:
    """Query interface over one project's stored graph."""

    def filter_defined_entities(
        self,
        graph_id: str,
        defined_entity_types: Optional[List[str]] = None,
        enrich_with_edges: bool = False,
    ) -> FilteredEntities:
        """Fetch entities, optionally narrowed to a set of types."""
        collection = get_or_create_collection(graph_id)

        results = _query(
            collection,
            where=self._entity_filter(defined_entity_types),
            include=["documents", "metadatas"],
        )

        if results is None:
            # Pre-`doc_type` collection: retry on the bare type field alone.
            legacy_filter = (
                {"type": {"$in": defined_entity_types}} if defined_entity_types else None
            )
            results = _query(
                collection, where=legacy_filter, include=["documents", "metadatas"]
            ) or _EMPTY_RESULT

        entities = self._to_entities(results)

        if enrich_with_edges and entities:
            self._attach_context(graph_id, entities)

        return FilteredEntities(
            entities=entities,
            entity_types={t for e in entities for t in e.get_entity_types()},
            total_count=len(entities),
            filtered_count=len(entities),
        )

    def get_entities_by_type(
        self, graph_id: str, entity_type: str, enrich_with_edges: bool = True
    ) -> List[EntityNode]:
        return self.filter_defined_entities(
            graph_id, [entity_type], enrich_with_edges=enrich_with_edges
        ).entities

    def get_entity_with_context(
        self, graph_id: str, entity_uuid: str
    ) -> Optional[Dict[str, Any]]:
        """One entity by uuid, with its edges and neighbours attached."""
        collection = get_or_create_collection(graph_id)
        results = _query(
            collection, ids=[entity_uuid], include=["documents", "metadatas"]
        )

        entities = self._to_entities(results) if results else []
        if not entities:
            return None

        entity = entities[0]
        self._attach_context(graph_id, [entity])
        return entity.to_dict()

    def get_all_nodes(self, graph_id: str) -> List[Dict[str, Any]]:
        """Every entity row, as plain dicts."""
        collection = get_or_create_collection(graph_id)

        results = _query(
            collection, where={"doc_type": "entity"}, include=["documents", "metadatas"]
        )
        filter_in_python = results is None
        if filter_in_python:
            # No `doc_type` to filter on, so read everything and exclude the
            # row kinds we know are not entities.
            results = _query(collection, include=["documents", "metadatas"]) or _EMPTY_RESULT

        nodes = []
        for row in _iter_rows(results):
            meta = row["meta"]
            if meta.get("doc_type") in _NON_ENTITY_DOC_TYPES:
                continue
            nodes.append(
                {
                    "uuid": row["id"],
                    "name": meta.get("name", row["id"]),
                    "labels": _labels_of(meta),
                    "summary": row["document"],
                    "attributes": meta,
                }
            )
        return nodes

    def get_all_edges(self, graph_id: str) -> List[Dict[str, Any]]:
        """Every edge row, as plain dicts. Empty when the graph has none."""
        collection = get_or_create_collection(graph_id)
        results = _query(
            collection, where={"doc_type": "edge"}, include=["documents", "metadatas"]
        )
        if results is None:
            return []

        return [
            {
                "uuid": row["id"],
                "name": row["meta"].get("name", _DEFAULT_EDGE_NAME),
                "fact": row["document"],
                "source_node_uuid": row["meta"].get("source_node_uuid", ""),
                "target_node_uuid": row["meta"].get("target_node_uuid", ""),
                "source_name": row["meta"].get("source_name", ""),
                "target_name": row["meta"].get("target_name", ""),
                "attributes": row["meta"],
            }
            for row in _iter_rows(results)
        ]

    # -- internals ----------------------------------------------------------

    @staticmethod
    def _entity_filter(
        defined_entity_types: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Chroma `where` clause selecting entity rows, optionally by type."""
        if not defined_entity_types:
            return {"doc_type": "entity"}
        return {
            "$and": [
                {"doc_type": "entity"},
                {"type": {"$in": defined_entity_types}},
            ]
        }

    @staticmethod
    def _to_entities(results: Optional[dict]) -> List[EntityNode]:
        return [
            EntityNode(
                uuid=row["id"],
                name=row["meta"].get("name", row["id"]),
                labels=_labels_of(row["meta"]),
                summary=row["document"],
                attributes=row["meta"],
            )
            for row in _iter_rows(results)
        ]

    def _attach_context(self, graph_id: str, entities: List[EntityNode]) -> None:
        """Populate related_edges and related_nodes for the given entities.

        Each edge is considered once from the perspective of both endpoints,
        so an entity collects its outgoing and incoming edges in a single pass.
        """
        edges = self.get_all_edges(graph_id)
        if not edges:
            return

        by_uuid = {entity.uuid: entity for entity in entities}
        neighbours = {node["uuid"]: node for node in self.get_all_nodes(graph_id)}

        for edge in edges:
            source = edge.get("source_node_uuid", "")
            target = edge.get("target_node_uuid", "")

            # (endpoint that might be ours, the other end, direction, key)
            perspectives = (
                (source, target, "outgoing", "target_node_uuid"),
                (target, source, "incoming", "source_node_uuid"),
            )

            for owner_uuid, other_uuid, direction, other_key in perspectives:
                owner = by_uuid.get(owner_uuid)
                if owner is None:
                    continue

                owner.related_edges.append(
                    {
                        "fact": edge.get("fact", ""),
                        "edge_name": edge.get("name", _DEFAULT_EDGE_NAME),
                        "direction": direction,
                        other_key: other_uuid,
                    }
                )
                self._add_neighbour(owner, neighbours.get(other_uuid), other_uuid)

    @staticmethod
    def _add_neighbour(
        owner: EntityNode, neighbour: Optional[Dict[str, Any]], neighbour_uuid: str
    ) -> None:
        """Record a neighbouring node once, ignoring repeat edges."""
        if neighbour is None:
            return
        if any(known.get("uuid") == neighbour_uuid for known in owner.related_nodes):
            return

        owner.related_nodes.append(
            {
                "uuid": neighbour_uuid,
                "name": neighbour.get("name", neighbour_uuid),
                "labels": neighbour.get("labels", []),
                "summary": neighbour.get("summary", ""),
            }
        )
