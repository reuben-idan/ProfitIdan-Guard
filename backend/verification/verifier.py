"""TradeGuard verifier: re-check agent findings against source records.

Verdicts:
- verified: every check passed.
- contradicted: a hard check failed (wrong amount, wrong currency).
- unverified: evidence is missing or incomplete; the claim may be true but
  the records do not support it yet.
"""

from __future__ import annotations

import json
from decimal import Decimal

from ..agent.tools import ToolContext, run_tool
from ..finance.datasets import DataBundle, money, parse_decimal
from .evidence import EvidenceRegistry


def _check(label: str, passed: bool, detail: str) -> dict:
    return {"check": label, "passed": passed, "detail": detail}


def _context(source: DataBundle | ToolContext) -> ToolContext:
    if isinstance(source, ToolContext):
        return source
    return ToolContext(data_dir=str(source.data_dir), bundle=source)


def _verify_tool_check(spec: dict, ctx: ToolContext) -> tuple[bool | None, str]:
    """Re-run a finance tool and compare a result path.

    Returns True on match, False on contradiction, None when the check
    cannot run (unknown tool, bad path): missing proof is unverified,
    never a pass.
    """
    output = run_tool(ctx, spec["tool"], spec.get("args", {}))
    if output.get("status") != "success":
        return None, f"tool {spec['tool']} failed: {output.get('error')}"
    node: object = output
    for key in str(spec.get("path", "")).split("."):
        if not isinstance(node, dict) or key not in node:
            return None, f"path {spec.get('path')} not in {spec['tool']} output"
        node = node[key]
    actual = node if isinstance(node, str) else json.dumps(node, sort_keys=True)
    expected = spec["expected"]
    if actual == expected:
        return True, f"re-ran {spec['tool']}: {spec.get('path')} matches"
    return False, f"re-ran {spec['tool']}: records say {actual}, finding claims {expected}"


def verify_finding(finding: dict, source: DataBundle | ToolContext) -> dict:
    """finding = {
        "title": str, "claim": str, "evidence_ids": [str],
        "currency": str, "period": {"start": str, "end": str} (optional),
        "amount_checks": [
            {"label", "dataset", "ids", "field", "expected"}  # source check
            | {"label", "tool", "args", "path", "expected"}   # tool check
        ] (optional),
    }"""
    bundle = source.bundle if isinstance(source, ToolContext) else source
    ctx = _context(source)
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
    claimed_currency = finding.get("currency")
    if claimed_currency == expected_currency:
        checks.append(_check("currency", True, expected_currency))
    elif not claimed_currency:
        checks.append(_check("currency", False, "finding states no currency"))
        soft_failure = True
    else:
        checks.append(
            _check("currency", False, f"finding uses {claimed_currency}, records use {expected_currency}")
        )
        hard_failure = True

    for spec in finding.get("amount_checks", []):
        label = spec.get("label", "amount")
        if "tool" in spec:
            passed, detail = _verify_tool_check(spec, ctx)
            checks.append(_check(label, passed is True, detail))
            if passed is False:
                hard_failure = True
            elif passed is None:
                soft_failure = True
            continue
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


def guard_action(
    amount: str, verified_amount: str, approved: bool, currency: str = "GHS"
) -> dict:
    """Gate a consequential action: it needs a verified ceiling and explicit approval."""
    value = parse_decimal(amount)
    ceiling = parse_decimal(verified_amount)
    symbol = "GH₵" if currency.upper() == "GHS" else f"{currency.upper()} "
    if value <= 0:
        return {"allowed": False, "reason": "amount must be positive"}
    if value > ceiling:
        return {
            "allowed": False,
            "reason": f"{symbol}{money(value)} exceeds verified {symbol}{money(ceiling)}",
        }
    if not approved:
        return {"allowed": False, "reason": "owner approval required before execution"}
    return {"allowed": True, "reason": "within verified amount with owner approval"}
