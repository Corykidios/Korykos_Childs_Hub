"""Retrieval helpers over a project's Chroma collection, for report writing.

The report agent is expected to ground every section in retrieved evidence, so
each result object knows how to render itself as plain text suitable for
dropping straight into a prompt, and as a dict for the audit trail.

Live agent interviews are deliberately not performed here. Interviewing needs
a running simulation worker, which this module has no handle on, so a fetcher
is injected by callers that have one. Without a fetcher the result is honestly
empty rather than reaching for a hardcoded URL.
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from app.services.memory.chroma_client import get_or_create_collection

logger = logging.getLogger(__name__)

_NOTHING_FOUND = "(no results)"

# Per-call ceilings on how much evidence each retrieval mode pulls back.
_PANORAMA_LIMIT = 50
_INSIGHT_LIMIT = 15
_INSIGHT_MAX_FACTS = 20
_ENTITY_LIMIT = 10
_CONTEXT_LIMIT = 15


def _numbered(items: List[str]) -> str:
    return "\n".join(f"{position}. {item}" for position, item in enumerate(items, 1))


def _bulleted(items: List[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def _join_sections(sections: List[tuple], empty: str) -> str:
    """Render (heading, body) pairs, skipping any with an empty body."""
    rendered = [f"{heading}\n{body}" for heading, body in sections if body]
    return "\n\n".join(rendered) if rendered else empty


@dataclass
class SearchResult:
    """Documents matching one query."""

    facts: List[str] = field(default_factory=list)
    edges: List[Dict[str, Any]] = field(default_factory=list)
    nodes: List[Dict[str, Any]] = field(default_factory=list)
    query: str = ""
    total_count: int = 0

    def to_text(self) -> str:
        if not self.facts:
            return _NOTHING_FOUND
        header = f"{self.total_count} result(s) for: {self.query}"
        return f"{header}\n\n{_numbered(self.facts)}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "facts": self.facts,
            "edges": self.edges,
            "nodes": self.nodes,
            "query": self.query,
            "total_count": self.total_count,
        }


@dataclass
class InsightForgeResult:
    """Evidence gathered across several angles on the same question."""

    semantic_facts: List[str] = field(default_factory=list)
    entity_insights: List[str] = field(default_factory=list)
    relationship_chains: List[str] = field(default_factory=list)
    sub_questions: List[str] = field(default_factory=list)

    def to_text(self) -> str:
        return _join_sections(
            [
                ("Questions asked:", _bulleted(self.sub_questions)),
                ("Supporting evidence:", _bulleted(self.semantic_facts)),
                ("What the entities show:", _bulleted(self.entity_insights)),
                ("Connections:", _bulleted(self.relationship_chains)),
            ],
            empty="(no insights found)",
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "sub_questions": self.sub_questions,
            "semantic_facts": self.semantic_facts,
            "entity_insights": self.entity_insights,
            "relationship_chains": self.relationship_chains,
        }


@dataclass
class PanoramaResult:
    """A wide sweep, with superseded material kept separate."""

    all_facts: List[str] = field(default_factory=list)
    expired_facts: List[str] = field(default_factory=list)

    def to_text(self) -> str:
        return _join_sections(
            [
                ("Current:", _bulleted(self.all_facts)),
                ("Superseded:", _bulleted(self.expired_facts)),
            ],
            empty=_NOTHING_FOUND,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {"all_facts": self.all_facts, "expired_facts": self.expired_facts}


@dataclass
class AgentInterview:
    """One agent's answer, attributed."""

    agent_name: str
    quote: str
    platform: str

    def to_dict(self) -> Dict[str, Any]:
        return {"agent": self.agent_name, "quote": self.quote, "platform": self.platform}


@dataclass
class InterviewResult:
    interviews: List[AgentInterview] = field(default_factory=list)

    def to_text(self) -> str:
        if not self.interviews:
            return "(no interviews)"
        return "\n".join(
            f"[{item.platform}] {item.agent_name}: {item.quote}" for item in self.interviews
        )

    def to_dict(self) -> Dict[str, Any]:
        return {"interviews": [item.to_dict() for item in self.interviews]}


