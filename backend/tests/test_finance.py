"""Finance tools against the demo dataset. Expected values are hand-computed
in data/demo/expected_answers.md; these tests pin them."""

from backend.finance import cashflow, inventory, profitability, reconciliation


def test_revenue_growth(ctx):
    out = profitability.summarize_revenue(ctx.bundle, "2026-10", "2026-09")
    assert out["status"] == "success"
    assert out["result"]["revenue"] == "120000.00"
    assert out["result"]["compare_revenue"] == "94200.00"
    assert out["result"]["growth_pct"] == "27.39"


def test_product_margins(ctx):
    out = profitability.calculate_product_margins(ctx.bundle, "2026-10")
    totals = out["result"]["totals"]
    assert totals == {
        "revenue": "120000.00",
        "cogs": "101200.00",
        "gross_profit": "18800.00",
        "blended_margin_pct": "15.67",
    }
    by_id = {p["product_id"]: p for p in out["result"]["products"]}
    assert by_id["SUGAR-50KG"]["margin_pct"] == "4.44"
    assert by_id["SUGAR-50KG"]["cost_change_pct"] == "13.16"
    assert by_id["RICE-25KG"]["margin_pct"] == "18.75"
    assert [a["product_id"] for a in out["result"]["alerts"]] == ["SUGAR-50KG"]


def test_bank_reconciliation(ctx):
    out = reconciliation.reconcile_bank_transactions(ctx.bundle)
    result = out["result"]
    assert result["opening_cash"] == "20000.00"
    assert result["movements_total"] == "-12000.00"
    assert result["closing_cash"] == "8000.00"
    assert result["unmatched"] == ["BANK-004", "BANK-005", "BANK-006"]
    assert result["discrepancies"] == []
    assert len(result["matches"]) == 3


def test_unpaid_invoices(ctx):
    out = cashflow.identify_unpaid_invoices(ctx.bundle)
    result = out["result"]
    assert result["overdue_total"] == "27000.00"
    assert result["total_outstanding"] == "65000.00"
    assert result["due_within_14d_total"] == "18000.00"
    by_id = {r["invoice_id"]: r for r in result["overdue"]}
    assert by_id["INV-002"]["days_overdue"] == 12
    assert by_id["INV-005"]["days_overdue"] == 38


def test_upcoming_payables(ctx):
    out = cashflow.upcoming_payables(ctx.bundle)
    assert out["result"]["total_due"] == "22000.00"
    assert out["result"]["overdue_total"] == "0.00"


def test_inventory_aging(ctx):
    out = inventory.analyze_inventory_aging(ctx.bundle)
    result = out["result"]
    assert result["total_stock_value"] == "443800.00"
    by_id = {p["product_id"]: p for p in result["products"]}
    assert by_id["SUGAR-50KG"]["days_of_cover"] == 375
    assert by_id["SUGAR-50KG"]["status"] == "slow_moving"
    assert by_id["SOAP-BOX"]["days_of_cover"] is None
    assert by_id["SOAP-BOX"]["status"] == "dead_stock"
    assert by_id["RICE-25KG"]["days_of_cover"] == 60


def test_cash_forecast_scenarios(ctx):
    out = cashflow.forecast_cash_position(ctx.bundle)
    result = out["result"]
    assert result["opening_cash"] == "8000.00"
    assert result["receivables_due"] == "18000.00"
    assert result["payables_due"] == "22000.00"
    assert result["scenarios"]["on_time_collections"] == "4000.00"
    assert result["scenarios"]["receivables_slip"] == "-14000.00"
