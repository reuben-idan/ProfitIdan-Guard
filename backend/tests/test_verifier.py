"""TradeGuard verifier: proven claims pass, invented ones fail loudly."""

from backend.verification.verifier import guard_action, verify_finding


def _finding(**overrides):
    base = {
        "title": "Overdue receivables",
        "claim": "GH₵27,000 is overdue across two invoices.",
        "evidence_ids": ["INV-002", "INV-005"],
        "currency": "GHS",
        "amount_checks": [
            {
                "label": "overdue_total",
                "dataset": "invoices",
                "ids": ["INV-002", "INV-005"],
                "field": "amount",
                "expected": "37000.00",  # 12000 + 25000 gross; balance check below
            }
        ],
    }
    base.update(overrides)
    return base


def test_verified_finding(ctx):
    verdict = verify_finding(_finding(), ctx.bundle)
    assert verdict["status"] == "verified"
    assert all(c["passed"] for c in verdict["checks"])


def test_unknown_evidence_is_unverified(ctx):
    verdict = verify_finding(_finding(evidence_ids=["INV-002", "INV-999"]), ctx.bundle)
    assert verdict["status"] == "unverified"


def test_wrong_amount_is_contradicted(ctx):
    finding = _finding()
    finding["amount_checks"][0]["expected"] = "27000.00"  # gross is 37000, not 27000
    verdict = verify_finding(finding, ctx.bundle)
    assert verdict["status"] == "contradicted"


def test_wrong_currency_is_contradicted(ctx):
    verdict = verify_finding(_finding(currency="USD"), ctx.bundle)
    assert verdict["status"] == "contradicted"


def test_no_evidence_is_unverified(ctx):
    verdict = verify_finding(_finding(evidence_ids=[]), ctx.bundle)
    assert verdict["status"] == "unverified"


def test_action_guard_requires_approval_and_ceiling():
    assert guard_action("12000.00", "27000.00", approved=False)["allowed"] is False
    assert guard_action("12000.00", "27000.00", approved=True)["allowed"] is True
    over = guard_action("30000.00", "27000.00", approved=True)
    assert over["allowed"] is False
    assert "exceeds verified" in over["reason"]