class ChromaToolsService:
    """Search and statistics over one project's stored simulation memory."""

    def __init__(self, interview_fetcher: Optional[Callable] = None):
        self._interview_fetcher = interview_fetcher

    # -- retrieval primitives ----------------------------------------------

    @staticmethod
    def _capped(collection, ceiling: int) -> int:
        """Chroma rejects n_results of 0, and returns at most what it holds."""
        return min(ceiling, max(collection.count(), 1))

    @staticmethod
    def _documents(results: Optional[dict]) -> List[str]:
        """First (and only) query's documents, or empty."""
        documents = (results or {}).get("documents") or []
        return list(documents[0]) if documents else []

    def _search(self, collection, query: str, ceiling: int) -> List[str]:
        return self._documents(
            collection.query(query_texts=[query], n_results=self._capped(collection, ceiling))
        )

    # -- search modes -------------------------------------------------------

    def quick_search(self, graph_id: str, query: str, limit: int = 10) -> SearchResult:
        """A narrow lookup, for checking one specific thing."""
        facts = self._search(get_or_create_collection(graph_id), query, limit)
        return SearchResult(facts=facts, query=query, total_count=len(facts))

    def panorama_search(
        self, graph_id: str, query: str, include_expired: bool = False
    ) -> PanoramaResult:
        """A wide sweep, for establishing the overall picture."""
        facts = self._search(get_or_create_collection(graph_id), query, _PANORAMA_LIMIT)
        return PanoramaResult(all_facts=facts)

    def insight_forge(
        self,
        graph_id: str,
        query: str,
        simulation_requirement: str = "",
        report_context: str = "",
    ) -> InsightForgeResult:
        """Search the question and the run's framing, then merge the evidence.

        Two angles on the same corpus surface different documents; duplicates
        are dropped while preserving the order they were found in.
        """
        collection = get_or_create_collection(graph_id)

        merged: List[str] = []
        for angle in (query, simulation_requirement):
            if not angle:
                continue
            for document in self._search(collection, angle, _INSIGHT_LIMIT):
                if document not in merged:
                    merged.append(document)

        return InsightForgeResult(
            semantic_facts=merged[:_INSIGHT_MAX_FACTS], sub_questions=[query]
        )

    def get_simulation_context(self, graph_id: str, simulation_requirement: str) -> SearchResult:
        return self.quick_search(graph_id, simulation_requirement, limit=_CONTEXT_LIMIT)

    # -- entity lookups -----------------------------------------------------

    def get_entity_summary(self, graph_id: str, entity_name: str) -> SearchResult:
        """Everything recorded about one named agent.

        Prefers an exact metadata match, falling back to semantic similarity
        when the collection has no such field to filter on.
        """
        collection = get_or_create_collection(graph_id)
        limit = self._capped(collection, _ENTITY_LIMIT)

        try:
            results = collection.query(
                query_texts=[entity_name],
                n_results=limit,
                where={"agent_name": entity_name} if entity_name else None,
            )
        except Exception:
            logger.debug("Filtered entity lookup failed, falling back", exc_info=True)
            results = collection.query(query_texts=[entity_name], n_results=limit)

        facts = self._documents(results)
        return SearchResult(facts=facts, query=entity_name, total_count=len(facts))

    def get_entities_by_type(self, graph_id: str, entity_type: str) -> SearchResult:
        """All entities of one ontology type, exactly where possible."""
        collection = get_or_create_collection(graph_id)

        try:
            results = collection.get(where={"type": entity_type}, include=["documents"])
            facts = list(results.get("documents") or [])
        except Exception:
            logger.debug("Typed entity read failed, falling back", exc_info=True)
            facts = self._search(collection, entity_type, _ENTITY_LIMIT)

        return SearchResult(facts=facts, query=entity_type, total_count=len(facts))

    def get_graph_statistics(self, graph_id: str) -> Dict[str, Any]:
        collection = get_or_create_collection(graph_id)
        return {"total_documents": collection.count(), "graph_id": graph_id}

    # -- interviews ---------------------------------------------------------

    def interview_agents(
        self,
        simulation_id: str,
        interview_requirement: str,
        simulation_requirement: str,
        max_agents: int = 5,
    ) -> InterviewResult:
        """Ask live agents a question, if a caller supplied a way to reach them."""
        if self._interview_fetcher is None:
            logger.warning(
                "Live interviews need a running worker; use the runs interview "
                "API instead. Returning no interviews."
            )
            return InterviewResult()

        try:
            raw = self._interview_fetcher(
                simulation_id, interview_requirement, simulation_requirement, max_agents
            )
        except Exception as exc:
            logger.warning("Interview fetcher failed: %s", exc)
            return InterviewResult()

        return InterviewResult(interviews=self._coerce_interviews(raw, max_agents))

    @staticmethod
    def _coerce_interviews(raw: Any, max_agents: int) -> List[AgentInterview]:
        """Accept either interview objects or plain dicts from the fetcher."""
        interviews: List[AgentInterview] = []
        for item in (raw or [])[:max_agents]:
            if isinstance(item, AgentInterview):
                interviews.append(item)
            elif isinstance(item, dict):
                interviews.append(
                    AgentInterview(
                        agent_name=str(item.get("agent_name", "unknown")),
                        quote=str(item.get("quote", "")),
                        platform=str(item.get("platform", "unknown")),
                    )
                )
        return interviews
