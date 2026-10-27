"""TradeGuard verifier: re-check agent findings against source records.

Verdicts:
- verified: every check passed.
- contradicted: a hard check failed (wrong amount, wrong currency).
- unverified: evidence is missing or incomplete; the claim may be true but
  the records do not support it yet.
"""

from __future__ import annotations

from decimal import Decimal

from ..finance.datasets import DataBundle, money, parse_decimal
from .evidence import EvidenceRegistry


def _check(label: str, passed: bool, detail: str) -> dict:
    return {"check": label, "passed": passed, "detail": detail}


def verify_finding(finding: dict, bundle: DataBundle) -> dict:
    """finding = {
        "title": str, "claim": str, "evidence_ids": [str],
        "currency": str, "period": {"start": str, "end": str} (optional),
        "amount_checks": [{"label", "dataset", "ids", "field", "expected"}] (optional),
    }"""
    registry = EvidenceRegistry(bundle)
    checks: list[dict] = []
    hard_failure = False
    soft_failure = False

    evidence_ids = finding.get("evidence_ids", [])
    if not evidence_ids:
        checks.append(_check("evidence_present", False, "no evidence IDs cited"))
        soft_failure = True
    else:
        missing = registry.missing(evidence_ids)
        if missing:
            checks.append(_check("evidence_resolves", False, f"unknown IDs: {', '.join(missing)}"))
            soft_failure = True
        else:
            checks.append(
                _check("evidence_resolves", True, f"{len(evidence_ids)} IDs resolve to source records")
            )

    expected_currency = bundle.meta["currency"]
    if finding.get("currency") != expected_currency:
        checks.append(
            _check("currency", False, f"finding uses {finding.get('currency')}, records use {expected_currency}")
        )
        hard_failure = True
    else:
        checks.append(_check("currency", True, expected_currency))

    for spec in finding.get("amount_checks", []):
        label = spec.get("label", "amount")
        try:
            index = bundle.by_id(spec["dataset"])
        except KeyError:
            checks.append(_check(label, False, f"unknown dataset {spec.get('dataset')}"))
            hard_failure = True
            continue
        total = Decimal(0)
        unresolved = [i for i in spec["ids"] if i not in index]
        if unresolved:
            checks.append(_check(label, False, f"IDs not in {spec['dataset']}: {', '.join(unresolved)}"))
            soft_failure = True
            continue
        try:
            for i in spec["ids"]:
                total += parse_decimal(index[i][spec["field"]])
        except (KeyError, ValueError) as exc:
            checks.append(_check(label, False, f"cannot recompute: {exc}; missing data is not zero"))
            soft_failure = True
            continue
        expected = parse_decimal(spec["expected"])
        if total == expected:
            checks.append(_check(label, True, f"recomputed {money(total)} matches"))
        else:
            checks.append(
                _check(label, False, f"records say {money(total)}, finding claims {money(expected)}")
            )
            hard_failure = True

    if hard_failure:
        status = "contradicted"
    elif soft_failure:
        status = "unverified"
    else:
        status = "verified"
    return {"title": finding.get("title", ""), "status": status, "checks": checks}


def guard_action(amount: str, verified_amount: str, approved: bool) -> dict:
    """Gate a consequential action: it needs a verified ceiling and explicit approval."""
    value = parse_decimal(amount)
    ceiling = parse_decimal(verified_amount)
    if value <= 0:
        return {"allowed": False, "reason": "amount must be positive"}
    if value > ceiling:
        return {
            "allowed": False,
            "reason": f"GH₵{money(value)} exceeds verified GH₵{money(ceiling)}",
        }
    if not approved:
        return {"allowed": False, "reason": "owner approval required before execution"}
    return {"allowed": True, "reason": "within verified amount with owner approval"}
