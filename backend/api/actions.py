"""Action gateway: draft a consequential action, require explicit owner
approval, record the decision. External delivery is a clearly-labeled demo
simulation until a real messaging integration exists."""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..models.store import Store
from ..verification.verifier import guard_action

router = APIRouter(prefix="/actions", tags=["actions"])

DRAFT_TEMPLATES = {
    "payment_reminder": (
        "Dear {target}, our records show GH₵{amount} outstanding. "
        "Please confirm payment this week so we can keep your supply running."
    ),
    "supplier_review": (
        "Internal review: GH₵{amount} payable to {target} falls due in the "
        "forecast window. Confirm cash coverage or negotiate extended terms."
    ),
    "purchase_hold": (
        "Internal hold: pause new purchase orders for {target} "
        "(GH₵{amount} tied up) until existing stock clears."
    ),
}


WHATSAPP_TEMPLATES = {
    "payment_reminder": (
        "Hello {target}, this is a friendly reminder that {symbol}{amount} "
        "is outstanding (ref: {finding_ref}). Please confirm payment this week."
    ),
    "supplier_review": (
        "Review due: {symbol}{amount} payable to {target} in the forecast window. "
        "Confirm coverage or renegotiate terms."
    ),
    "purchase_hold": (
        "Hold new orders for {target} ({symbol}{amount} tied up) until stock clears."
    ),
}


class DraftRequest(BaseModel):
    type: str
    target: str
    amount: str
    finding_ref: str = ""
    verified_amount: str
    currency: str = "GHS"


class ApproveRequest(BaseModel):
    approved_by: str


def _store() -> Store:
    return Store(os.getenv("PROFITPILOT_DB", "backend/profitpilot.db"))


@router.post("")
def draft(req: DraftRequest) -> dict:
    if req.type not in DRAFT_TEMPLATES:
        raise HTTPException(status_code=400, detail=f"unknown action type: {req.type}")
    gate = guard_action(req.amount, req.verified_amount, approved=False, currency=req.currency)
    if "exceeds verified" in gate["reason"]:
        raise HTTPException(status_code=400, detail=gate["reason"])
    text = DRAFT_TEMPLATES[req.type].format(target=req.target, amount=req.amount)
    symbol = "GH₵" if req.currency.upper() == "GHS" else f"{req.currency.upper()} "
    whatsapp = WHATSAPP_TEMPLATES[req.type].format(
        target=req.target, amount=req.amount, symbol=symbol,
        finding_ref=req.finding_ref or req.type,
    )
    aid = _store().draft_action(req.type, req.target, req.amount, text, req.finding_ref)
    return {"id": aid, "status": "draft", "draft_text": text, "whatsapp_text": whatsapp, "gate": gate}


@router.post("/{action_id}/approve")
def approve(action_id: str, req: ApproveRequest) -> dict:
    action = _store().get_action(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="action not found")
    if action["status"] != "draft":
        raise HTTPException(status_code=409, detail=f"action is already {action['status']}")
    return _store().set_action(action_id, "approved", req.approved_by)


@router.post("/{action_id}/reject")
def reject(action_id: str, req: ApproveRequest) -> dict:
    action = _store().get_action(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="action not found")
    if action["status"] != "draft":
        raise HTTPException(status_code=409, detail=f"action is already {action['status']}")
    return _store().set_action(action_id, "rejected", req.approved_by)


@router.post("/{action_id}/execute")
def execute(action_id: str) -> dict:
    """Demo-only simulated execution. Real delivery integrations come later."""
    action = _store().get_action(action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="action not found")
    if action["status"] != "approved":
        raise HTTPException(status_code=409, detail="only approved actions can execute")
    record = _store().set_action(action_id, "executed_simulated")
    record["simulation_note"] = "No external message was sent; delivery is simulated for the demo."
    return record


@router.get("")
def list_actions() -> dict:
    return {"actions": _store().list_actions()}


@router.get("/{action_id}/audit")
def audit_trail(action_id: str) -> dict:
    return {"action_id": action_id, "trail": _store().audit_trail(action_id)}
