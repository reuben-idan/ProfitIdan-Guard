# ProfitPilot AI — Architecture

Frontier financial-operations agent for African wholesalers/distributors.
The Meta model investigates; deterministic code computes; TradeGuard verifies;
the owner approves. Demo customer: a fictional Ghanaian distributor (GHS).

## Components

- `backend/agent/` — investigation orchestrator. `MetaClient` talks to the
  Meta Model API (`muse-spark-1.3`, OpenAI-compatible, tool calling).
  `run_investigation` runs the observe -> hypothesize -> tool-call ->
  challenge -> conclude loop with a step budget. The model never computes
  money; it only selects tools and interprets their envelopes.
- `backend/agent/tools.py` — tool registry + JSON schemas exposed to the
  model. `run_tool` never raises: failures return error envelopes the agent
  can recover from.
- `backend/finance/` — deterministic tools (stdlib `csv` + `Decimal`):
  `summarize_revenue`, `calculate_product_margins`,
  `reconcile_bank_transactions`, `identify_unpaid_invoices`,
  `upcoming_payables`, `analyze_inventory_aging`, `forecast_cash_position`.
- `backend/verification/` — TradeGuard. `EvidenceRegistry` resolves every
  cited ID to a source row; `verify_finding` recomputes claimed amounts and
  returns `verified` / `unverified` / `contradicted`. `guard_action` gates
  consequential actions on a verified ceiling + explicit approval.
- `backend/api/` — FastAPI: `/uploads` (validate + store CSVs),
  `/investigations` (run agent, verify findings, persist), `/actions`
  (draft -> approve/reject -> simulated execute, with audit trail).
- `backend/models/store.py` — SQLite record of uploads, investigations,
  actions, and the audit trail.
- `data/demo/` — fictional dataset with planted problems and
  `expected_answers.md` (hand-computed; tests pin every figure).

## Tool envelope contract

Every tool returns:

    {"tool": str, "status": "success|error", "result": {...},
     "evidence_ids": [str], "assumptions": [str]}

Evidence IDs are source-record IDs (`INV-002`, `BANK-001`, `SUGAR-50KG`).
Assumptions are explicit: missing data is reported, never silently zeroed.

## Investigation flow

1. Owner asks a question (e.g. "sales are up but cash is gone — why?").
2. Orchestrator sends system prompt + tool schemas to the Meta model.
3. Model calls finance tools; backend executes and returns envelopes.
4. Model produces final JSON: findings (with evidence IDs + amount checks)
   and recommended actions.
5. TradeGuard verifies each finding independently.
6. Owner reviews evidence, approves/rejects drafted actions; all recorded.

## What is real vs simulated (MVP)

Real: CSV validation, all finance tools, verification, approval workflow,
audit log, SQLite persistence. Simulated with clear labels: external message
delivery (`executed_simulated`). Requires `MODEL_API_KEY`: live model runs;
without it, tests use a scripted fake client and `/investigations` 503s.
