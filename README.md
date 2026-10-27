# ProfitPilot AI — the AI CFO for African distributors

Investigates profit leaks, verifies financial evidence, anticipates
cash-flow risk, and prepares the next best business action — with human
approval. Built for the Meta Global AI Developer Hackathon.

**Core promise:** don't just tell an owner what is wrong. Show the evidence,
verify the numbers, explain what happens next, and prepare a defensible
response. Powered by Meta's Muse model for reasoning; guarded by TradeGuard
verification and controlled execution.

## Quickstart (Windows PowerShell)

```powershell
C:\Python312\python.exe -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `MODEL_API_KEY` (Meta Model API key;
never commit it). Then:

```powershell
python test_meta_api.py          # connectivity smoke test
python -m pytest backend/tests -q
uvicorn backend.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

## The demo story

Fictional Accra Foods Distributors Ltd (all data synthetic, planted
problems, hand-verified answers in `data/demo/expected_answers.md`):

- October sales GH₵120,000 (+27.39%) — yet only GH₵8,000 cash on hand.
- GH₵27,000 overdue receivables; GH₵57,000 dead stock; sugar margin at 4.44%.
- 14-day forecast: +GH₵4,000 if customers pay on time, **−GH₵14,000** if not.

Ask: *"Sales are up but I'm running out of cash. Find the problem and tell
me what to do first."* The agent investigates with tools, TradeGuard
verifies each finding, and the owner approves a drafted payment reminder.

## Repo map

- `backend/agent/` — Meta tool-calling loop, tool registry, prompts
- `backend/finance/` — deterministic tools: revenue, margins,
  reconciliation, receivables, payables, inventory aging, cash forecast
- `backend/verification/` — TradeGuard evidence + verifier + action guard
- `backend/api/` — FastAPI: uploads, investigations, actions/approvals
- `backend/tests/` — pytest suite with deterministic expected outputs
- `data/demo/` — synthetic dataset + expected answers
- `docs/` — architecture, demo script, frontend plan

## Judging criteria

- **Impact (30%)** — cash-flow survival for distributors; one verified
  answer beats a dashboard of charts.
- **Meta tooling (25%)** — Muse drives hypothesis testing and tool
  selection via the Meta Model API.
- **Technical execution (20%)** — deterministic Decimal finance, evidence
  IDs on every claim, contradiction tests, audit trail.
- **Demo (25%)** — 3-minute cash-flow mystery, see `docs/demo-script.md`.
