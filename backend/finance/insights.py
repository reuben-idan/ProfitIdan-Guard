"""Decision-grade intelligence: KPIs, ranked collections, customer exposure.

These tools answer "what matters most and in what order" — the layer above
raw finance figures. All money stays in Decimal until the envelope boundary.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from . import cashflow, inventory, profitability, reconciliation
from .datasets import DataBundle, money, parse_decimal, pct


def _months(as_of: str) -> tuple[str, str]:
    year, month, _ = (int(p) for p in as_of.split("-"))
    first = date(year, month, 1)
    prev_month = first.month - 1 or 12
    prev_year = first.year - (1 if first.month == 1 else 0)
    return f"{year:04d}-{month:02d}", f"{prev_year:04d}-{prev_month:02d}"


def business_snapshot(bundle: DataBundle, horizon_days: int = 14) -> dict:
    """One-screen KPIs: cash, leaks ranked by size, collection health."""
    month, prev_month = _months(bundle.meta["as_of"])
    recon = reconciliation.reconcile_bank_transactions(bundle)["result"]
    recv = cashflow.identify_unpaid_invoices(bundle, horizon_days)["result"]
    pay = cashflow.upcoming_payables(bundle, horizon_days)["result"]
    forecast = cashflow.forecast_cash_position(bundle, horizon_days)["result"]
    stock = inventory.analyze_inventory_aging(bundle)["result"]

    try:
        rev = profitability.summarize_revenue(bundle, month, prev_month)["result"]
    except ZeroDivisionError:
        rev = {"month": month, "revenue": "0.00", "growth_pct": None}
    try:
        margins = profitability.calculate_product_margins(bundle, month)["result"]
    except ValueError:
        margins = {"totals": {"blended_margin_pct": None}, "products": [], "alerts": []}

    dead_value = Decimal(0)
    slow_value = Decimal(0)
    for product in stock["products"]:
        value = parse_decimal(product["stock_value"])
        if product["status"] == "dead_stock":
            dead_value += value
        elif product["status"] == "slow_moving":
            slow_value += value

    inflows = Decimal(0)
    for txn in bundle.table("bank"):
        if txn["date"].startswith(month):
            amount = parse_decimal(txn["amount"])
            if amount > 0:
                inflows += amount
    revenue = parse_decimal(rev.get("revenue") or "0.00")
    collection_rate = str(pct(inflows, revenue)) if revenue > 0 else None

    worst = None
    for product in margins.get("products", []):
        if worst is None or Decimal(product["margin_pct"]) < Decimal(worst["margin_pct"]):
            worst = product

    leaks = [
        {"label": "Overdue receivables", "amount": recv["overdue_total"]},
        {"label": "Dead stock", "amount": money(dead_value)},
        {"label": "Slow-moving stock", "amount": money(slow_value)},
    ]
    leaks.sort(key=lambda leak: parse_decimal(leak["amount"]), reverse=True)

    return {
        "tool": "business_snapshot",
        "status": "success",
        "result": {
            "as_of": bundle.meta["as_of"],
            "month": month,
            "currency": bundle.meta["currency"],
            "cash_on_hand": recon["closing_cash"],
            "revenue_month": rev.get("revenue"),
            "revenue_growth_pct": rev.get("growth_pct"),
            "collection_rate_pct": collection_rate,
            "collected_in_month": money(inflows),
            "overdue_total": recv["overdue_total"],
            "due_soon_total": recv.get("due_within_horizon_total", recv["due_within_14d_total"]),
            "payables_due": pay["total_due"],
            "forecast_on_time": forecast["scenarios"]["on_time_collections"],
            "forecast_slip": forecast["scenarios"]["receivables_slip"],
            "total_stock_value": stock["total_stock_value"],
            "dead_stock_value": money(dead_value),
            "slow_stock_value": money(slow_value),
            "blended_margin_pct": margins["totals"].get("blended_margin_pct"),
            "worst_margin_product": worst["product_id"] if worst else None,
            "worst_margin_pct": worst["margin_pct"] if worst else None,
            "leaks_ranked": leaks,
        },
        "evidence_ids": ["BANK-001"][:0]
        + [t["txn_id"] for t in bundle.table("bank")]
        + [r["invoice_id"] for r in recv["overdue"]],
        "assumptions": [
            "Collection rate is bank inflows in the as-of month over gross sales that month",
            "Leaks rank overdue receivables, dead stock, and slow-moving stock by amount",
        ],
    }


def prioritize_collections(bundle: DataBundle, horizon_days: int = 14, limit: int = 5) -> dict:
    """Ranked collection queue: biggest cash impact first, urgency-weighted."""
    recv = cashflow.identify_unpaid_invoices(bundle, horizon_days)["result"]
    queue: list[dict] = []
    for row in recv["overdue"]:
        balance = parse_decimal(row["balance"])
        weight = Decimal(1) + Decimal(row["days_overdue"]) / Decimal(30)
        queue.append(
            {
                "invoice_id": row["invoice_id"],
                "customer": row["customer"],
                "due_date": row["due_date"],
                "days_overdue": row["days_overdue"],
                "balance": row["balance"],
                "priority_score": str((balance * weight).quantize(Decimal("0.01"))),
                "suggested_type": "payment_reminder",
                "expected_impact": row["balance"],
                "reason": f"{row['invoice_id']} is {row['days_overdue']} days overdue",
            }
        )
    queue.sort(key=lambda item: parse_decimal(item["priority_score"]), reverse=True)
    watch = [
        {
            "invoice_id": row["invoice_id"],
            "balance": row["balance"],
            "suggested_type": "payment_reminder",
            "reason": f"{row['invoice_id']} falls due inside the forecast window",
        }
        for row in recv.get("due_within_horizon", recv["due_within_14d"])
    ]
    return {
        "tool": "prioritize_collections",
        "status": "success",
        "result": {
            "as_of": bundle.meta["as_of"],
            "queue": queue[:limit],
            "watch_list": watch,
            "queue_total": money(sum((parse_decimal(q["balance"]) for q in queue), Decimal(0))),
        },
        "evidence_ids": [q["invoice_id"] for q in queue] + [w["invoice_id"] for w in watch],
        "assumptions": [
            "Priority weights balance by days overdue (balance x (1 + days/30))",
            "In-window invoices are watch-listed, not chased yet",
        ],
    }


def customer_exposure(bundle: DataBundle) -> dict:
    """Per-customer outstanding exposure with concentration flags."""
    recv = cashflow.identify_unpaid_invoices(bundle, 365)["result"]
    total = parse_decimal(recv["total_outstanding"])
    by_customer: dict[str, dict] = {}
    for row in bundle.table("invoices"):
        balance = parse_decimal(row["amount"]) - parse_decimal(row["amount_paid"])
        if balance <= 0:
            continue
        entry = by_customer.setdefault(
            row["customer"], {"customer": row["customer"], "balance": Decimal(0), "invoices": []}
        )
        entry["balance"] += balance
        entry["invoices"].append(row["invoice_id"])
    overdue_days = {row["invoice_id"]: row["days_overdue"] for row in recv["overdue"]}
    customers = []
    for entry in by_customer.values():
        share = str(pct(entry["balance"], total)) if total > 0 else "0.00"
        max_overdue = max((overdue_days.get(i, 0) for i in entry["invoices"]), default=0)
        risk = "high" if Decimal(share) >= 30 or max_overdue > 30 else (
            "medium" if max_overdue > 0 else "low"
        )
        customers.append(
            {
                "customer": entry["customer"],
                "outstanding": money(entry["balance"]),
                "share_pct": share,
                "invoice_count": len(entry["invoices"]),
                "max_days_overdue": max_overdue,
                "risk": risk,
            }
        )
    customers.sort(key=lambda c: parse_decimal(c["outstanding"]), reverse=True)
    return {
        "tool": "customer_exposure",
        "status": "success",
        "result": {
            "as_of": bundle.meta["as_of"],
            "total_outstanding": recv["total_outstanding"],
            "customers": customers,
        },
        "evidence_ids": [i for entry in by_customer.values() for i in entry["invoices"]],
        "assumptions": ["Share is customer outstanding over total outstanding, balances only"],
    }
