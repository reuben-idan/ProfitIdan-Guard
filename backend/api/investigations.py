"""Investigation endpoint: run the Meta-directed investigation, then verify
every finding through TradeGuard before returning."""

from __future__ import annotations

import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..agent.orchestrator import MetaClient, run_investigation
from ..agent.tools import ToolContext
from ..models.store import Store
from ..verification.verifier import verify_finding

router = APIRouter(prefix="/investigations", tags=["investigations"])


class InvestigateRequest(BaseModel):
    question: str
    data_dir: str | None = None


def _store() -> Store:
    return Store(os.getenv("PROFITPILOT_DB", "backend/profitpilot.db"))


@router.post("")
def investigate(req: InvestigateRequest) -> dict:
    if not os.getenv("MODEL_API_KEY"):
        raise HTTPException(
            status_code=503,
            detail="MODEL_API_KEY is not set; see README for Meta API setup.",
        )
    data_dir = req.data_dir or os.getenv("PROFITPILOT_DATA", "data/demo")
    ctx = ToolContext.for_data(data_dir)
    result = run_investigation(req.question, ctx, MetaClient())
    verdicts = [verify_finding(f, ctx.bundle) for f in result.findings]
    status = "completed" if result.completed else "incomplete"
    iid = _store().save_investigation(req.question, result.to_dict(), verdicts, status)
    return {"id": iid, "status": status, "result": result.to_dict(), "verdicts": verdicts}


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
