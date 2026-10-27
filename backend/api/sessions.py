"""Sessions: assemble several validated uploads into one dataset directory
that investigations can run against."""

from __future__ import annotations

import json
import os
from datetime import date
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..finance.datasets import TABLE_FILES
from ..models.store import Store
from .uploads import REQUIRED_COLUMNS, validate_csv

router = APIRouter(prefix="/sessions", tags=["sessions"])


class CreateSessionRequest(BaseModel):
    name: str


class SessionFileRequest(BaseModel):
    filename: str
    kind: str
    content: str


class SessionMetaRequest(BaseModel):
    business_name: str
    currency: str
    as_of: str
    opening_cash: str
    opening_cash_date: str


def _store() -> Store:
    return Store(os.getenv("PROFITPILOT_DB", "backend/profitpilot.db"))


def _sessions_root() -> Path:
    root = Path(os.getenv("PROFITPILOT_UPLOADS", "data/uploads")) / "sessions"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _get_session_or_404(session_id: str) -> dict:
    session = _store().get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return session


@router.post("")
def create_session(req: CreateSessionRequest) -> dict:
    sid = _store().create_session(req.name, "")
    path = _sessions_root() / sid
    path.mkdir(parents=True, exist_ok=True)
    return {"id": sid, "name": req.name, "path": str(path)}


@router.post("/{session_id}/files")
def upload_session_file(session_id: str, req: SessionFileRequest) -> dict:
    session = _get_session_or_404(session_id)
    if req.kind not in REQUIRED_COLUMNS:
        raise HTTPException(status_code=400, detail=f"unknown kind: {req.kind}")
    accepted, issues = validate_csv(req.kind, req.content)
    dest = Path(_sessions_root()) / session_id / TABLE_FILES[req.kind]
    dest.write_text(req.content, encoding="utf-8")
    uid = _store().record_upload(req.filename, req.kind, len(accepted), issues, str(dest))
    return {
        "status": "accepted" if accepted and not issues else "accepted_with_issues",
        "upload_id": uid,
        "rows_accepted": len(accepted),
        "issues": issues,
        "path": str(dest),
    }


@router.post("/{session_id}/meta")
def set_session_meta(session_id: str, req: SessionMetaRequest) -> dict:
    _get_session_or_404(session_id)
    try:
        date.fromisoformat(req.as_of)
        date.fromisoformat(req.opening_cash_date)
        Decimal(req.opening_cash)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"bad meta value: {exc}")
    if len(req.currency.strip()) != 3:
        raise HTTPException(status_code=400, detail="currency must be a 3-letter code")
    meta = {
        "business_name": req.business_name,
        "currency": req.currency.strip().upper(),
        "as_of": req.as_of,
        "opening_cash": req.opening_cash,
        "opening_cash_date": req.opening_cash_date,
    }
    dest = Path(_sessions_root()) / session_id / "meta.json"
    dest.write_text(json.dumps(meta), encoding="utf-8")
    return {"status": "ok", "path": str(dest)}


@router.get("/{session_id}")
def session_status(session_id: str) -> dict:
    session = _get_session_or_404(session_id)
    session_dir = Path(_sessions_root()) / session_id
    files: dict[str, dict] = {}
    for kind, filename in TABLE_FILES.items():
        dest = session_dir / filename
        if not dest.exists():
            files[kind] = {"present": False}
            continue
        accepted, issues = validate_csv(kind, dest.read_text(encoding="utf-8"))
        files[kind] = {"present": True, "rows_accepted": len(accepted), "issues": issues}
    meta_present = (session_dir / "meta.json").exists()
    ready = meta_present and all(f.get("present") for f in files.values())
    return {
        "id": session_id,
        "name": session["name"],
        "path": str(session_dir),
        "files": files,
        "meta_present": meta_present,
        "ready_for_investigation": ready,
    }
