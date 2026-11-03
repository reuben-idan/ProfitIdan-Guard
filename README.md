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

Frontend (needs the backend running on port 8000):

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 in a browser: assemble a dataset (or use the
demo data), ask the demo question by typing or voice, review evidence with
TradeGuard verdicts, then approve actions on the Actions page. Set
`NEXT_PUBLIC_API_URL` if the backend runs elsewhere. The UI is mobile-first
with a bottom nav, live cash snapshot, CSV templates, WhatsApp sharing, and a
pricing page with an ROI calculator.

Run an investigation from the CLI (works without a key in demo mode; set
`MODEL_API_KEY` in `.env` for the live Muse model):

```powershell
python -m backend.investigate --data data/demo "Sales are up but I'm running out of cash. Find the problem and tell me what to do first."
```

Or run the full story end to end (investigate → verify → draft → approve →
audit), no servers needed:

```powershell
python demo.py --yes
```

To investigate your own files: create a session (`POST /sessions`), upload
each CSV into it (`POST /sessions/{id}/files`), set its meta
(`POST /sessions/{id}/meta`), then investigate with `--data` pointing at the
session path (or `data_dir` in the API).

## The demo story

Fictional Accra Foods Distributors Ltd (all data synthetic, planted
problems, hand-verified answers in `data/demo/expected_answers.md`):

- October sales GH₵120,000 (+27.39%) — yet only GH₵8,000 cash on hand.
- GH₵27,000 overdue receivables; GH₵57,000 dead stock; sugar margin at 4.44%.
- 14-day forecast: +GH₵4,000 if customers pay on time, **−GH₵14,000** if not.

Ask: *"Sales are up but I'm running out of cash. Find the problem and tell
me what to do first."* The agent investigates with tools, TradeGuard
verifies each finding, and the owner approves a drafted payment reminder.

## Deploy

- Backend API: Render free tier via [render.yaml](render.yaml) — see
  [docs/render-deploy.md](docs/render-deploy.md).
- Frontend: Vercel project with Root Directory `frontend` and
  `NEXT_PUBLIC_API_URL` pointing at the Render service URL.

## Repo map

- `backend/agent/` — Meta tool-calling loop, tool registry, prompts,
  deterministic demo-mode fallback (same tools, no model call)
- `backend/finance/` — deterministic tools: revenue, margins,
  reconciliation, receivables, payables, inventory aging, cash forecast,
  plus KPIs, ranked collections, customer exposure
- `backend/verification/` — TradeGuard evidence + verifier + action guard
- `backend/api/` — FastAPI: uploads + CSV templates, sessions + live
  snapshot, investigations (list included), actions/approvals with
  WhatsApp-ready drafts
- `backend/investigate.py` — CLI runner (`--demo` for keyless reviews)
- `demo.py` — full story runner, no servers needed
- `backend/tests/` — pytest suite with deterministic expected outputs
- `frontend/` — Next.js app: mobile-first assembly, voice questions,
  investigation review, history, approvals, pricing/ROI
- `data/demo/` — synthetic dataset + expected answers
- `docs/` — architecture, demo script, frontend plan, monetization

## Judging criteria

- **Impact (30%)** — cash-flow survival for distributors; one verified
  answer beats a dashboard of charts.
- **Meta tooling (25%)** — Muse drives hypothesis testing and tool
  selection via the Meta Model API.
- **Technical execution (20%)** — deterministic Decimal finance, evidence
  IDs on every claim, contradiction tests, audit trail.
- **Demo (25%)** — 3-minute cash-flow mystery, see `docs/demo-script.md`.
