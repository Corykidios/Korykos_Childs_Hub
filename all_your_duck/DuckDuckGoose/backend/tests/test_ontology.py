import json

import pytest

from app.core.projects import ProjectStore
from app.services.ingestion import register_upload
from app.services.ontology import generate_ontology


class FakeLLM:
    """Deterministic stand-in for LLMClient: returns canned payloads."""

    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    def chat_json(self, messages, temperature=0.7):
        self.calls.append(messages)
        return self.payload


ONTOLOGY = {
    "entity_types": [
        {"name": "Person", "description": "Named individuals"},
        {"name": "Organization", "description": "Companies, governments"},
    ],
    "edge_types": [{"name": "WORKS_FOR", "description": "Employment"}],
}


@pytest.fixture
def store(tmp_path):
    return ProjectStore(tmp_path / "projects")


def test_generate_ontology_uses_question_and_corpus_sample(store):
    p = store.create(name="t", question="Will oil pass $95?")
    register_upload(store, p["id"], "a.md", b"OPEC cut output. " * 30)
    llm = FakeLLM(ONTOLOGY)

    result = generate_ontology(store, p["id"], llm)

    assert result["entity_types"][0]["name"] == "Person"
    assert "generated_at" in result
    # persisted on the project
    assert store.get(p["id"])["ontology"]["edge_types"][0]["name"] == "WORKS_FOR"
    # prompt contains the anchor question and corpus text
    prompt_text = json.dumps(llm.calls[0])
    assert "Will oil pass $95?" in prompt_text
    assert "OPEC cut output." in prompt_text


def test_generate_ontology_normalizes_sloppy_output(store):
    p = store.create(name="t", question="q")
    register_upload(store, p["id"], "a.md", b"text")
    sloppy = {
        "entity_types": [
            {"name": "  person ", "description": "x"},
            {"name": "person", "description": "dup"},
            "Organization",
            {"no_name": True},
        ],
        "edge_types": ["WORKS_FOR"],
    }
    result = generate_ontology(store, p["id"], FakeLLM(sloppy))
    names = [t["name"] for t in result["entity_types"]]
    assert names == ["Person", "Organization"]
    assert result["edge_types"] == [
        {"name": "WORKS_FOR", "description": ""}
    ]


def test_generate_ontology_unknown_project_raises(store):
    with pytest.raises(ValueError):
        generate_ontology(store, "proj_000000000000", FakeLLM(ONTOLOGY))
