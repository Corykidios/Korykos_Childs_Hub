"""Corpus intake: UI uploads + registered vault folders.

Documents are content-addressed (doc_id = sha256[:16]) so rescans are
idempotent and edits register as new documents. Obsidian [[wikilinks]]
are recorded as relationship hints for entity resolution.
"""

import hashlib
import re
from datetime import datetime, timezone
from pathlib import Path

from app.core.projects import ProjectStore

CORPUS_EXTENSIONS = {".md", ".txt", ".markdown"}
_WIKILINK_RE = re.compile(r"\[\[([^\[\]|]+)(?:\|[^\[\]]*)?\]\]")
_HEADING_RE = re.compile(r"^#\s+(.+)$", re.MULTILINE)


def extract_wikilinks(text: str) -> list[str]:
    seen, out = set(), []
    for m in _WIKILINK_RE.finditer(text):
        name = m.group(1).strip()
        if name and name not in seen:
            seen.add(name)
            out.append(name)
    return out


def _title_for(filename: str, text: str) -> str:
    heading = _HEADING_RE.search(text)
    if heading:
        return heading.group(1).strip()
    return Path(filename).stem


def _make_record(
    filename: str, content: bytes, source: str, source_path: str
) -> dict:
    text = content.decode("utf-8", errors="replace")
    digest = hashlib.sha256(content).hexdigest()
    return {
        "doc_id": f"doc_{digest[:16]}",
        "title": _title_for(filename, text),
        "source": source,
        "source_path": source_path,
        "stored_path": "",  # set after the copy is written
        "sha256": digest,
        "size": len(content),
        "link_hints": extract_wikilinks(text),
        "ingested_at": datetime.now(timezone.utc).isoformat(),
        "status": "registered",
    }


def _store_doc(
    store: ProjectStore, project: dict, record: dict, content: bytes
) -> dict:
    """Register the record and persist a corpus copy. Idempotent by doc_id."""
    if record["doc_id"] in project["docs"]:
        return project["docs"][record["doc_id"]]
    stored_name = f"{record['doc_id']}.txt"
    (store.corpus_dir(project["id"]) / stored_name).write_bytes(content)
    record["stored_path"] = stored_name
    project["docs"][record["doc_id"]] = record
    store.save(project)
    return record


def register_upload(
    store: ProjectStore, project_id: str, filename: str, content: bytes
) -> dict:
    project = store.get(project_id)
    if project is None:
        raise ValueError(f"unknown project: {project_id}")
    record = _make_record(filename, content, "upload", filename)
    return _store_doc(store, project, record, content)


def register_folder(store: ProjectStore, project_id: str, folder: str) -> None:
    project = store.get(project_id)
    if project is None:
        raise ValueError(f"unknown project: {project_id}")
    path = Path(folder)
    if not path.is_dir():
        raise ValueError(f"folder does not exist: {folder}")
    resolved = str(path.resolve())
    if resolved not in project["folders"]:
        project["folders"].append(resolved)
        store.save(project)


def rescan(store: ProjectStore, project_id: str) -> list[dict]:
    """Walk registered folders; register new/changed docs. Returns new records."""
    project = store.get(project_id)
    if project is None:
        raise ValueError(f"unknown project: {project_id}")
    added = []
    for folder in project["folders"]:
        root = Path(folder)
        if not root.is_dir():
            continue
        for f in sorted(root.rglob("*")):
            if not f.is_file() or f.suffix.lower() not in CORPUS_EXTENSIONS:
                continue
            content = f.read_bytes()
            record = _make_record(f.name, content, "folder", str(f))
            if record["doc_id"] in project["docs"]:
                continue
            added.append(_store_doc(store, project, record, content))
    return added
