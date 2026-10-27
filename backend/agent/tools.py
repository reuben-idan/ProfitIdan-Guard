"""Tool registry: the model selects tools, the backend executes them.

run_tool never raises: unknown tools and bad arguments come back as error
envelopes so the agent can recover.
"""

from __future__ import annotations

from dataclasses import dataclass

from ..finance import cashflow, inventory, profitability, reconciliation
from ..finance.datasets import DataBundle, load_bundle


@dataclass
class ToolContext:
    data_dir: str
    bundle: DataBundle

    @classmethod
    def for_data(cls, data_dir: str) -> "ToolContext":
        return cls(data_dir=data_dir, bundle=load_bundle(data_dir))


def _envelope(tool: str, status: str, **kwargs) -> dict:
    return {"tool": tool, "status": status, **kwargs}


def run_tool(ctx: ToolContext, name: str, args: dict | None = None) -> dict:
    args = args or {}
    try:
        bundle = ctx.bundle
        if name == "summarize_revenue":
            return profitability.summarize_revenue(bundle, args["month"], args["compare_month"])
        if name == "calculate_product_margins":
            return profitability.calculate_product_margins(
                bundle, args["month"], args.get("margin_alert_below", "10.00")
            )
        if name == "reconcile_bank_transactions":
            return reconciliation.reconcile_bank_transactions(bundle)
        if name == "identify_unpaid_invoices":
            return cashflow.identify_unpaid_invoices(bundle, int(args.get("horizon_days", 14)))
        if name == "upcoming_payables":
            return cashflow.upcoming_payables(bundle, int(args.get("horizon_days", 14)))
        if name == "analyze_inventory_aging":
            return inventory.analyze_inventory_aging(
                bundle,
                int(args.get("window_days", 30)),
                int(args.get("slow_cover_days", 90)),
            )
        if name == "forecast_cash_position":
            return cashflow.forecast_cash_position(bundle, int(args.get("horizon_days", 14)))
        return _envelope(name, "error", error=f"unknown tool: {name}")
    except KeyError as exc:
        return _envelope(name, "error", error=f"missing argument: {exc}")
    except Exception as exc:  # noqa: BLE001 - agent must see failures as data
        return _envelope(name, "error", error=str(exc))


TOOL_SCHEMAS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "summarize_revenue",
            "description": "Total revenue for a month (YYYY-MM) vs a comparison month, with growth rate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string"},
                    "compare_month": {"type": "string"},
                },
                "required": ["month", "compare_month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_product_margins",
            "description": "Per-product revenue, COGS, gross profit and margin for a month; flags thin margins.",
            "parameters": {
                "type": "object",
                "properties": {
                    "month": {"type": "string"},
                    "margin_alert_below": {"type": "string", "default": "10.00"},
                },
                "required": ["month"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "reconcile_bank_transactions",
            "description": "Match bank movements to invoices/bills; prove closing cash from opening + movements.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "identify_unpaid_invoices",
            "description": "Overdue and soon-due customer invoices with balances as of the dataset date.",
            "parameters": {
                "type": "object",
                "properties": {"horizon_days": {"type": "integer", "default": 14}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "upcoming_payables",
            "description": "Supplier bills due within the horizon, with totals.",
            "parameters": {
                "type": "object",
                "properties": {"horizon_days": {"type": "integer", "default": 14}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "analyze_inventory_aging",
            "description": "Days of stock cover per product from trailing sales; flags slow-moving and dead stock.",
            "parameters": {
                "type": "object",
                "properties": {
                    "window_days": {"type": "integer", "default": 30},
                    "slow_cover_days": {"type": "integer", "default": 90},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "forecast_cash_position",
            "description": "Short-horizon cash forecast with on-time and slip scenarios. Never a single number.",
            "parameters": {
                "type": "object",
                "properties": {"horizon_days": {"type": "integer", "default": 14}},
            },
        },
    },
]
