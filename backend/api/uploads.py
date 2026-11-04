"""Upload endpoint: validate a CSV against its dataset schema, store it, and
report exactly what was accepted and what needs correction."""

from __future__ import annotations

import base64
import binascii
import csv
import io
import json
import os
from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from ..finance.datasets import TABLE_FILES
from ..models.store import Store

router = APIRouter(prefix="/uploads", tags=["uploads"])

REQUIRED_COLUMNS = {
    "invoices": ["invoice_id", "customer", "issue_date", "due_date", "amount", "amount_paid", "status"],
    "supplier_bills": ["bill_id", "supplier", "issue_date", "due_date", "amount", "amount_paid", "status"],
    "bank": ["txn_id", "date", "description", "reference", "amount"],
    "sales": ["sale_id", "date", "product_id", "product", "qty", "unit_price"],
    "inventory": ["product_id", "product", "unit_cost", "prev_unit_cost", "qty_on_hand", "last_restock_date"],
}

DATE_COLUMNS = {"issue_date", "due_date", "date", "last_restock_date"}
MONEY_COLUMNS = {"amount", "amount_paid", "unit_price", "unit_cost", "prev_unit_cost"}


class UploadRequest(BaseModel):
    filename: str
    kind: str
    content: str = ""  # raw text for CSV/TSV/JSON
    content_base64: str | None = None  # raw bytes for XLSX


class UploadFormatError(ValueError):
    """The file could not be parsed; callers report it, never crash on it."""


SUPPORTED_SUFFIXES = (".csv", ".tsv", ".tab", ".json", ".xlsx")
FORMAT_HINT = "supported types: CSV, TSV, JSON, or XLSX"


def _store() -> Store:
    return Store(os.getenv("PROFITPILOT_DB", "backend/profitpilot.db"))


def _excel_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _canon_headers(kind: str | None, rows: list[dict]) -> list[dict]:
    """Map headers to schema names, forgiving Excel casing and spacing."""
    if kind not in REQUIRED_COLUMNS:
        return rows
    want = {c.lower(): c for c in REQUIRED_COLUMNS[kind]}
    return [
        {want.get((k or "").strip().lower(), (k or "").strip()): v for k, v in row.items()}
        for row in rows
    ]


def parse_upload(
    filename: str, content: str, content_base64: str | None, kind: str | None = None
) -> list[dict]:
    """Parse an upload by file extension into row dicts.

    Raises UploadFormatError with a user-facing message on anything
    unreadable; never raises csv/JSON/Excel internals to callers.
    """
    content = (content or "").lstrip("\ufeff")
    suffix = Path(filename or "").suffix.lower()
    if suffix == ".json":
        if not (content or "").strip():
            raise UploadFormatError("empty file")
        try:
            data = json.loads(content)
        except json.JSONDecodeError as exc:
            raise UploadFormatError(f"invalid JSON: {exc}")
        if isinstance(data, dict) and isinstance(data.get("rows"), list):
            data = data["rows"]
        if not isinstance(data, list) or not all(isinstance(r, dict) for r in data):
            raise UploadFormatError('JSON must be an array of objects (or {"rows": [...]})')
        return _canon_headers(
            kind, [{k: ("" if v is None else str(v)) for k, v in row.items()} for row in data]
        )
    if suffix == ".xlsx":
        if not content_base64:
            raise UploadFormatError("Excel upload arrived without file bytes")
        try:
            raw = base64.b64decode(content_base64)
        except (binascii.Error, ValueError):
            raise UploadFormatError("Excel upload is not valid base64")
        try:
            from openpyxl import load_workbook

            sheet = load_workbook(io.BytesIO(raw), read_only=True, data_only=True).active
            grid = list(sheet.iter_rows(values_only=True))
        except Exception as exc:
            raise UploadFormatError(f"could not read Excel workbook: {exc}")
        if not grid or not any(c is not None and str(c).strip() for c in grid[0]):
            raise UploadFormatError("Excel sheet is empty or has no header row")
        header = [str(c or "").strip() for c in grid[0]]
        rows: list[dict] = []
        for values in grid[1:]:
            if all(v is None or str(v).strip() == "" for v in values):
                continue
            rows.append({h: _excel_value(v) for h, v in zip(header, values)})
        return _canon_headers(kind, rows)
    if suffix in (".csv", ".tsv", ".tab"):
        if not (content or "").strip():
            raise UploadFormatError("empty file")
        try:
            parsed = list(csv.DictReader(io.StringIO(content), delimiter="," if suffix == ".csv" else "\t"))
        except (csv.Error, UnicodeDecodeError) as exc:
            raise UploadFormatError(f"could not parse {suffix} file: {exc}")
        return _canon_headers(
            kind, [{k: (v or "") for k, v in row.items() if k is not None} for row in parsed]
        )
    raise UploadFormatError(f"unsupported file type {suffix or '(none)'} — {FORMAT_HINT}")


