"""Receivables, payables, and the short-horizon cash forecast with explicit
scenarios instead of a single invented number."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from .datasets import DataBundle, money, parse_date, parse_decimal


def _balance(row: dict) -> Decimal:
    return parse_decimal(row["amount"]) - parse_decimal(row["amount_paid"])


def identify_unpaid_invoices(bundle: DataBundle, horizon_days: int = 14) -> dict:
    as_of = parse_date(bundle.meta["as_of"])
    horizon_end = as_of + timedelta(days=horizon_days)

    overdue: list[dict] = []
    overdue_total = Decimal(0)
    due_soon: list[dict] = []
    due_soon_total = Decimal(0)
    outstanding = Decimal(0)
    evidence_ids: list[str] = []

    for row in bundle.table("invoices"):
        balance = _balance(row)
        if balance <= 0:
            continue
        outstanding += balance
        due = parse_date(row["due_date"])
        evidence_ids.append(row["invoice_id"])
        if due <= as_of:
            days = (as_of - due).days
            overdue.append(
                {
                    "invoice_id": row["invoice_id"],
                    "customer": row["customer"],
                    "due_date": row["due_date"],
                    "days_overdue": days,
                    "balance": money(balance),
                }
            )
            overdue_total += balance
        elif due <= horizon_end:
            due_soon.append({"invoice_id": row["invoice_id"], "balance": money(balance)})
            due_soon_total += balance

    return {
        "tool": "identify_unpaid_invoices",
        "status": "success",
        "result": {
            "as_of": bundle.meta["as_of"],
            "overdue": sorted(overdue, key=lambda r: r["days_overdue"], reverse=True),
            "overdue_total": money(overdue_total),
            "due_within_14d": due_soon,
            "due_within_14d_total": money(due_soon_total),
            "total_outstanding": money(outstanding),
        },
        "evidence_ids": evidence_ids,
        "assumptions": ["Partial payments reduce the balance; fully paid invoices are excluded"],
    }


def upcoming_payables(bundle: DataBundle, horizon_days: int = 14) -> dict:
    as_of = parse_date(bundle.meta["as_of"])
    horizon_end = as_of + timedelta(days=horizon_days)

    due: list[dict] = []
    due_total = Decimal(0)
    overdue_total = Decimal(0)
    evidence_ids: list[str] = []

    for row in bundle.table("supplier_bills"):
        balance = _balance(row)
        if balance <= 0:
            continue
        due_date = parse_date(row["due_date"])
        evidence_ids.append(row["bill_id"])
        if due_date <= as_of:
            overdue_total += balance
        if due_date <= horizon_end:
            due.append({"bill_id": row["bill_id"], "supplier": row["supplier"], "balance": money(balance)})
            due_total += balance

    return {
        "tool": "upcoming_payables",
        "status": "success",
        "result": {
            "as_of": bundle.meta["as_of"],
            "horizon_days": horizon_days,
            "bills_due": due,
            "total_due": money(due_total),
            "overdue_total": money(overdue_total),
        },
        "evidence_ids": evidence_ids,
        "assumptions": ["Only unpaid balances due on or before the horizon are included"],
    }


def forecast_cash_position(bundle: DataBundle, horizon_days: int = 14) -> dict:
    as_of = parse_date(bundle.meta["as_of"])
    cash = parse_decimal(bundle.meta["opening_cash"])
    for txn in bundle.table("bank"):
        if parse_date(txn["date"]) <= as_of:
            cash += parse_decimal(txn["amount"])

    receivables = identify_unpaid_invoices(bundle, horizon_days)["result"]
    payables = upcoming_payables(bundle, horizon_days)["result"]
    inflow = parse_decimal(receivables["due_within_14d_total"])
    outflow = parse_decimal(payables["total_due"])

    return {
        "tool": "forecast_cash_position",
        "status": "success",
        "result": {
            "as_of": bundle.meta["as_of"],
            "horizon_days": horizon_days,
            "opening_cash": money(cash),
            "receivables_due": money(inflow),
            "payables_due": money(outflow),
            "overdue_receivables": receivables["overdue_total"],
            "scenarios": {
                "on_time_collections": money(cash + inflow - outflow),
                "receivables_slip": money(cash - outflow),
            },
        },
        "evidence_ids": (
            [t["txn_id"] for t in bundle.table("bank")]
            + [r["invoice_id"] for r in receivables["due_within_14d"]]
            + [b["bill_id"] for b in payables["bills_due"]]
        ),
        "assumptions": [
            "On-time scenario collects all in-window receivables and pays all in-window payables",
            "Slip scenario collects nothing further; overdue balances are excluded from both",
            "No other cash movements (payroll, rent, new sales) are included",
        ],
    }
