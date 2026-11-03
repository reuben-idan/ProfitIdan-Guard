"""End-to-end demo runner (no servers needed).

Runs the full story through the real code paths: investigation of the demo
dataset (live Meta model when MODEL_API_KEY is set, deterministic demo review
otherwise), TradeGuard verification, action draft, owner approval, simulated
execution, and the audit trail.

    python demo.py           # asks before approving (the human gate)
    python demo.py --yes     # non-interactive

Run from the repo root.
"""

from __future__ import annotations

import argparse
import os
import sys

from dotenv import load_dotenv

from backend.agent.fallback import run_heuristic_investigation
from backend.agent.orchestrator import MetaClient, run_investigation
from backend.agent.tools import ToolContext
from backend.api import actions as actions_api
from backend.investigate import format_summary
from backend.verification.verifier import verify_finding

QUESTION = (
    "Sales are up but I'm running out of cash. "
    "Find the problem and tell me what to do first."
)

DRAFT_TYPES = ("payment_reminder", "supplier_review", "purchase_hold")


def _enable_utf8() -> None:
    """Windows consoles default to cp1252, which lacks the GH₵ sign."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass


def pick_action(recommended: list) -> dict | None:
    for action in recommended:
        if isinstance(action, dict) and action.get("amount"):
            return action
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the ProfitPilot AI end-to-end demo.")
    parser.add_argument("--yes", action="store_true", help="approve without asking")
    args = parser.parse_args()
    _enable_utf8()

    load_dotenv()
    live = bool(os.getenv("MODEL_API_KEY"))
    if not live:
        print("MODEL_API_KEY is not set; running deterministic demo review instead.", file=sys.stderr)

    print("== 1. The problem ==")
    print(f"Owner asks: {QUESTION}\n")

    print("== 2. The agent investigates (%s) ==" % ("live Meta model" if live else "demo mode"))
    ctx = ToolContext.for_data("data/demo")
    if live:
        result = run_investigation(QUESTION, ctx, MetaClient())
    else:
        result = run_heuristic_investigation(QUESTION, ctx)
    verdicts = [verify_finding(f, ctx.bundle) for f in result.findings]
    print(format_summary(result, verdicts))

    chosen = pick_action(result.recommended_actions)
    if chosen is None:
        print("\nNo actionable recommendation came back; stopping before the action step.")
        return 0

    print("\n== 3. The action: draft the top recommendation ==")
    action_type = chosen.get("type") if chosen.get("type") in DRAFT_TYPES else "supplier_review"
    draft = actions_api.draft(
        actions_api.DraftRequest(
            type=action_type,
            target=chosen.get("target") or "unknown",
            amount=chosen.get("amount") or "0.00",
            finding_ref=result.findings[0].get("title", "") if result.findings else "",
            verified_amount=chosen.get("amount") or "0.00",
        )
    )
    print(f"Draft {draft['id']}: {draft['draft_text']}")

    approved = args.yes
    if not args.yes:
        answer = input("Approve this action? [y/N] ").strip().lower()
        approved = answer == "y"
    if not approved:
        actions_api.reject(draft["id"], actions_api.ApproveRequest(approved_by="owner"))
        print("Rejected. The rejection is recorded; nothing executes.")
        return 0

    print("\n== 4. Approved -> executed (simulated delivery) ==")
    actions_api.approve(draft["id"], actions_api.ApproveRequest(approved_by="owner"))
    executed = actions_api.execute(draft["id"])
    print(f"Status: {executed['status']}. {executed.get('simulation_note', '')}")

    print("\n== 5. Audit trail ==")
    for entry in actions_api.audit_trail(draft["id"])["trail"]:
        print(f"  {entry['event']} — {entry['actor'] or 'system'} · {entry['created_at']}")
    print("\nDemo complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
