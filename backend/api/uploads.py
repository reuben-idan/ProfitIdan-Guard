"""Upload endpoint: validate a CSV against its dataset schema, store it, and
report exactly what was accepted and what needs correction."""

from __future__ import annotations

import csv
import io
import os
from datetime import date
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
    content: str  # raw CSV text


def _store() -> Store:
    return Store(os.getenv("PROFITPILOT_DB", "backend/profitpilot.db"))


def validate_csv(kind: str, content: str) -> tuple[list[dict], list[str]]:
    issues: list[str] = []
    rows = list(csv.DictReader(io.StringIO(content)))
    expected = REQUIRED_COLUMNS[kind]
    header = rows[0].keys() if rows else []
    for col in expected:
        if col not in header:
            issues.append(f"missing required column: {col}")
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
    return accepted, issues


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
    accepted, issues = validate_csv(req.kind, req.content)
    upload_dir = Path(os.getenv("PROFITPILOT_UPLOADS", "data/uploads"))
    upload_dir.mkdir(parents=True, exist_ok=True)
    # Store every upload attempt under its own id so files never collide.
    uid = _store().record_upload(req.filename, req.kind, len(accepted), issues, "")
    dest = upload_dir / f"{uid}_{TABLE_FILES[req.kind]}"
    dest.write_text(req.content, encoding="utf-8")
    return {
        "status": "accepted" if accepted and not issues else "accepted_with_issues",
        "upload_id": uid,
        "rows_accepted": len(accepted),
        "issues": issues,
        "path": str(dest),
    }
