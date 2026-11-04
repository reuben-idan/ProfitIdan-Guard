"""Chart series: deterministic, downloadable data behind every insight chart.

The runway endpoints must always agree with the forecast scenarios — a chart
that disagrees with the numbers is worse than no chart.
"""

from pathlib import Path

import pytest

from backend.api import sessions as sessions_api
from backend.finance import cashflow, charts
from backend.finance.datasets import TABLE_FILES, load_bundle, parse_decimal

DEMO_DIR = Path(__file__).resolve().parents[2] / "data" / "demo"

META = {
    "business_name": "Test Foods Ltd",
    "currency": "GHS",
    "as_of": "2026-10-27",
    "opening_cash": "20000.00",
    "opening_cash_date": "2026-10-01",
}


@pytest.fixture()
def env(monkeypatch, tmp_path):
    monkeypatch.setenv("PROFITPILOT_DB", str(tmp_path / "test.db"))
    monkeypatch.setenv("PROFITPILOT_UPLOADS", str(tmp_path / "uploads"))
    monkeypatch.delenv("MODEL_API_KEY", raising=False)
    return tmp_path


def _fill_session(sid: str) -> None:
    for kind in ("invoices", "supplier_bills", "bank", "sales", "inventory"):
        content = (DEMO_DIR / TABLE_FILES[kind]).read_text()
        sessions_api.upload_session_file(
            sid, sessions_api.SessionFileRequest(filename=TABLE_FILES[kind], kind=kind, content=content)
        )
    sessions_api.set_session_meta(sid, sessions_api.SessionMetaRequest(**META))


def test_runway_endpoints_match_forecast_scenarios():
    bundle = load_bundle(DEMO_DIR)
    payload = charts.build_charts(bundle, 14)
    forecast = cashflow.forecast_cash_position(bundle, 14)["result"]
    runway = payload["runway"]
    assert runway["points"][0]["day"] == 0
    assert runway["points"][0]["on_time"] == forecast["opening_cash"]
    assert runway["points"][0]["slip"] == forecast["opening_cash"]
    assert runway["points"][-1]["on_time"] == forecast["scenarios"]["on_time_collections"]
    assert runway["points"][-1]["slip"] == forecast["scenarios"]["receivables_slip"]
    assert len(runway["points"]) == 15


def test_runway_slip_never_rises_and_flags_zero_crossing():
    bundle = load_bundle(DEMO_DIR)
    runway = charts.build_charts(bundle, 14)["runway"]
    slips = [parse_decimal(p["slip"]) for p in runway["points"]]
    assert all(b <= a for a, b in zip(slips, slips[1:]))
    # Demo slip scenario ends negative, so a crossing day must be named.
    assert slips[-1] < 0
    assert runway["slip_zero_crossing_day"] is not None
    assert runway["points"][runway["slip_zero_crossing_day"]]["date"] == runway["slip_zero_crossing_date"]


def test_revenue_trend_sorted_with_growth():
    bundle = load_bundle(DEMO_DIR)
    trend = charts.build_charts(bundle, 14)["revenue_trend"]
    months = [m["month"] for m in trend["months"]]
    assert months == sorted(months)
    assert len(months) >= 2
    assert trend["months"][-1]["growth_pct"] is not None


def test_margins_collections_inventory_present():
    bundle = load_bundle(DEMO_DIR)
    payload = charts.build_charts(bundle, 14)
    assert payload["margins"]["threshold"] == "10.00"
    assert len(payload["margins"]["products"]) >= 1
    assert payload["collections"]["queue"]
    assert parse_decimal(payload["leaks"][0]["amount"]) >= parse_decimal(payload["leaks"][-1]["amount"])
    assert payload["inventory"]["products"]
    assert payload["exposure"]["customers"]


def test_session_charts_endpoint(env):
    sid = sessions_api.create_session(sessions_api.CreateSessionRequest(name="t"))["id"]
    _fill_session(sid)
    body = sessions_api.session_charts(sid, horizon_days=14)
    assert body["id"] == sid
    assert body["charts"]["currency"] == "GHS"
    assert len(body["charts"]["runway"]["points"]) == 15
    body7 = sessions_api.session_charts(sid, horizon_days=7)
    assert len(body7["charts"]["runway"]["points"]) == 8


def test_demo_alias_charts(env):
    body = sessions_api.session_charts("demo", horizon_days=14)
    assert body["id"] == "demo"
    assert body["charts"]["runway"]["points"][-1]["day"] == 14


def test_investigation_charts_follow_session(env):
    from backend.api import investigations as inv_api

    sid = sessions_api.create_session(sessions_api.CreateSessionRequest(name="t"))["id"]
    _fill_session(sid)
    inv = inv_api.investigate(inv_api.InvestigateRequest(question="Why no cash?", session_id=sid))
    body = inv_api.investigation_charts(inv["id"], horizon_days=14)
    assert body["id"] == inv["id"]
    assert body["charts"]["currency"] == "GHS"
    assert len(body["charts"]["runway"]["points"]) == 15
    stored = inv_api.get_investigation(inv["id"])
    assert stored["dataset_ref"] == f"session:{sid}"


def test_investigation_charts_follow_demo(env):
    from backend.api import investigations as inv_api

    inv = inv_api.investigate(
        inv_api.InvestigateRequest(question="Why no cash?", data_dir=str(DEMO_DIR))
    )
    body = inv_api.investigation_charts(inv["id"], horizon_days=7)
    assert len(body["charts"]["runway"]["points"]) == 8


def test_investigation_charts_expired_or_legacy(env):
    from fastapi import HTTPException

    from backend.api import investigations as inv_api
    from backend.models.store import Store

    store = Store(env / "test.db")
    gone = store.save_investigation("q", {"findings": []}, [], "completed", False, "session:s_gone")
    with pytest.raises(HTTPException) as exc:
        inv_api.investigation_charts(gone)
    assert exc.value.status_code == 400
    assert "expired" in exc.value.detail

    legacy = store.save_investigation("q", {"findings": []}, [], "completed")
    with pytest.raises(HTTPException) as exc:
        inv_api.investigation_charts(legacy)
    assert exc.value.status_code == 400
    assert "before charts" in exc.value.detail
