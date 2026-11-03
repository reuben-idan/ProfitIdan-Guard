"""Decision-grade intelligence tools against the demo dataset."""

from backend.finance import insights


def test_business_snapshot_pins_demo_kpis(ctx):
    out = insights.business_snapshot(ctx.bundle)
    assert out["status"] == "success"
    kpis = out["result"]
    assert kpis["cash_on_hand"] == "8000.00"
    assert kpis["revenue_month"] == "120000.00"
    assert kpis["revenue_growth_pct"] == "27.39"
    assert kpis["collection_rate_pct"] == "20.83"
    assert kpis["overdue_total"] == "27000.00"
    assert kpis["payables_due"] == "22000.00"
    assert kpis["forecast_on_time"] == "4000.00"
    assert kpis["forecast_slip"] == "-14000.00"
    assert kpis["dead_stock_value"] == "57000.00"
    assert kpis["worst_margin_product"] == "SUGAR-50KG"
    assert [leak["label"] for leak in kpis["leaks_ranked"]] == [
        "Slow-moving stock",
        "Dead stock",
        "Overdue receivables",
    ]


def test_prioritize_collections_ranks_cash_first(ctx):
    out = insights.prioritize_collections(ctx.bundle)
    queue = out["result"]["queue"]
    assert [q["invoice_id"] for q in queue] == ["INV-005", "INV-002"]
    assert queue[0]["customer"] == "Tema Provisions"
    assert queue[0]["expected_impact"] == "15000.00"
    assert queue[0]["suggested_type"] == "payment_reminder"
    assert out["result"]["queue_total"] == "27000.00"
    assert [w["invoice_id"] for w in out["result"]["watch_list"]] == ["INV-003"]


def test_customer_exposure_flags_concentration(ctx):
    out = insights.customer_exposure(ctx.bundle)
    customers = out["result"]["customers"]
    assert out["result"]["total_outstanding"] == "65000.00"
    by_name = {c["customer"]: c for c in customers}
    assert by_name["Tema Provisions"]["risk"] == "high"
    assert by_name["Kumasi Mart"]["outstanding"] == "23000.00"
    assert by_name["Kumasi Mart"]["risk"] == "high"  # 35% concentration
    assert by_name["Owusu Retail"]["risk"] == "low"
    assert customers[0]["customer"] == "Kumasi Mart"  # largest exposure first
