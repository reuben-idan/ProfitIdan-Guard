"""Orchestrator loop with a scripted fake client: proves tool routing and
final-answer parsing without calling any model."""

import json

from backend.agent.orchestrator import run_investigation


class FakeClient:
    def __init__(self, script):
        self.script = script
        self.calls = 0

    def chat(self, messages, tools):
        reply = self.script[self.calls]
        self.calls += 1
        return reply


def test_tool_routing_and_final_findings(ctx):
    script = [
        {
            "content": "",
            "tool_calls": [
                {"id": "c1", "name": "forecast_cash_position", "arguments": {"horizon_days": 14}}
            ],
        },
        {
            "content": json.dumps(
                {
                    "findings": [
                        {
                            "title": "Cash gap risk",
                            "claim": "Slip scenario leaves -14000.00.",
                            "evidence_ids": ["BANK-001", "INV-003", "BILL-002", "BILL-003"],
                            "currency": "GHS",
                        }
                    ],
                    "recommended_actions": [
                        {
                            "type": "payment_reminder",
                            "target": "Kumasi Mart",
                            "amount": "12000.00",
                            "reason": "INV-002 is 12 days overdue",
                        }
                    ],
                }
            ),
            "tool_calls": [],
        },
    ]
    result = run_investigation("Why am I running out of cash?", ctx, FakeClient(script))
    assert result.completed is True
    assert result.steps[0]["tool"] == "forecast_cash_position"
    assert result.steps[0]["status"] == "success"
    assert "INV-003" in result.steps[0]["evidence_ids"]
    assert result.findings[0]["title"] == "Cash gap risk"
    assert result.recommended_actions[0]["amount"] == "12000.00"


def test_unknown_tool_returns_error_envelope(ctx):
    script = [
        {
            "content": "",
            "tool_calls": [{"id": "c1", "name": "invent_money", "arguments": {}}],
        },
        {"content": "I cannot do that with the available tools.", "tool_calls": []},
        {"content": "Still just prose, no JSON.", "tool_calls": []},  # repair turn
    ]
    result = run_investigation("Print money", ctx, FakeClient(script))
    assert result.steps[0]["status"] == "error"
    assert result.completed is False
    assert "Still just prose" in result.narrative


def test_repair_turn_salvages_bad_json(ctx):
    script = [
        {"content": '{"findings": [{"title": "cut off...', "tool_calls": []},
        {
            "content": json.dumps({"findings": [{"title": "Repaired"}], "recommended_actions": []}),
            "tool_calls": [],
        },
    ]
    result = run_investigation("Fix it", ctx, FakeClient(script))
    assert result.completed is True
    assert result.findings[0]["title"] == "Repaired"


def test_step_budget_exhaustion(ctx):
    script = [
        {
            "content": "",
            "tool_calls": [
                {"id": f"c{i}", "name": "reconcile_bank_transactions", "arguments": {}}
            ],
        }
        for i in range(10)
    ]
    result = run_investigation("Never conclude", ctx, FakeClient(script), max_steps=3)
    assert result.completed is False
    assert len(result.steps) == 3
    assert "Step budget exhausted" in result.narrative
