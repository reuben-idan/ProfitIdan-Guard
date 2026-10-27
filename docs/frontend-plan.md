# Frontend plan (Next.js, target Oct 31)

Not built yet. When built: Next.js + TypeScript + Tailwind, `frontend/`
in this monorepo, talking to the FastAPI backend below. Nothing in the UI
may hard-code conclusions — every figure renders from API responses.

## Pages

- `/` — Ask view: dataset status cards (uploads + validation issues),
  question box with the demo question prefilled, "Investigate" button.
- `/investigations/[id]` — live step feed (tool name, args, status,
  evidence IDs), findings list with TradeGuard verdict badges
  (verified / unverified / contradicted), scenario table for the forecast.
- `/actions` — ranked action cards with draft text, Approve / Reject,
  audit trail per action, `executed_simulated` clearly labeled as demo.

## Components

- `DataUpload.tsx` — file picker -> POST `/uploads`; shows rows accepted
  and per-row issues.
- `InvestigationPanel.tsx` — polls GET `/investigations/[id]`; renders
  steps then findings.
- `EvidenceDrawer.tsx` — finding detail: claim, evidence IDs, recomputed
  amounts, assumptions, verdict checks.
- `ApprovalCard.tsx` — draft text, verified ceiling, Approve / Reject /
  Execute buttons; disables Execute until approved.
- `lib/api.ts` — typed fetch wrappers for the five endpoints.

## API surface (already implemented)

- GET `/health`
- POST `/uploads` `{filename, kind, content}`
- POST `/sessions` `{name}`, POST `/sessions/{id}/files`, POST `/sessions/{id}/meta`, GET `/sessions/{id}`
- POST `/investigations` `{question, data_dir?}` -> `{result, verdicts}`
- GET `/investigations/{id}`
- POST `/actions` `{type, target, amount, verified_amount, finding_ref?}`
- POST `/actions/{id}/approve|reject` `{approved_by}`
- POST `/actions/{id}/execute` (simulated)
- GET `/actions`, GET `/actions/{id}/audit`

## Notes

- Backend must enable CORS for the dev frontend origin before integration.
- Keep all money as strings end-to-end; format with `Intl.NumberFormat`.
