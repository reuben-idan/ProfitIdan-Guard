"""API layer without sockets: call route functions directly (they are plain
sync functions) and check the route table for wiring. TestClient needs
loopback sockets, which sandboxes and locked-down CI runners often forbid."""

from pathlib import Path

import pytest

from backend.api import actions as actions_api
from backend.api import investigations as inv_api
from backend.api import uploads as uploads_api
from backend.main import app, health

DEMO_DIR = Path(__file__).resolve().parents[2] / "data" / "demo"


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("PROFITPILOT_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("PROFITPILOT_UPLOADS", str(tmp_path / "uploads"))
    return tmp_path


def test_health():
    assert health() == {"status": "ok"}


def test_routes_wired():
    assert any(getattr(r, "path", "") == "/health" for r in app.routes)
    assert len(app.routes) > 5  # routers included (possibly lazily)
    paths: set[tuple[str, str]] = set()
    for router in (uploads_api.router, inv_api.router, actions_api.router):
        for r in router.routes:
            for method in sorted(getattr(r, "methods", None) or []):
                paths.add((method, r.path))
    expected = [
        ("POST", "/uploads"),
        ("POST", "/investigations"),
        ("GET", "/investigations/{investigation_id}"),
        ("GET", "/actions"),
        ("POST", "/actions"),
        ("POST", "/actions/{action_id}/approve"),
        ("POST", "/actions/{action_id}/reject"),
        ("POST", "/actions/{action_id}/execute"),
        ("GET", "/actions/{action_id}/audit"),
    ]
    for method, path in expected:
        assert (method, path) in paths, (method, path)


def test_upload_valid_csv(env):
    content = (DEMO_DIR / "invoices.csv").read_text()
    body = uploads_api.upload(
        uploads_api.UploadRequest(filename="invoices.csv", kind="invoices", content=content)
    )
    assert body["status"] == "accepted"
    assert body["rows_accepted"] == 6
    assert Path(body["path"]).exists()


def test_upload_flags_bad_rows(env):
    bad = (
        "invoice_id,customer,issue_date,due_date,amount,amount_paid,status\n"
        "INV-002,Kumasi Mart,not-a-date,2026-10-15,12000.00,0.00,unpaid\n"
    )
    body = uploads_api.upload(
        uploads_api.UploadRequest(filename="bad.csv", kind="invoices", content=bad)
    )
    assert body["rows_accepted"] == 0
    assert any("bad date" in i for i in body["issues"])


def test_upload_rejects_unknown_kind(env):
    body = uploads_api.upload(
        uploads_api.UploadRequest(filename="x.csv", kind="payroll", content="a,b\n1,2\n")
    )
    assert body["status"] == "rejected"


def test_action_lifecycle(env):
    from fastapi import HTTPException

    draft = actions_api.draft(
        actions_api.DraftRequest(
            type="payment_reminder",
            target="Kumasi Mart",
            amount="12000.00",
            finding_ref="overdue receivables",
            verified_amount="27000.00",
        )
    )
    assert draft["status"] == "draft"
    assert "Kumasi Mart" in draft["draft_text"]
    aid = draft["id"]

    with pytest.raises(HTTPException) as exc:
        actions_api.draft(
            actions_api.DraftRequest(
                type="payment_reminder", target="Kumasi Mart",
                amount="99999.00", verified_amount="27000.00",
            )
        )
    assert exc.value.status_code == 400

    approved = actions_api.approve(aid, actions_api.ApproveRequest(approved_by="owner"))
    assert approved["status"] == "approved"
    assert approved["approved_by"] == "owner"

    executed = actions_api.execute(aid)
    assert executed["status"] == "executed_simulated"
    assert "simulated" in executed["simulation_note"]

    trail = actions_api.audit_trail(aid)["trail"]
    assert [t["event"] for t in trail] == [
        "action_drafted", "action_approved", "action_executed_simulated",
    ]


def test_reject_and_double_approve_conflict(env):
    from fastapi import HTTPException

    draft = actions_api.draft(
        actions_api.DraftRequest(
            type="supplier_review", target="PZ Cussons Ghana",
            amount="14000.00", verified_amount="22000.00",
        )
    )
    rejected = actions_api.reject(draft["id"], actions_api.ApproveRequest(approved_by="owner"))
    assert rejected["status"] == "rejected"
    with pytest.raises(HTTPException) as exc:
        actions_api.approve(draft["id"], actions_api.ApproveRequest(approved_by="owner"))
    assert exc.value.status_code == 409


def test_investigation_requires_api_key(env, monkeypatch):
    from fastapi import HTTPException

    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(inv_api.InvestigateRequest(question="Why no cash?"))
    assert exc.value.status_code == 503
