"""Projects + corpus intake API. Long operations run on a daemon thread
with progress in the persistent TaskStore."""

import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

from flask import Blueprint, jsonify, request

from app.core.config import Config
from app.core.projects import ProjectStore
from app.core.taskstore import TaskStore
from app.services.chunking import index_document
from app.services.ingestion import register_folder, register_upload, rescan

logger = logging.getLogger(__name__)
bp = Blueprint("corpus", __name__, url_prefix="/api")

# Extraction sends whole-document context to the builder LLM (a 1M-ctx cloud
# model), far larger than the small INDEX chunks (chunking.DEFAULT_CHUNK_SIZE):
# a doc becomes ~1 call instead of ~3, and the model sees cross-sentence
# relationships. Index chunking stays small for embedding/retrieval quality.
EXTRACTION_CHUNK_SIZE = 8000


def _projects() -> ProjectStore:
    return ProjectStore(Config.PROJECTS_DIR)


def _tasks() -> TaskStore:
    return TaskStore(Config.TASK_DB_PATH)


@bp.post("/projects")
def create_project():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    question = (data.get("question") or "").strip()
    if not name or not question:
        return jsonify({"error": "name and question are required"}), 400
    return jsonify(_projects().create(name=name, question=question)), 201


@bp.get("/projects")
def list_projects():
    return jsonify({"projects": _projects().list()})


@bp.get("/projects/<project_id>")
def get_project(project_id: str):
    project = _projects().get(project_id)
    if project is None:
        return jsonify({"error": "unknown project"}), 404
    return jsonify(project)


@bp.post("/projects/<project_id>/docs")
def upload_docs(project_id: str):
    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "no files"}), 400
    added = []
    for f in files:
        record = register_upload(store, project_id, f.filename, f.read())
        index_document(store, project_id, record["doc_id"])
        added.append(record["doc_id"])
    return jsonify({"added": len(added), "doc_ids": added})


@bp.post("/projects/<project_id>/folders")
def add_folder(project_id: str):
    data = request.get_json(force=True) or {}
    try:
        register_folder(_projects(), project_id, data.get("path", ""))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True})


@bp.post("/projects/<project_id>/rescan")
def rescan_project(project_id: str):
    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    task = _tasks().create(kind="rescan", payload={"project_id": project_id})

    def work(task_id: str = task["id"]):
        tasks = _tasks()
        try:
            tasks.update(task_id, status="running", message="scanning folders")
            added = rescan(store, project_id)
            for i, record in enumerate(added):
                index_document(store, project_id, record["doc_id"])
                tasks.update(
                    task_id,
                    progress=(i + 1) / max(len(added), 1),
                    message=f"indexed {i + 1}/{len(added)}",
                )
            tasks.update(
                task_id, status="done", progress=1.0,
                message=f"added {len(added)} documents",
            )
        except Exception as e:
            logger.exception("rescan failed")
            tasks.update(task_id, status="failed", message=str(e)[:300])

    threading.Thread(target=work, daemon=True).start()
    return jsonify({"task_id": task["id"]}), 202


@bp.get("/tasks/<task_id>")
def get_task(task_id: str):
    task = _tasks().get(task_id)
    if task is None:
        return jsonify({"error": "unknown task"}), 404
    return jsonify(task)


@bp.post("/projects/<project_id>/ontology")
def generate_project_ontology(project_id: str):
    from app.core.profiles import ProfileStore
    from app.services.llm_client import LLMClient
    from app.services.ontology import generate_ontology

    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    profile = ProfileStore(Config.SETTINGS_FILE).resolve_role("builder")
    if profile is None:
        return jsonify({"error": "no builder profile bound in settings"}), 409
    try:
        return jsonify(generate_ontology(store, project_id, LLMClient(profile)))
    except Exception as e:
        logger.exception("ontology generation failed")
        return jsonify({"error": str(e)[:300]}), 502


@bp.put("/projects/<project_id>/ontology")
def edit_project_ontology(project_id: str):
    store = _projects()
    project = store.get(project_id)
    if project is None:
        return jsonify({"error": "unknown project"}), 404
    data = request.get_json(force=True) or {}
    if not isinstance(data.get("entity_types"), list) or not isinstance(
        data.get("edge_types"), list
    ):
        return jsonify({"error": "entity_types and edge_types lists required"}), 400
    project["ontology"] = {
        "entity_types": data["entity_types"],
        "edge_types": data["edge_types"],
        "generated_at": project.get("ontology", {}).get("generated_at", ""),
    }
    store.save(project)
    return jsonify(project["ontology"])


@bp.get("/projects/<project_id>/ontology")
def get_project_ontology(project_id: str):
    project = _projects().get(project_id)
    if project is None:
        return jsonify({"error": "unknown project"}), 404
    return jsonify(project.get("ontology") or {})


