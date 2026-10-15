"""SQLite-backed task store. Progress survives backend restarts."""

import json
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

STATUSES = ("pending", "running", "done", "failed", "cancelled")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TaskStore:
    def __init__(self, db_path: Path):
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with self._conn() as c:
            c.execute(
                """CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress REAL NOT NULL DEFAULT 0,
                    message TEXT NOT NULL DEFAULT '',
                    payload TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )"""
            )

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.row_factory = sqlite3.Row
        return conn

    @staticmethod
    def _to_dict(row: sqlite3.Row) -> dict:
        d = dict(row)
        d["payload"] = json.loads(d["payload"])
        return d

    def create(self, kind: str, payload: dict | None = None) -> dict:
        task_id = uuid.uuid4().hex[:12]
        now = _now()
        with self._lock, self._conn() as c:
            c.execute(
                "INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?)",
                (task_id, kind, "pending", 0.0, "",
                 json.dumps(payload or {}), now, now),
            )
        return self.get(task_id)

    def update(
        self,
        task_id: str,
        status: str | None = None,
        progress: float | None = None,
        message: str | None = None,
    ) -> None:
        if status is not None and status not in STATUSES:
            raise ValueError(f"invalid status: {status!r}")
        sets, args = ["updated_at = ?"], [_now()]
        for col, val in (("status", status), ("progress", progress),
                         ("message", message)):
            if val is not None:
                sets.append(f"{col} = ?")
                args.append(val)
        args.append(task_id)
        with self._lock, self._conn() as c:
            c.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", args)

    def get(self, task_id: str) -> dict | None:
        with self._conn() as c:
            row = c.execute(
                "SELECT * FROM tasks WHERE id = ?", (task_id,)
            ).fetchone()
        return self._to_dict(row) if row else None

    def list(self, kind: str | None = None, status: str | None = None) -> list[dict]:
        where, args = [], []
        if kind:
            where.append("kind = ?")
            args.append(kind)
        if status:
            where.append("status = ?")
            args.append(status)
        sql = "SELECT * FROM tasks"
        if where:
            sql += " WHERE " + " AND ".join(where)
        sql += " ORDER BY created_at"
        with self._conn() as c:
            return [self._to_dict(r) for r in c.execute(sql, args)]
