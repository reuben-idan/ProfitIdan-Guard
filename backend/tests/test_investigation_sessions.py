"""Session-backed investigations: the frontend sends session_id (never a
server path) so uploads and investigations resolve to the same dataset."""

from pathlib import Path

import pytest
from fastapi import HTTPException

from backend.api import investigations as inv_api
from backend.api import sessions as sessions_api

DEMO_DIR = Path(__file__).resolve().parents[2] / "data" / "demo"

META = {
    "business_name": "Test Foods Ltd",
    "currency": "GHS",
    "as_of": "2026-10-27",
    "opening_cash": "20000.00",
    "opening_cash_date": "2026-10-01",
}


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("PROFITPILOT_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("PROFITPILOT_UPLOADS", str(tmp_path / "uploads"))
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    return tmp_path


def _fill_session(sid: str, kinds=("invoices", "supplier_bills", "bank", "sales", "inventory")) -> None:
    from backend.finance.datasets import TABLE_FILES

    for kind in kinds:
        content = (DEMO_DIR / TABLE_FILES[kind]).read_text()
        body = sessions_api.upload_session_file(
            sid,
            sessions_api.SessionFileRequest(filename=TABLE_FILES[kind], kind=kind, content=content),
        )
        assert body["rows_accepted"] > 0
    sessions_api.set_session_meta(sid, sessions_api.SessionMetaRequest(**META))


def test_investigate_by_session_id(env):
    sid = sessions_api.create_session(sessions_api.CreateSessionRequest(name="t"))["id"]
    _fill_session(sid)
    body = inv_api.investigate(inv_api.InvestigateRequest(question="Why no cash?", session_id=sid))
    assert body["status"] == "completed"
    assert len(body["result"]["findings"]) >= 3
    assert all(v["status"] == "verified" for v in body["verdicts"])


def test_investigate_incomplete_session_names_missing(env):
    sid = sessions_api.create_session(sessions_api.CreateSessionRequest(name="t"))["id"]
    _fill_session(sid, kinds=("invoices",))
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(inv_api.InvestigateRequest(question="Why no cash?", session_id=sid))
    assert exc.value.status_code == 400
    assert "bank" in exc.value.detail
    assert "business details" in exc.value.detail


def test_investigate_unknown_session_suggests_reupload(env):
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(inv_api.InvestigateRequest(question="Why no cash?", session_id="s_deadbeef"))
    assert exc.value.status_code == 400
    assert "expired" in exc.value.detail


def test_investigate_rejects_traversal_session_id(env):
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(inv_api.InvestigateRequest(question="q", session_id="../x"))
    assert exc.value.status_code == 400