@bp.post("/projects/<project_id>/extract")
def extract_project(project_id: str):
    """Background: extract every indexed doc, then resolve + build the graph."""
    from app.core.profiles import ProfileStore
    from app.services.extraction import extract_document
    from app.services.graph_build import build_graph
    from app.services.llm_client import LLMClient
    from app.services.memory.chroma_client import get_embedding_fn

    store = _projects()
    project = store.get(project_id)
    if project is None:
        return jsonify({"error": "unknown project"}), 404
    if not (project.get("ontology") or {}).get("entity_types"):
        return jsonify({"error": "project has no ontology"}), 409
    profile = ProfileStore(Config.SETTINGS_FILE).resolve_role("builder")
    if profile is None:
        return jsonify({"error": "no builder profile bound in settings"}), 409

    task = _tasks().create(kind="extract", payload={"project_id": project_id})

    def work(task_id: str = task["id"]):
        tasks = _tasks()
        try:
            llm = LLMClient(profile)
            doc_ids = list(store.get(project_id)["docs"].keys())
            total = len(doc_ids)
            workers = max(1, getattr(profile, "max_concurrency", 1) or 1)
            tasks.update(
                task_id, status="running", progress=0.0,
                message=f"extracting 0/{total}",
            )
            # Extract docs concurrently. Each writes its own race-free
            # extraction/<doc>.json; we pass persist_status=False because the
            # project store is whole-file read-modify-write, so concurrent
            # per-doc saves would clobber. Statuses are persisted once below.
            done, failed_docs = 0, []
            with ThreadPoolExecutor(max_workers=workers) as pool:
                futures = {
                    pool.submit(
                        extract_document, store, project_id, doc_id, llm,
                        chunk_size=EXTRACTION_CHUNK_SIZE, persist_status=False,
                    ): doc_id
                    for doc_id in doc_ids
                }
                for fut in as_completed(futures):
                    doc_id = futures[fut]
                    try:
                        fut.result()
                    except Exception as exc:
                        logger.warning(f"extract failed for {doc_id}: {exc}")
                        failed_docs.append(doc_id)
                    done += 1
                    tasks.update(
                        task_id, status="running",
                        progress=done / max(total + 1, 1),
                        message=f"extracting {done}/{total}",
                    )
            # Single-threaded status persist (avoids the project.json race).
            proj = store.get(project_id)
            for doc_id in doc_ids:
                rec = proj["docs"].get(doc_id)
                if rec is not None and doc_id not in failed_docs:
                    rec["status"] = "extracted"
            store.save(proj)
            tasks.update(task_id, message="resolving entities")

            ef = get_embedding_fn()

            def embed(texts: list[str]) -> list[list[float]]:
                if ef is not None:
                    return ef(texts)
                # fall back to the collection's default embedding function
                from chromadb.utils.embedding_functions import (
                    DefaultEmbeddingFunction,
                )
                return DefaultEmbeddingFunction()(texts)

            graph = build_graph(store, project_id, embed, llm=llm)
            failures = graph["extraction_failures"]
            tasks.update(
                task_id, status="done", progress=1.0,
                message=(
                    f"{graph['entity_count']} entities, "
                    f"{graph['edge_count']} edges, "
                    f"{failures['failed']}/{failures['total']} "
                    "batches failed"
                ),
            )
        except Exception as e:
            logger.exception("extract pipeline failed")
            tasks.update(task_id, status="failed", message=str(e)[:300])

    threading.Thread(target=work, daemon=True).start()
    return jsonify({"task_id": task["id"]}), 202


@bp.post("/projects/<project_id>/remirror")
def remirror_graph(project_id: str):
    """Re-mirror an already-built graph.json into Chroma (batched), WITHOUT
    re-extracting or re-resolving. Recovery path for a graph that resolved
    successfully but whose Chroma upsert failed (e.g. batch-size overflow)."""
    import json as _json

    from app.services.graph_build import _mirror_to_chroma
    from app.services.memory.chroma_client import get_or_create_collection

    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    graph_file = store.project_dir(project_id) / "graph.json"
    if not graph_file.exists():
        return jsonify({"error": "graph not built yet"}), 404
    graph = _json.loads(graph_file.read_text(encoding="utf-8"))
    entities = graph.get("entities", [])
    edges = graph.get("edges", [])
    collection = get_or_create_collection(store.graph_id(project_id))
    _mirror_to_chroma(collection, entities, edges)
    return jsonify({"mirrored": True, "entities": len(entities), "edges": len(edges)})


@bp.get("/projects/<project_id>/graph")
def get_graph(project_id: str):
    store = _projects()
    if store.get(project_id) is None:
        return jsonify({"error": "unknown project"}), 404
    graph_file = store.project_dir(project_id) / "graph.json"
    if not graph_file.exists():
        return jsonify({"error": "graph not built yet"}), 404
    import json as _json
    return jsonify(_json.loads(graph_file.read_text(encoding="utf-8")))
