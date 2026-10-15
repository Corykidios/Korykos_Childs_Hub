"""Disk-backed project store. One dir per project under Config.PROJECTS_DIR.

project.json is the source of truth (stateless app, disk survives
restarts). Schema: {id, name, question, created_at, folders: [str],
docs: {doc_id: {...}}}  — doc records are owned by app.services.ingestion.
"""

import json
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Strict id format — also the path-traversal guard: a project_id is only
# ever joined into filesystem paths after matching this.
_ID_RE = re.compile(r"^proj_[0-9a-f]{12}$")


class ProjectStore:
    def __init__(self, root: Path):
        self._root = Path(root)

    @staticmethod
    def is_valid_id(project_id: str) -> bool:
        return bool(_ID_RE.match(project_id or ""))

    def _checked(self, project_id: str) -> str:
        if not self.is_valid_id(project_id):
            raise ValueError(f"invalid project id: {project_id!r}")
        return project_id

    def _file(self, project_id: str) -> Path:
        return self._root / self._checked(project_id) / "project.json"

    def project_dir(self, project_id: str) -> Path:
        return self._root / self._checked(project_id)

    def corpus_dir(self, project_id: str) -> Path:
        return self._root / self._checked(project_id) / "corpus"

    def graph_id(self, project_id: str) -> str:
        return f"graph-{self._checked(project_id)}"

    def create(self, name: str, question: str) -> dict:
        project = {
            "id": f"proj_{uuid.uuid4().hex[:12]}",
            "name": name,
            "question": question,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "folders": [],
            "docs": {},
        }
        self.corpus_dir(project["id"]).mkdir(parents=True, exist_ok=True)
        self.save(project)
        return project

    def save(self, project: dict) -> None:
        path = self._file(project["id"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(project, indent=2, ensure_ascii=False), encoding="utf-8"
        )

    def get(self, project_id: str) -> dict | None:
        if not self.is_valid_id(project_id):
            return None  # invalid ids (incl. traversal attempts) read as absent
        path = self._file(project_id)
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def list(self) -> list[dict]:
        if not self._root.exists():
            return []
        out = []
        for d in sorted(self._root.iterdir()):
            if (d / "project.json").exists():
                out.append(json.loads((d / "project.json").read_text(encoding="utf-8")))
        return out
