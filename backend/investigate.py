"""CLI runner for live investigations.

    python -m backend.investigate --data data/demo "Why am I running out of cash?"

Needs MODEL_API_KEY in the environment or a .env file.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from dotenv import load_dotenv

from .agent.fallback import run_heuristic_investigation
from .agent.orchestrator import InvestigationResult, MetaClient, run_investigation
from .agent.tools import ToolContext
from .verification.verifier import verify_finding


def format_summary(result: InvestigationResult, verdicts: list[dict]) -> str:
    lines = [
        f"Question: {result.question}",
        "Steps (%d): %s" % (len(result.steps), ", ".join(s["tool"] for s in result.steps)),
    ]
    for finding, verdict in zip(result.findings, verdicts):
        severity = f" · {finding.get('severity')}" if finding.get("severity") else ""
        lines.append(f"\n[{verdict['status'].upper()}{severity}] {finding.get('title') or '(untitled)'}")
        lines.append(f"  {finding.get('claim')}")
    if result.recommended_actions:
        lines.append("\nRecommended actions:")
        for action in result.recommended_actions:
            if isinstance(action, dict):
                lines.append(
                    f"  - {action.get('type')}: {action.get('target')} "
                    f"{action.get('amount')} ({action.get('reason')})"
                )
            else:
                lines.append(f"  - {action}")
    if result.narrative:
        lines.append(f"\nNote: {result.narrative}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run a ProfitPilot AI investigation.")
    parser.add_argument("--data", default="data/demo", help="dataset directory")
    parser.add_argument("--max-steps", type=int, default=8)
    parser.add_argument("--quiet", action="store_true", help="summary only, no JSON dump")
    parser.add_argument("--demo", action="store_true", help="deterministic review without a model call")
    parser.add_argument("question")
    args = parser.parse_args(argv)

    load_dotenv()
    demo = args.demo or not os.getenv("MODEL_API_KEY")
    if demo and not args.demo:
        print("MODEL_API_KEY is not set; running deterministic demo review instead.", file=sys.stderr)

    ctx = ToolContext.for_data(args.data)
    if demo:
        result = run_heuristic_investigation(args.question, ctx)
    else:
        result = run_investigation(args.question, ctx, MetaClient(), max_steps=args.max_steps)
    verdicts = [verify_finding(f, ctx.bundle) for f in result.findings]

    print(format_summary(result, verdicts))
    if not args.quiet:
        print("\n--- full result ---")
        print(json.dumps({**result.to_dict(), "verdicts": verdicts}, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
