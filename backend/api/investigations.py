"""Investigation endpoint: run the Meta-directed investigation, then verify
every finding through TradeGuard before returning.

Without MODEL_API_KEY the endpoint runs the deterministic demo-mode review
(same tools, same verifier) instead of failing, so judges and free-tier
deployments always see verified value.
"""

from __future__ import annotations

import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..agent.fallback import run_heuristic_investigation
from ..agent.orchestrator import MetaClient, run_investigation
from ..agent.tools import ToolContext
from ..models.store import Store
from ..verification.verifier import verify_finding

router = APIRouter(prefix="/investigations", tags=["investigations"])


class InvestigateRequest(BaseModel):
    question: str
    data_dir: str | None = None
    demo_mode: bool | None = None


def _store() -> Store:
    return Store(os.getenv("PROFITPILOT_DB", "backend/profitpilot.db"))


@router.post("")
def investigate(req: InvestigateRequest) -> dict:
    data_dir = req.data_dir or os.getenv("PROFITPILOT_DATA", "data/demo")
    demo_mode = req.demo_mode if req.demo_mode is not None else not os.getenv("MODEL_API_KEY")
    try:
        ctx = ToolContext.for_data(data_dir)
    except FileNotFoundError:
        raise HTTPException(
            status_code=400,
            detail="Dataset not found — the session may have expired on the free tier. "
            "Use the demo dataset or re-upload your files.",
        )
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
