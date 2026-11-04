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