def to_canonical_csv(kind: str, rows: list[dict]) -> str:
    """Normalize any accepted upload to the schema CSV the finance tools read."""
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=REQUIRED_COLUMNS[kind], extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow({col: row.get(col, "") for col in REQUIRED_COLUMNS[kind]})
    return buf.getvalue()


def validate_rows(kind: str, rows: list[dict]) -> tuple[list[dict], list[str]]:
    issues: list[str] = []
    expected = REQUIRED_COLUMNS[kind]
    header = list(rows[0].keys()) if rows else []
    missing = [col for col in expected if col not in header]
    if missing:
        found = ", ".join(header) if header else "(no header row)"
        issues.append(f"missing required column(s): {', '.join(missing)} — found: {found}")
    seen: set[str] = set()
    id_col = expected[0]
    accepted: list[dict] = []
    for n, row in enumerate(rows, start=2):
        row_id = (row.get(id_col) or "").strip()
        if not row_id:
            issues.append(f"row {n}: missing {id_col}")
            continue
        if row_id in seen:
            issues.append(f"row {n}: duplicate {id_col} {row_id}")
            continue
        seen.add(row_id)
        skip = False
        for col in DATE_COLUMNS & row.keys():
            try:
                if (row[col] or "").strip():
                    date.fromisoformat(row[col].strip())
            except ValueError:
                issues.append(f"row {n}: bad date {col}={row[col]!r}")
                skip = True
        for col in MONEY_COLUMNS & row.keys():
            try:
                if (row[col] or "").strip():
                    float(row[col])
            except ValueError:
                issues.append(f"row {n}: bad money {col}={row[col]!r}")
                skip = True
        for col in expected:
            if col in row and (row[col] or "").strip() == "" and col != "reference":
                issues.append(f"row {n}: missing value {col}")
        if not skip:
            accepted.append(row)
    if len(issues) > 100:
        issues = issues[:100] + [f"...and {len(issues) - 100} more issues (showing first 100)"]
    return accepted, issues


def validate_csv(kind: str, content: str) -> tuple[list[dict], list[str]]:
    """Validate CSV text; unparseable input becomes issues, never raises."""
    try:
        rows = parse_upload("upload.csv", content, None, kind)
    except UploadFormatError as exc:
        return [], [str(exc)]
    return validate_rows(kind, rows)


TEMPLATE_ROWS = {
    "invoices": "INV-001,Example Customer,2026-10-01,2026-10-31,5000.00,0.00,unpaid",
    "supplier_bills": "BILL-001,Example Supplier,2026-10-01,2026-10-31,3000.00,0.00,unpaid",
    "bank": "BANK-001,2026-10-15,Customer payment,INV-001,5000.00",
    "sales": "S-001,2026-10-03,PROD-01,Example Product,10,50.00",
    "inventory": "PROD-01,Example Product,30.00,28.00,100,2026-10-01",
}


@router.get("/templates/{kind}")
def template(kind: str) -> dict:
    if kind not in REQUIRED_COLUMNS:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=f"unknown kind: {kind}")
    header = ",".join(REQUIRED_COLUMNS[kind])
    return {"kind": kind, "filename": TABLE_FILES[kind], "content": f"{header}\n{TEMPLATE_ROWS[kind]}\n"}


@router.post("")
def upload(req: UploadRequest) -> dict:
    if req.kind not in REQUIRED_COLUMNS:
        return {"status": "rejected", "issues": [f"unknown kind: {req.kind}"]}
    try:
        rows = parse_upload(req.filename, req.content, req.content_base64, req.kind)
    except UploadFormatError as exc:
        return {"status": "rejected", "issues": [str(exc)]}
    accepted, issues = validate_rows(req.kind, rows)
    upload_dir = Path(os.getenv("PROFITPILOT_UPLOADS", "data/uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    # Store every upload attempt under its own id so files never collide.
    uid = _store().record_upload(req.filename, req.kind, len(accepted), issues, "")
    dest = upload_dir / f"{uid}_{TABLE_FILES[req.kind]}"
    dest.write_text(to_canonical_csv(req.kind, rows), encoding="utf-8")
    return {
        "status": "accepted" if accepted and not issues else "accepted_with_issues",
        "upload_id": uid,
        "rows_accepted": len(accepted),
        "issues": issues,
        "path": str(dest),
    }
