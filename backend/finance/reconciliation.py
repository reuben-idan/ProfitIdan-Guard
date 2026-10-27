"""Bank reconciliation: match bank movements to invoices/bills and prove the
closing cash balance from the opening balance plus movements."""

from __future__ import annotations

from decimal import Decimal

from .datasets import DataBundle, money, parse_date, parse_decimal


def reconcile_bank_transactions(bundle: DataBundle) -> dict:
    meta = bundle.meta
    opening = parse_decimal(meta["opening_cash"])
    as_of = parse_date(meta["as_of"])
    invoices = bundle.by_id("invoices")
    bills = bundle.by_id("supplier_bills")

    movements = Decimal(0)
    matches: list[dict] = []
    unmatched: list[str] = []
    discrepancies: list[dict] = []
    evidence_ids: list[str] = []

    for txn in bundle.table("bank"):
        txn_id = txn["txn_id"]
        txn_date = parse_date(txn["date"])
        if txn_date > as_of:
            continue  # future-dated movement: excluded, reported below
        amount = parse_decimal(txn["amount"])
        movements += amount
        evidence_ids.append(txn_id)
        ref = (txn.get("reference") or "").strip()
        if not ref:
            unmatched.append(txn_id)
            continue
        doc = invoices.get(ref) or bills.get(ref)
        if doc is None:
            discrepancies.append({"txn_id": txn_id, "reason": f"reference {ref} not found"})
            continue
        doc_total = parse_decimal(doc["amount"])
        doc_paid = parse_decimal(doc["amount_paid"])
        settled_in_full = abs(amount) == doc_total
        matches_recorded_payment = abs(amount) == doc_paid
        matches.append(
            {
                "txn_id": txn_id,
                "reference": ref,
                "doc_status": doc["status"],
                "settled_in_full": settled_in_full,
                "matches_recorded_payment": matches_recorded_payment,
            }
        )
        evidence_ids.append(ref)
        if not (settled_in_full or matches_recorded_payment):
            discrepancies.append(
                {
                    "txn_id": txn_id,
                    "reason": f"bank amount {money(amount)} matches neither "
                    f"document total {money(doc_total)} nor recorded payment {money(doc_paid)}",
                }
            )

    closing = opening + movements
    return {
        "tool": "reconcile_bank_transactions",
        "status": "success",
        "result": {
            "opening_cash": money(opening),
            "opening_date": meta["opening_cash_date"],
            "as_of": meta["as_of"],
            "movements_total": money(movements),
            "closing_cash": money(closing),
            "matches": matches,
            "unmatched": unmatched,
            "discrepancies": discrepancies,
        },
        "evidence_ids": evidence_ids,
        "assumptions": [
            "Only bank movements dated on or before as_of are included",
            f"Opening cash of {money(opening)} {meta['currency']} is taken from meta.json",
        ],
    }
