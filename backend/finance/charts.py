"""Chart-ready series for insight visualizations.

Every series is recomputed from source rows in Decimal — the charts can never
disagree with the tool figures. In particular the runway endpoints always
equal the forecast scenarios: charts illustrate the numbers, they don't
replace them.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from . import cashflow, insights, inventory, profitability
from .datasets import DataBundle, money, parse_date, parse_decimal


def _cash_on_hand(bundle: DataBundle) -> Decimal:
    as_of = parse_date(bundle.meta["as_of"])
    cash = parse_decimal(bundle.meta["opening_cash"])
    for txn in bundle.table("bank"):
        if parse_date(txn["date"]) <= as_of:
            cash += parse_decimal(txn["amount"])
    return cash


def runway_series(bundle: DataBundle, horizon_days: int) -> dict:
    """Daily cash trajectory for both forecast scenarios.

    Day 0 is the as-of position before any in-window movement. Overdue
    payables are applied on day 1 (paid first); overdue receivables are
    excluded from both scenarios, exactly like forecast_cash_position.
    """
    as_of = parse_date(bundle.meta["as_of"])
    cash = _cash_on_hand(bundle)

    inflow_by_day: dict[int, Decimal] = {}
    for row in bundle.table("invoices"):
        balance = parse_decimal(row["amount"]) - parse_decimal(row["amount_paid"])
        if balance <= 0:
            continue
        due = parse_date(row["due_date"])
        offset = (due - as_of).days
        if 1 <= offset <= horizon_days:
            inflow_by_day[offset] = inflow_by_day.get(offset, Decimal(0)) + balance

    outflow_by_day: dict[int, Decimal] = {}
    for row in bundle.table("supplier_bills"):
        balance = parse_decimal(row["amount"]) - parse_decimal(row["amount_paid"])
        if balance <= 0:
            continue
        due = parse_date(row["due_date"])
        offset = (due - as_of).days
        if offset <= 0:
            outflow_by_day[1] = outflow_by_day.get(1, Decimal(0)) + balance  # overdue: paid first
        elif offset <= horizon_days:
            outflow_by_day[offset] = outflow_by_day.get(offset, Decimal(0)) + balance

    points: list[dict] = []
    collected = Decimal(0)
    paid = Decimal(0)
    for day in range(horizon_days + 1):
        if day > 0:
            collected += inflow_by_day.get(day, Decimal(0))
            paid += outflow_by_day.get(day, Decimal(0))
        points.append(
            {
                "day": day,
                "date": (as_of + timedelta(days=day)).isoformat(),
                "on_time": money(cash + collected - paid),
                "slip": money(cash - paid),
                "collected_cum": money(collected),
                "paid_cum": money(paid),
            }
        )

    def crossing(key: str) -> tuple[int | None, str | None]:
        for i, point in enumerate(points):
            if parse_decimal(point[key]) < 0:
                return i, point["date"]
        return None, None

    on_day, on_date = crossing("on_time")
    slip_day, slip_date = crossing("slip")
    return {
        "points": points,
        "starting_cash": money(cash),
        "on_time_zero_crossing_day": on_day,
        "on_time_zero_crossing_date": on_date,
        "slip_zero_crossing_day": slip_day,
        "slip_zero_crossing_date": slip_date,
    }


def revenue_trend(bundle: DataBundle) -> dict:
    """Monthly gross revenue for every month present in the sales data."""
    months = sorted({row["date"][:7] for row in bundle.table("sales") if row.get("date")})
    rows: list[dict] = []
    prev: Decimal | None = None
    for month in months:
        total = Decimal(0)
        count = 0
        for row in bundle.table("sales"):
            if row["date"].startswith(month):
                total += parse_decimal(row["qty"]) * parse_decimal(row["unit_price"])
                count += 1
        growth = None
        if prev is not None and prev != 0:
            growth = str(((total - prev) / prev * Decimal(100)).quantize(Decimal("0.01")))
        rows.append(
            {"month": month, "revenue": money(total), "sales_count": count, "growth_pct": growth}
        )
        prev = total
    return {"months": rows}


def margin_bars(bundle: DataBundle, threshold: str = "10.00") -> dict:
    """Per-product margins for the as-of month with the alert threshold."""
    month = bundle.meta["as_of"][:7]
    try:
        result = profitability.calculate_product_margins(bundle, month, threshold)["result"]
    except ValueError as exc:
        return {"month": month, "threshold": threshold, "products": [], "totals": None, "note": str(exc)}
    return {
        "month": month,
        "threshold": threshold,
        "products": [
            {
                "product_id": p["product_id"],
                "revenue": p["revenue"],
                "gross_profit": p["gross_profit"],
                "margin_pct": p["margin_pct"],
                "below_threshold": parse_decimal(p["margin_pct"]) < parse_decimal(threshold),
            }
            for p in result["products"]
        ],
        "totals": result["totals"],
    }


def build_charts(bundle: DataBundle, horizon_days: int = 14) -> dict:
    """One payload for every insight chart on the frontend."""
    horizon_days = min(max(int(horizon_days), 1), 90)
    snapshot = insights.business_snapshot(bundle, horizon_days)["result"]
    queue = insights.prioritize_collections(bundle, horizon_days, limit=8)["result"]
    stock = inventory.analyze_inventory_aging(bundle)["result"]
    exposure = insights.customer_exposure(bundle)["result"]
    return {
        "as_of": bundle.meta["as_of"],
        "horizon_days": horizon_days,
        "currency": bundle.meta.get("currency", "GHS"),
        "runway": runway_series(bundle, horizon_days),
        "revenue_trend": revenue_trend(bundle),
        "margins": margin_bars(bundle),
        "collections": {
            "queue": queue["queue"],
            "queue_total": queue["queue_total"],
            "watch_count": len(queue["watch_list"]),
        },
        "leaks": snapshot["leaks_ranked"],
        "inventory": {
            "products": [
                {
                    "product_id": p["product_id"],
                    "stock_value": p["stock_value"],
                    "status": p["status"],
                    "days_of_cover": p["days_of_cover"],
                }
                for p in stock["products"]
            ],
            "total_stock_value": stock["total_stock_value"],
        },
        "exposure": {
            "customers": exposure["customers"][:6],
            "total_outstanding": exposure["total_outstanding"],
        },
        "assumptions": [
            "Runway applies overdue payables on day 1 and excludes overdue receivables, matching the forecast",
            "Revenue trend covers months present in the sales file only; no months are invented",
            "Margins use current unit_cost; products without in-month sales carry no bar",
        ],
    }
