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
    ctx = ToolContext.for_data(data_dir)
    if demo_mode:
        result = run_heuristic_investigation(req.question, ctx)
    else:
        result = run_investigation(req.question, ctx, MetaClient())
    verdicts = [verify_finding(f, ctx.bundle) for f in result.findings]
    status = "completed" if result.completed else "incomplete"
    iid = _store().save_investigation(req.question, result.to_dict(), verdicts, status)
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
