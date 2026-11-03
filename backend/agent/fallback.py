"""Deterministic fallback investigator: verified answers without a model call.

Runs the same finance tools the agent would, then assembles findings with
tool-check amount proofs and cash-impact-ranked actions. Every figure is read
from tool output (never hard-coded), so TradeGuard verifies it on any dataset.

Used for demo mode (no MODEL_API_KEY), offline judges, and free-tier cold
starts where the model call would time out.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from ..finance.datasets import parse_decimal
from .orchestrator import InvestigationResult
from .tools import ToolContext, run_tool


def _prev_month(as_of: str) -> tuple[str, str]:
    year, month, _ = (int(p) for p in as_of.split("-"))
    first = date(year, month, 1)
    prev_month = first.month - 1 or 12
    prev_year = first.year - (1 if first.month == 1 else 0)
    return f"{year:04d}-{month:02d}", f"{prev_year:04d}-{prev_month:02d}"


def _record(result: InvestigationResult, name: str, args: dict, output: dict) -> dict:
    result.steps.append(
        {
            "tool": name,
            "args": args,
            "status": output.get("status"),
            "evidence_ids": output.get("evidence_ids", []),
        }
    )
    return output


def run_heuristic_investigation(
    question: str, ctx: ToolContext, horizon_days: int = 14
) -> InvestigationResult:
    result = InvestigationResult(question=question)
    currency = ctx.bundle.meta.get("currency", "GHS")
    as_of = ctx.bundle.meta.get("as_of", "")
    month, prev_month = _prev_month(as_of) if as_of else ("", "")

    snapshot = _record(result, "business_snapshot", {"horizon_days": horizon_days},
                       run_tool(ctx, "business_snapshot", {"horizon_days": horizon_days}))
    recv = _record(result, "identify_unpaid_invoices", {"horizon_days": horizon_days},
                   run_tool(ctx, "identify_unpaid_invoices", {"horizon_days": horizon_days}))
    pay = _record(result, "upcoming_payables", {"horizon_days": horizon_days},
                  run_tool(ctx, "upcoming_payables", {"horizon_days": horizon_days}))
    forecast = _record(result, "forecast_cash_position", {"horizon_days": horizon_days},
                       run_tool(ctx, "forecast_cash_position", {"horizon_days": horizon_days}))
    stock = _record(result, "analyze_inventory_aging", {"window_days": 30, "slow_cover_days": 90},
                    run_tool(ctx, "analyze_inventory_aging", {}))
    margins = _record(result, "calculate_product_margins", {"month": month},
                      run_tool(ctx, "calculate_product_margins", {"month": month}))
    revenue = _record(result, "summarize_revenue",
                      {"month": month, "compare_month": prev_month},
                      run_tool(ctx, "summarize_revenue",
                               {"month": month, "compare_month": prev_month}))
    queue = _record(result, "prioritize_collections",
                    {"horizon_days": horizon_days, "limit": 5},
                    run_tool(ctx, "prioritize_collections", {"horizon_days": horizon_days}))

    snap = snapshot.get("result", {})
    r = recv.get("result", {})
    p = pay.get("result", {})
    f = forecast.get("result", {})
    s = stock.get("result", {})
    m = margins.get("result", {})
    rev = revenue.get("result", {}) if revenue.get("status") == "success" else {}
    q = queue.get("result", {}) if queue.get("status") == "success" else {"queue": []}

    findings: list[dict] = []
    if f:
        slip = f["scenarios"]["receivables_slip"]
        findings.append({
            "title": "Cash crunch inside the forecast window",
            "claim": (
                f"Cash on hand is {snap.get('cash_on_hand')} against {p.get('total_due')} "
                f"payables due in {horizon_days} days; if collections slip, the gap is {slip}."
            )[:240],
            "evidence_ids": forecast.get("evidence_ids", [])[:12],
            "currency": currency,
            "severity": "critical" if parse_decimal(slip) < 0 else "high",
            "cash_impact": slip,
            "amount_checks": [{
                "label": "Slip scenario",
                "tool": "forecast_cash_position",
                "args": {"horizon_days": horizon_days},
                "path": "result.scenarios.receivables_slip",
                "expected": slip,
            }],
        })
    if r and parse_decimal(r.get("overdue_total", "0")) > 0:
        top = ", ".join(f"{row['invoice_id']} ({row['balance']}, {row['days_overdue']}d)"
                        for row in r["overdue"][:3])
        findings.append({
            "title": "Overdue receivables are the profit leak",
            "claim": f"{r['overdue_total']} overdue across {len(r['overdue'])} invoices: {top}."[:240],
            "evidence_ids": [row["invoice_id"] for row in r["overdue"]],
            "currency": currency,
            "severity": "high",
            "cash_impact": r["overdue_total"],
            "amount_checks": [{
                "label": "Overdue total",
                "tool": "identify_unpaid_invoices",
                "args": {"horizon_days": horizon_days},
                "path": "result.overdue_total",
                "expected": r["overdue_total"],
            }],
        })
    alerts = s.get("alerts", []) if s else []
    if alerts:
        tied = sum((parse_decimal(a["stock_value"]) for a in alerts), Decimal(0))
        worst = max(alerts, key=lambda a: parse_decimal(a["stock_value"]))
        findings.append({
            "title": "Cash trapped in slow and dead stock",
            "claim": (
                f"{len(alerts)} products tie up cash; worst is {worst['product_id']} "
                f"({worst['status']}, {worst['stock_value']} tied up)."
            )[:240],
            "evidence_ids": [a["product_id"] for a in alerts],
            "currency": currency,
            "severity": "medium",
            "cash_impact": str(tied.quantize(Decimal("0.01"))),
            "amount_checks": [{
                "label": "Total stock value",
                "tool": "analyze_inventory_aging",
                "args": {},
                "path": "result.total_stock_value",
                "expected": s["total_stock_value"],
            }],
        })
    alerts_m = (m.get("alerts", []) if m else []) or []
    if alerts_m:
        pid = alerts_m[0]["product_id"]
        by_id = {p["product_id"]: p for p in m.get("products", [])}
        margin = by_id.get(pid, {}).get("margin_pct", "?")
        findings.append({
            "title": "Thin margin needs a price or cost fix",
            "claim": f"{pid} margin is {margin}%, below the alert threshold; it earns the least per sale."[:240],
            "evidence_ids": [pid],
            "currency": currency,
            "severity": "medium",
            "cash_impact": "0.00",
            "amount_checks": [{
                "label": "Blended margin",
                "tool": "calculate_product_margins",
                "args": {"month": month},
                "path": "result.totals.blended_margin_pct",
                "expected": m["totals"]["blended_margin_pct"],
            }],
        })
    if rev and rev.get("growth_pct") is not None:
        findings.append({
            "title": "Sales growth is real, collections lag it",
            "claim": (
                f"Revenue {rev.get('revenue')} in {month} ({rev.get('growth_pct')}% vs "
                f"{prev_month}); collection rate is {snap.get('collection_rate_pct')}%."
            )[:240],
            "evidence_ids": revenue.get("evidence_ids", [])[:8],
            "currency": currency,
            "severity": "low",
            "cash_impact": "0.00",
            "amount_checks": [{
                "label": "Month revenue",
                "tool": "summarize_revenue",
                "args": {"month": month, "compare_month": prev_month},
                "path": "result.revenue",
                "expected": rev["revenue"],
            }],
        })

    actions: list[dict] = []
    for item in q.get("queue", [])[:3]:
        actions.append({
            "type": "payment_reminder",
            "target": item["customer"],
            "amount": item["balance"],
            "reason": item["reason"],
            "expected_impact": item["expected_impact"],
            "timeframe_days": 3,
        })
    if alerts:
        worst = max(alerts, key=lambda a: parse_decimal(a["stock_value"]))
        actions.append({
            "type": "purchase_hold",
            "target": worst["product_id"],
            "amount": worst["stock_value"],
            "reason": f"{worst['status']}: clear existing stock before reordering",
            "expected_impact": worst["stock_value"],
            "timeframe_days": 7,
        })
    bills = (p.get("bills_due", []) or []) if p else []
    if bills:
        biggest = max(bills, key=lambda b: parse_decimal(b["balance"]))
        actions.append({
            "type": "supplier_review",
            "target": biggest["supplier"],
            "amount": biggest["balance"],
            "reason": f"{biggest['bill_id']} falls due in the forecast window",
            "expected_impact": biggest["balance"],
            "timeframe_days": 7,
        })

    result.findings = findings
    result.recommended_actions = actions
    result.completed = True
    result.narrative = (
        "Deterministic review (demo mode): same finance tools, no model call. "
        "Start with the first collection; it frees the most cash fastest."
    )
    return result
