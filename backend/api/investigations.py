"""Investigation endpoint: run the Meta-directed investigation, then verify
every finding through TradeGuard before returning.

Without MODEL_API_KEY the endpoint runs the deterministic demo-mode review
(same tools, same verifier) instead of failing, so judges and free-tier
deployments always see verified value.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..agent.fallback import run_heuristic_investigation
from ..agent.orchestrator import MetaClient, run_investigation
from ..agent.tools import ToolContext
from ..finance.datasets import TABLE_FILES
from ..models.store import Store
from ..verification.verifier import verify_finding

router = APIRouter(prefix="/investigations", tags=["investigations"])


class InvestigateRequest(BaseModel):
    question: str
    data_dir: str | None = None
    session_id: str | None = None
    demo_mode: bool | None = None


def _store() -> Store:
    return Store(os.getenv("PROFITPILOT_DB", "backend/profitpilot.db"))


def _sessions_root() -> Path:
    root = Path(os.getenv("PROFITPILOT_UPLOADS", "data/uploads")) / "sessions"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _missing_parts(session_dir: Path) -> list[str]:
    missing: list[str] = []
    if not (session_dir / "meta.json").exists():
        missing.append("business details (meta)")
    for kind, filename in TABLE_FILES.items():
        if not (session_dir / filename).exists():
            missing.append(kind)
    return missing


def _resolve_data_dir(req: InvestigateRequest) -> str:
    """Prefer session_id (server-resolved, traversal-safe).

    Falls back to legacy data_dir for the demo and older clients.
    Raises HTTPException with actionable detail instead of a bare
    FileNotFoundError.
    """
    if req.session_id:
        sid = req.session_id.strip()
        # Strict id shape: what create_session issues (s_ + 8 hex).
        if not sid or "/" in sid or "\\" in sid or ".." in sid:
            raise HTTPException(status_code=400, detail=f"Invalid session id: {sid!r}.")
        session = _store().get_session(sid)
        session_dir = _sessions_root() / sid
        if session is None and not session_dir.exists():
            raise HTTPException(
                status_code=400,
                detail="Session not found — it may have expired when the free-tier "
                "server restarted (uploads are ephemeral there). Your files are safe "
                "on your device: create a new session and re-upload, or use the "
                "demo dataset to continue instantly.",
            )
        missing = _missing_parts(session_dir)
        if missing:
            raise HTTPException(
                status_code=400,
                detail="Session incomplete — still missing: "
                + ", ".join(missing)
                + ". Upload the remaining files and save business details, "
                "then run the investigation again.",
            )
        return str(session_dir)
    data_dir = (req.data_dir or os.getenv("PROFITPILOT_DATA", "data/demo")).strip()
    # Guard: only the bundled demo or session dirs under the uploads root.
    candidate = Path(data_dir)
    if candidate.is_absolute() or ".." in candidate.parts:
        # Allow absolute paths only when they sit inside the uploads root
        # or the repo (demo), otherwise reject to stop traversal.
        try:
            resolved = candidate.resolve()
            allowed = [Path("data/demo").resolve(), Path(os.getenv("PROFITPILOT_UPLOADS", "data/uploads")).resolve()]
            if not any(resolved == a or a in resolved.parents for a in allowed):
                raise HTTPException(status_code=400, detail=f"Refusing data_dir outside datasets: {data_dir!r}.")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=400, detail=f"Invalid data_dir: {data_dir!r}.")
    return data_dir


@router.post("")
def investigate(req: InvestigateRequest) -> dict:
    data_dir = _resolve_data_dir(req)
    demo_mode = req.demo_mode if req.demo_mode is not None else not os.getenv("MODEL_API_KEY")
    try:
        ctx = ToolContext.for_data(data_dir)
    except FileNotFoundError as exc:
        # Name the missing pieces so the UI can say what to upload next.
        session_dir = Path(data_dir)
        missing = _missing_parts(session_dir) if session_dir.exists() else []
        if missing:
            detail = (
                "Dataset incomplete — still missing: " + ", ".join(missing) + ". "
                "Upload the remaining files and save business details, then retry."
            )
        else:
            detail = (
                f"Dataset not found ({exc}) — the session may have expired on the "
                "free tier. Use the demo dataset or re-upload your files."
            )
        raise HTTPException(status_code=400, detail=detail)
    if demo_mode:
        result = run_heuristic_investigation(req.question, ctx)
    else:
        if not os.getenv("MODEL_API_KEY"):
            raise HTTPException(
                status_code=503,
                detail="The AI model is not configured on this server (no API key). "
                "Use Instant review instead — same tools, same verifier.",
            )
        client = MetaClient()
        try:
            result = run_investigation(req.question, ctx, client)
        except Exception as exc:
            where = f"for model '{client.model}' at {client.base_url} ({exc})"
            if "404" in str(exc) or "not found" in str(exc).lower():
                detail = (
                    f"AI model request failed {where}: the API does not recognise that model id. "
                    "On Render, check MODEL_NAME is exactly muse-spark-1.3 (no typos, quotes, or "
                    "extra spaces), then Manual Deploy to restart. Try Instant review meanwhile."
                )
            else:
                detail = f"AI model request failed {where}. Try Instant review instead."
            raise HTTPException(status_code=502, detail=detail)
    verdicts = [verify_finding(f, ctx.bundle) for f in result.findings]
    status = "completed" if result.completed else "incomplete"
    iid = _store().save_investigation(req.question, result.to_dict(), verdicts, status, demo_mode)
    return {
        "id": iid,
        "status": status,
        "demo_mode": demo_mode,
        "result": result.to_dict(),
        "verdicts": verdicts,
    }


@router.get("")
def list_investigations(limit: int = 20) -> dict:
    return {"investigations": _store().list_investigations(min(max(limit, 1), 50))}


@router.get("/{investigation_id}")
def get_investigation(investigation_id: str) -> dict:
    record = _store().get_investigation(investigation_id)
    if record is None:
        raise HTTPException(status_code=404, detail="investigation not found")
    return {
        **record,
        "result": json.loads(record["result"]),
        "verdicts": json.loads(record["verdicts"]),
    }
