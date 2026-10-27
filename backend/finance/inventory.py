"""Inventory aging: days of cover from trailing sales and stock value."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from .datasets import DataBundle, money, parse_date, parse_decimal


def analyze_inventory_aging(
    bundle: DataBundle, window_days: int = 30, slow_cover_days: int = 90
) -> dict:
    as_of = parse_date(bundle.meta["as_of"])
    window_start = as_of - timedelta(days=window_days)

    sold: dict[str, int] = {}
    evidence_ids: list[str] = []
    for row in bundle.table("sales"):
        sale_date = parse_date(row["date"])
        if window_start <= sale_date <= as_of:
            sold[row["product_id"]] = sold.get(row["product_id"], 0) + int(row["qty"])
            evidence_ids.append(row["sale_id"])

    products = []
    total_value = Decimal(0)
    alerts: list[dict] = []
    for row in bundle.table("inventory"):
        pid = row["product_id"]
        on_hand = int(row["qty_on_hand"])
        unit_cost = parse_decimal(row["unit_cost"])
        value = unit_cost * on_hand
        total_value += value
        units_sold = sold.get(pid, 0)
        if units_sold > 0:
            cover = round(on_hand * window_days / units_sold)
            status = "slow_moving" if cover > slow_cover_days else "healthy"
        else:
            cover = None
            status = "dead_stock"
        products.append(
            {
                "product_id": pid,
                "qty_on_hand": on_hand,
                "stock_value": money(value),
                "units_sold_window": units_sold,
                "days_of_cover": cover,
                "status": status,
            }
        )
        evidence_ids.append(pid)
        if status != "healthy":
            alerts.append({"product_id": pid, "status": status, "stock_value": money(value)})

    return {
        "tool": "analyze_inventory_aging",
        "status": "success",
        "result": {
            "as_of": bundle.meta["as_of"],
            "window_days": window_days,
            "products": products,
            "total_stock_value": money(total_value),
            "alerts": alerts,
        },
        "evidence_ids": evidence_ids,
        "assumptions": [
            f"Daily sales rate is trailing {window_days}-day sales divided by {window_days}",
            "Cover above 90 days is flagged slow-moving; zero sales is dead stock",
        ],
    }
