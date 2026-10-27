"""Revenue summary and product margins from sales + inventory costs."""

from __future__ import annotations

from decimal import Decimal

from .datasets import DataBundle, money, pct, parse_decimal


def _month_revenue(bundle: DataBundle, month: str) -> tuple[Decimal, list[str]]:
    total = Decimal(0)
    ids: list[str] = []
    for row in bundle.table("sales"):
        if row["date"].startswith(month):
            total += parse_decimal(row["qty"]) * parse_decimal(row["unit_price"])
            ids.append(row["sale_id"])
    return total, ids


def summarize_revenue(bundle: DataBundle, month: str, compare_month: str) -> dict:
    revenue, ids = _month_revenue(bundle, month)
    compare_revenue, compare_ids = _month_revenue(bundle, compare_month)
    return {
        "tool": "summarize_revenue",
        "status": "success",
        "result": {
            "month": month,
            "revenue": money(revenue),
            "sales_count": len(ids),
            "compare_month": compare_month,
            "compare_revenue": money(compare_revenue),
            "growth_pct": str(pct(revenue - compare_revenue, compare_revenue)),
        },
        "evidence_ids": ids + compare_ids,
        "assumptions": [f"Revenue is gross sales for {month} vs {compare_month}; no returns data available"],
    }


def calculate_product_margins(
    bundle: DataBundle, month: str, margin_alert_below: str = "10.00"
) -> dict:
    costs = {r["product_id"]: parse_decimal(r["unit_cost"]) for r in bundle.table("inventory")}
    prev_costs = {r["product_id"]: parse_decimal(r["prev_unit_cost"]) for r in bundle.table("inventory")}
    threshold = parse_decimal(margin_alert_below)

    per_product: dict[str, dict] = {}
    evidence_ids: list[str] = []
    for row in bundle.table("sales"):
        if not row["date"].startswith(month):
            continue
        pid = row["product_id"]
        if pid not in costs:
            raise ValueError(f"no inventory cost for product {pid}; refusing to guess COGS")
        line_revenue = parse_decimal(row["qty"]) * parse_decimal(row["unit_price"])
        line_cogs = parse_decimal(row["qty"]) * costs[pid]
        entry = per_product.setdefault(pid, {"revenue": Decimal(0), "cogs": Decimal(0)})
        entry["revenue"] += line_revenue
        entry["cogs"] += line_cogs
        evidence_ids.append(row["sale_id"])

    products = []
    total_revenue = Decimal(0)
    total_cogs = Decimal(0)
    alerts: list[dict] = []
    for pid in sorted(per_product):
        revenue = per_product[pid]["revenue"]
        cogs = per_product[pid]["cogs"]
        gross = revenue - cogs
        margin = pct(gross, revenue)
        cost_now, cost_prev = costs[pid], prev_costs[pid]
        cost_change = pct(cost_now - cost_prev, cost_prev) if cost_prev != 0 else None
        products.append(
            {
                "product_id": pid,
                "revenue": money(revenue),
                "cogs": money(cogs),
                "gross_profit": money(gross),
                "margin_pct": str(margin),
                "cost_change_pct": str(cost_change) if cost_change is not None else None,
            }
        )
        total_revenue += revenue
        total_cogs += cogs
        evidence_ids.append(pid)
        if margin < threshold:
            alerts.append(
                {"product_id": pid, "reason": f"margin {margin}% is below {threshold}% threshold"}
            )

    blended = pct(total_revenue - total_cogs, total_revenue)
    return {
        "tool": "calculate_product_margins",
        "status": "success",
        "result": {
            "month": month,
            "products": products,
            "totals": {
                "revenue": money(total_revenue),
                "cogs": money(total_cogs),
                "gross_profit": money(total_revenue - total_cogs),
                "blended_margin_pct": str(blended),
            },
            "alerts": alerts,
        },
        "evidence_ids": evidence_ids,
        "assumptions": [
            "COGS uses current unit_cost from inventory; no per-batch costing data",
            "Products with no sales in the month carry no margin rather than zero margin",
        ],
    }
