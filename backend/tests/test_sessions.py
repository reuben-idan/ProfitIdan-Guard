"""Sessions: assemble uploads into an investigable dataset directory."""

import json
from pathlib import Path

import pytest

from backend.agent.tools import ToolContext, run_tool
from backend.api import sessions as sessions_api
from backend.finance.datasets import TABLE_FILES

DEMO_DIR = Path(__file__).resolve().parents[2] / "data" / "demo"


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("PROFITPILOT_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("PROFITPILOT_UPLOADS", str(tmp_path / "uploads"))
    return tmp_path


def _assemble_all(session_id: str) -> None:
    for kind, filename in TABLE_FILES.items():
        content = (DEMO_DIR / filename).read_text()
        body = sessions_api.upload_session_file(
            session_id,
            sessions_api.SessionFileRequest(filename=filename, kind=kind, content=content),
        )
        assert body["rows_accepted"] > 0, (kind, body)
    meta = json.loads((DEMO_DIR / "meta.json").read_text())
    sessions_api.set_session_meta(session_id, sessions_api.SessionMetaRequest(**meta))


def test_full_session_is_investigable(env):
    created = sessions_api.create_session(sessions_api.CreateSessionRequest(name="demo"))
    _assemble_all(created["id"])
    status = sessions_api.session_status(created["id"])
    assert status["ready_for_investigation"] is True
    assert status["meta_present"] is True

    # A session directory is a drop-in dataset: same forecast as data/demo.
    ctx = ToolContext.for_data(status["path"])
    out = run_tool(ctx, "forecast_cash_position", {})
    assert out["result"]["scenarios"]["receivables_slip"] == "-14000.00"


def test_incomplete_session_is_not_ready(env):
    created = sessions_api.create_session(sessions_api.CreateSessionRequest(name="partial"))
    content = (DEMO_DIR / "invoices.csv").read_text()
    sessions_api.upload_session_file(
        created["id"],
        sessions_api.SessionFileRequest(filename="invoices.csv", kind="invoices", content=content),
    )
    status = sessions_api.session_status(created["id"])
    assert status["ready_for_investigation"] is False
    assert status["files"]["bank"] == {"present": False}


def test_bad_meta_and_unknown_session_rejected(env):
    from fastapi import HTTPException

    created = sessions_api.create_session(sessions_api.CreateSessionRequest(name="bad"))
    with pytest.raises(HTTPException) as exc:
        sessions_api.set_session_meta(
            created["id"],
            sessions_api.SessionMetaRequest(
                business_name="x", currency="GHS", as_of="not-a-date",
                opening_cash="0.00", opening_cash_date="2026-10-01",
            ),
        )
    assert exc.value.status_code == 400
    with pytest.raises(HTTPException) as exc:
        sessions_api.upload_session_file(
            created["id"],
            sessions_api.SessionFileRequest(filename="x.csv", kind="payroll", content="a\n1\n"),
        )
    assert exc.value.status_code == 400
    with pytest.raises(HTTPException) as exc:
        sessions_api.session_status("s_missing")
    assert exc.value.status_code == 404


def test_cli_requires_api_key(env, monkeypatch, capsys, tmp_path):
    import backend.investigate as cli

    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(cli, "load_dotenv", lambda *a, **k: False)  # never touch real .env
    assert cli.main(["--data", str(DEMO_DIR), "Why no cash?"]) == 2
    assert "MODEL_API_KEY" in capsys.readouterr().err


def test_format_summary():
    from backend.agent.orchestrator import InvestigationResult
    from backend.investigate import format_summary

    result = InvestigationResult(
        question="q",
        steps=[{"tool": "forecast_cash_position"}],
        findings=[{"title": "Cash gap", "claim": "slip leaves -14000.00"}],
        recommended_actions=[
            {"type": "payment_reminder", "target": "Kumasi Mart",
             "amount": "12000.00", "reason": "overdue"},
            "Chase Tema Provisions by phone",  # models sometimes emit bare strings
        ],
        completed=True,
    )
    text = format_summary(result, [{"status": "verified", "checks": []}])
    assert "[VERIFIED] Cash gap" in text
    assert "payment_reminder: Kumasi Mart 12000.00" in text
    assert "Chase Tema Provisions by phone" in text
