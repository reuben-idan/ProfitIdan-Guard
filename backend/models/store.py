"""SQLite store (stdlib). Approvals and audit entries live here, not in memory."""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY, filename TEXT, kind TEXT, rows_accepted INTEGER,
    issues TEXT, path TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY, question TEXT, result TEXT, verdicts TEXT,
    status TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY, type TEXT, target TEXT, amount TEXT,
    draft_text TEXT, finding_ref TEXT, status TEXT, approved_by TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS audit (
    id TEXT PRIMARY KEY, actor TEXT, event TEXT, ref_id TEXT,
    detail TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, name TEXT, path TEXT, created_at TEXT
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path) as conn:
            conn.executescript(SCHEMA)

    def _write(self, sql: str, params: tuple) -> None:
        with sqlite3.connect(self.path) as conn:
            conn.execute(sql, params)
            conn.commit()

    def _one(self, sql: str, params: tuple) -> dict | None:
        with sqlite3.connect(self.path) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(sql, params).fetchone()
            return dict(row) if row else None

    def _all(self, sql: str, params: tuple = ()) -> list[dict]:
        with sqlite3.connect(self.path) as conn:
            conn.row_factory = sqlite3.Row
            return [dict(r) for r in conn.execute(sql, params).fetchall()]

    # -- sessions --------------------------------------------------------------------
    def create_session(self, name: str, path: str) -> str:
        sid = f"s_{uuid.uuid4().hex[:8]}"
        self._write("INSERT INTO sessions VALUES (?,?,?,?)", (sid, name, path, _now()))
        return sid

    def get_session(self, sid: str) -> dict | None:
        return self._one("SELECT * FROM sessions WHERE id=?", (sid,))

    # -- uploads / investigations -------------------------------------------------
    def record_upload(self, filename: str, kind: str, rows: int, issues: list, path: str) -> str:
        uid = f"u_{uuid.uuid4().hex[:8]}"
        self._write(
            "INSERT INTO uploads VALUES (?,?,?,?,?,?,?)",
            (uid, filename, kind, rows, json.dumps(issues), path, _now()),
        )
        return uid

    def save_investigation(self, question: str, result: dict, verdicts: list, status: str) -> str:
        iid = f"inv_{uuid.uuid4().hex[:8]}"
        self._write(
            "INSERT INTO investigations VALUES (?,?,?,?,?,?)",
            (iid, question, json.dumps(result), json.dumps(verdicts), status, _now()),
        )
        return iid

    def get_investigation(self, iid: str) -> dict | None:
        return self._one("SELECT * FROM investigations WHERE id=?", (iid,))

    def list_investigations(self, limit: int = 20) -> list[dict]:
        rows = self._all(
            "SELECT id, question, status, created_at FROM investigations "
            "ORDER BY created_at DESC LIMIT ?",
            (limit,),
        )
        return rows

    # -- actions + audit -----------------------------------------------------------
    def draft_action(self, type: str, target: str, amount: str, draft_text: str, finding_ref: str) -> str:
        aid = f"act_{uuid.uuid4().hex[:8]}"
        self._write(
            "INSERT INTO actions VALUES (?,?,?,?,?,?,?,?,?)",
            (aid, type, target, amount, draft_text, finding_ref, "draft", "", _now()),
        )
        self.audit("system", "action_drafted", aid, f"{type} {target} {amount}")
        return aid

    def set_action(self, aid: str, status: str, approved_by: str = "") -> dict | None:
        self._write("UPDATE actions SET status=?, approved_by=? WHERE id=?", (status, approved_by, aid))
        self.audit(approved_by or "system", f"action_{status}", aid, "")
        return self.get_action(aid)

    def get_action(self, aid: str) -> dict | None:
        return self._one("SELECT * FROM actions WHERE id=?", (aid,))

    def list_actions(self) -> list[dict]:
        return self._all("SELECT * FROM actions ORDER BY created_at")

    def audit(self, actor: str, event: str, ref_id: str, detail: str) -> None:
        self._write(
            "INSERT INTO audit VALUES (?,?,?,?,?,?)",
            (f"aud_{uuid.uuid4().hex[:8]}", actor, event, ref_id, detail, _now()),
        )

    def audit_trail(self, ref_id: str) -> list[dict]:
        return self._all("SELECT * FROM audit WHERE ref_id=? ORDER BY created_at", (ref_id,))
