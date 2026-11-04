"""API layer without sockets: call route functions directly (they are plain
sync functions) and check the route table for wiring. TestClient needs
loopback sockets, which sandboxes and locked-down CI runners often forbid."""

from pathlib import Path

import pytest

from backend.api import actions as actions_api
from backend.api import investigations as inv_api
from backend.api import sessions as sessions_api
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
    for router in (uploads_api.router, inv_api.router, actions_api.router, sessions_api.router):
        for r in router.routes:
            for method in sorted(getattr(r, "methods", None) or []):
                paths.add((method, r.path))
    expected = [
        ("POST", "/uploads"),
        ("GET", "/uploads/templates/{kind}"),
        ("POST", "/investigations"),
        ("GET", "/investigations"),
        ("GET", "/investigations/{investigation_id}"),
        ("GET", "/actions"),
        ("POST", "/actions"),
        ("POST", "/actions/{action_id}/approve"),
        ("POST", "/actions/{action_id}/reject"),
        ("POST", "/actions/{action_id}/execute"),
        ("GET", "/actions/{action_id}/audit"),
        ("POST", "/sessions"),
        ("POST", "/sessions/{session_id}/files"),
        ("POST", "/sessions/{session_id}/meta"),
        ("GET", "/sessions/{session_id}"),
        ("GET", "/sessions/{session_id}/snapshot"),
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


def test_get_investigation_returns_parsed_result(env):
    from backend.models.store import Store

    store = Store(env / "test.db")
    iid = store.save_investigation(
        "Why no cash?",
        {"findings": [{"title": "t"}], "steps": []},
        [{"title": "t", "status": "verified"}],
        "completed",
    )
    body = inv_api.get_investigation(iid)
    assert body["result"]["findings"] == [{"title": "t"}]
    assert body["verdicts"][0]["status"] == "verified"


def test_cors_allows_dev_frontend():
    from fastapi.middleware.cors import CORSMiddleware

    assert any(isinstance(m.cls, type) and issubclass(m.cls, CORSMiddleware) for m in app.user_middleware)


def test_cors_origins_from_env(monkeypatch):
    from backend.main import cors_origins

    monkeypatch.setenv("CORS_ORIGINS", "https://profit-idan-guard.vercel.app, http://localhost:3000")
    assert cors_origins() == ["https://profit-idan-guard.vercel.app", "http://localhost:3000"]
    monkeypatch.delenv("CORS_ORIGINS")
    assert cors_origins() == ["http://localhost:3000"]


def test_cors_origin_regex_covers_vercel(monkeypatch):
    import re

    from backend.main import cors_origin_regex

    monkeypatch.delenv("CORS_ORIGIN_REGEX", raising=False)
    pattern = cors_origin_regex()
    assert pattern is not None
    assert re.match(pattern, "https://frontend-five-ebon-61.vercel.app")
    assert not re.match(pattern, "https://evil.example.com")
    monkeypatch.setenv("CORS_ORIGIN_REGEX", "")
    assert cors_origin_regex() is None


def test_investigation_demo_mode_without_key(env, monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    body = inv_api.investigate(
        inv_api.InvestigateRequest(question="Why no cash?", data_dir=str(DEMO_DIR))
    )
    assert body["demo_mode"] is True
    assert body["status"] == "completed"
    assert len(body["result"]["findings"]) >= 3
    assert all(v["status"] == "verified" for v in body["verdicts"])


def test_list_investigations_and_templates(env, monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    inv_api.investigate(
        inv_api.InvestigateRequest(question="Why no cash?", data_dir=str(DEMO_DIR))
    )
    listed = inv_api.list_investigations()
    assert len(listed["investigations"]) == 1
    assert listed["investigations"][0]["question"] == "Why no cash?"
    template = uploads_api.template("invoices")
    assert template["filename"] == "invoices.csv"
    assert "invoice_id" in template["content"].splitlines()[0]


def test_draft_returns_whatsapp_text(env):
    draft = actions_api.draft(
        actions_api.DraftRequest(
            type="payment_reminder", target="Kumasi Mart",
            amount="12000.00", verified_amount="27000.00",
        )
    )
    assert "Kumasi Mart" in draft["whatsapp_text"]
    assert "12000.00" in draft["whatsapp_text"]
