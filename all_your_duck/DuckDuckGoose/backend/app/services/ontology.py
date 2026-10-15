"""Ontology design: one builder-LLM call over a corpus sample + the anchor
question. Operator-editable afterwards via the API. Tolerant
normalization because small local models emit sloppy structures."""

from datetime import datetime, timezone

from app.core.projects import ProjectStore

SAMPLE_CHARS_PER_DOC = 1500
MAX_SAMPLE_DOCS = 12

_SYSTEM = (
    "You design ontologies for social simulations. Given a corpus sample and "
    "the operator's question, propose 5-8 entity types and 4-6 edge types "
    "that capture the actors and relationships that matter to the question. "
    'Reply with JSON: {"entity_types": [{"name": str, "description": str}], '
    '"edge_types": [{"name": str, "description": str}]}. '
    "Entity type names are singular TitleCase nouns (Person, Organization). "
    "Edge type names are UPPER_SNAKE verbs (WORKS_FOR, OPPOSES). English only."
)


def _corpus_sample(store: ProjectStore, project: dict) -> str:
    parts = []
    for record in list(project["docs"].values())[:MAX_SAMPLE_DOCS]:
        text = (store.corpus_dir(project["id"]) / record["stored_path"]).read_text(
            encoding="utf-8", errors="replace"
        )
        parts.append(f"## {record['title']}\n{text[:SAMPLE_CHARS_PER_DOC]}")
    return "\n\n".join(parts)


def _normalize_types(raw, title_case: bool) -> list[dict]:
    out, seen = [], set()
    for item in raw if isinstance(raw, list) else []:
        if isinstance(item, str):
            name, desc = item, ""
        elif isinstance(item, dict) and item.get("name"):
            name, desc = str(item["name"]), str(item.get("description", ""))
        else:
            continue
        name = name.strip()
        if title_case:
            name = name[:1].upper() + name[1:].lower() if name else name
        else:
            name = name.upper().replace(" ", "_")
        if not name or name.casefold() in seen:
            continue
        seen.add(name.casefold())
        out.append({"name": name, "description": desc.strip()})
    return out


def generate_ontology(store: ProjectStore, project_id: str, llm) -> dict:
    project = store.get(project_id)
    if project is None:
        raise ValueError(f"unknown project: {project_id}")

    raw = llm.chat_json(
        [
            {"role": "system", "content": _SYSTEM},
            {
                "role": "user",
                "content": (
                    f"OPERATOR QUESTION: {project['question']}\n\n"
                    f"CORPUS SAMPLE:\n{_corpus_sample(store, project)}"
                ),
            },
        ],
        temperature=0.3,
    )

    ontology = {
        "entity_types": _normalize_types(raw.get("entity_types"), title_case=True),
        "edge_types": _normalize_types(raw.get("edge_types"), title_case=False),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    project["ontology"] = ontology
    store.save(project)
    return ontology
