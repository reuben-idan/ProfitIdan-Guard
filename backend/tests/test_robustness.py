"""Robustness: failures must surface as handled JSON responses (which keep
their CORS headers), never as unhandled crashes that browsers misreport as
CORS policy blocks. Uploads accept CSV, TSV, JSON, and XLSX."""

import base64
import io

import pytest
from fastapi import HTTPException, Request

from backend.api import investigations as inv_api
from backend.api import sessions as sessions_api
from backend.api import uploads as uploads_api

BANK_ROWS = [
    ["txn_id", "date", "description", "reference", "amount"],
    ["B-1", "2026-10-01", "Customer payment", "INV-1", "100.00"],
]


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("PROFITPILOT_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("PROFITPILOT_UPLOADS", str(tmp_path / "uploads"))
    return tmp_path


def test_validate_csv_survives_binary_garbage():
    accepted, issues = uploads_api.validate_csv("invoices", "a,b,c\n\x00\x01\x02\n")
    assert accepted == []
    assert any("parse" in i or "column" in i for i in issues)


def test_investigate_without_key_is_503_not_crash(env, monkeypatch):
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(inv_api.InvestigateRequest(question="Why?", demo_mode=False))
    assert exc.value.status_code == 503
    assert "Instant review" in exc.value.detail


def test_investigate_model_404_names_the_fix(env, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "test-key")
    monkeypatch.setattr(
        inv_api,
        "run_investigation",
        lambda *a, **k: (_ for _ in ()).throw(
            Exception("Error code: 404 - The requested model was not found.")
        ),
    )
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(inv_api.InvestigateRequest(question="Why?", demo_mode=False))
    assert exc.value.status_code == 502
    assert "MODEL_NAME is exactly muse-spark-1.3" in exc.value.detail


def test_metaclient_strips_quotes_and_space(monkeypatch):
    from backend.agent.orchestrator import MetaClient

    monkeypatch.setenv("MODEL_NAME", '  "muse-spark-1.3" \n')
    monkeypatch.setenv("META_API_BASE_URL", "https://api.meta.ai/v1 ")
    assert MetaClient().model == "muse-spark-1.3"
    assert MetaClient().base_url == "https://api.meta.ai/v1"


def test_investigate_missing_dataset_is_400(env):
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(
            inv_api.InvestigateRequest(question="Why?", data_dir="nope/missing", demo_mode=True)
        )
    assert exc.value.status_code == 400


def _await_no_io(coro):
    """Drive a coroutine that performs no IO without an event loop: every
    loop opens loopback sockets, which sandboxes forbid."""
    try:
        coro.send(None)
    except StopIteration as done:
        return done.value
    raise AssertionError("handler unexpectedly suspended on IO")


def test_unhandled_errors_become_json_500():
    from backend.main import unhandled_exception_handler

    req = Request({"type": "http", "method": "POST", "path": "/x", "headers": []})
    resp = _await_no_io(unhandled_exception_handler(req, RuntimeError("boom")))
    assert resp.status_code == 500
    assert "boom" in resp.body.decode()


def test_upload_tsv(env):
    content = "\n".join("\t".join(r) for r in BANK_ROWS) + "\n"
    body = uploads_api.upload(
        uploads_api.UploadRequest(filename="bank.tsv", kind="bank", content=content)
    )
    assert body["rows_accepted"] == 1, body


def test_upload_json_array(env):
    import json

    content = json.dumps([dict(zip(BANK_ROWS[0], row)) for row in BANK_ROWS[1:]])
    body = uploads_api.upload(
        uploads_api.UploadRequest(filename="bank.json", kind="bank", content=content)
    )
    assert body["rows_accepted"] == 1, body


def test_upload_xlsx_base64(env):
    import openpyxl

    wb = openpyxl.Workbook()
    ws = wb.active
    for row in BANK_ROWS:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    body = uploads_api.upload(
        uploads_api.UploadRequest(
            filename="bank.xlsx",
            kind="bank",
            content="",
            content_base64=base64.b64encode(buf.getvalue()).decode(),
        )
    )
    assert body["rows_accepted"] == 1, body


def test_upload_rejects_unsupported_extension(env):
    body = uploads_api.upload(
        uploads_api.UploadRequest(filename="bank.pdf", kind="bank", content="junk")
    )
    assert body["status"] == "rejected"
    assert any("XLSX" in i or "xlsx" in i for i in body["issues"])


def test_investigation_demo_flag_roundtrip(env):
    from backend.models.store import Store

    store = Store(env / "test.db")
    iid = store.save_investigation("Q?", {"findings": []}, [], "completed", demo_mode=True)
    assert store.get_investigation(iid)["demo_mode"] == 1


def test_demo_mode_migration_backfills_old_db(tmp_path):
    import sqlite3

    from backend.models.store import Store

    db = tmp_path / "old.db"
    with sqlite3.connect(db) as conn:
        conn.execute(
            "CREATE TABLE investigations (id TEXT PRIMARY KEY, question TEXT, result TEXT,"
            " verdicts TEXT, status TEXT, created_at TEXT)"
        )
        conn.execute("INSERT INTO investigations VALUES ('inv_old','Q?','{}','[]','completed','t')")
        conn.commit()
    store = Store(db)
    assert store.get_investigation("inv_old")["demo_mode"] == 0
    iid = store.save_investigation("Q2", {}, [], "completed", demo_mode=True)
    assert store.get_investigation(iid)["demo_mode"] == 1


def test_session_file_unknown_extension_is_400(env):
    s = sessions_api.create_session(sessions_api.CreateSessionRequest(name="t"))
    with pytest.raises(HTTPException) as exc:
        sessions_api.upload_session_file(
            s["id"],
            sessions_api.SessionFileRequest(filename="x.pdf", kind="bank", content="junk"),
        )
    assert exc.value.status_code == 400


def test_metaclient_strips_env_whitespace(monkeypatch):
    from backend.agent.orchestrator import MetaClient

    monkeypatch.setenv("MODEL_NAME", "  muse-spark-1.3\n")
    monkeypatch.setenv("MODEL_API_KEY", "  secret-key  ")
    monkeypatch.setenv("META_API_BASE_URL", "  https://api.meta.ai/v1  ")
    client = MetaClient()
    assert client.model == "muse-spark-1.3"
    assert client.api_key == "secret-key"
    assert client.base_url == "https://api.meta.ai/v1"


def test_investigate_502_names_model_and_endpoint(env, monkeypatch):
    monkeypatch.setenv("MODEL_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_NAME", "muse-spark-1.3")

    def boom(question, ctx, client):
        raise RuntimeError("Error code: 404 - The requested model was not found.")

    monkeypatch.setattr(inv_api, "run_investigation", boom)
    with pytest.raises(HTTPException) as exc:
        inv_api.investigate(inv_api.InvestigateRequest(question="Why?"))
    assert exc.value.status_code == 502
    assert "muse-spark-1.3" in exc.value.detail
    assert "test-key" not in exc.value.detail
