"""Deterministic fallback investigator: verified findings without a model."""

from backend.agent.fallback import run_heuristic_investigation
from backend.verification.verifier import verify_finding


def test_heuristic_findings_all_verify(ctx):
    result = run_heuristic_investigation("Why am I running out of cash?", ctx)
    assert result.completed is True
    assert len(result.findings) >= 3
    verdicts = [verify_finding(f, ctx.bundle) for f in result.findings]
    assert [v["status"] for v in verdicts] == ["verified"] * len(verdicts)


def test_heuristic_actions_rank_cash_first(ctx):
    result = run_heuristic_investigation("What do I do first?", ctx)
    assert result.recommended_actions, "fallback must always recommend a next action"
    first = result.recommended_actions[0]
    assert first["type"] == "payment_reminder"
    assert first["target"] == "Tema Provisions"
    assert first["amount"] == "15000.00"
    assert first["expected_impact"] == "15000.00"
    types = {a["type"] for a in result.recommended_actions}
    assert {"payment_reminder", "purchase_hold", "supplier_review"} <= types


def test_heuristic_records_tool_steps(ctx):
    result = run_heuristic_investigation("q", ctx)
    tools = [s["tool"] for s in result.steps]
    assert "business_snapshot" in tools
    assert "forecast_cash_position" in tools
    assert all(s["status"] == "success" for s in result.steps)
