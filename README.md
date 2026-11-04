# ProfitPilot AI — the AI CFO for African distributors

[![Meta Global AI Hackathon](https://img.shields.io/badge/Meta_Global_AI_Hackathon-2026-0467DF)](https://cerebralvalley.ai/e/meta-ai-developer-hackathon)
[![Build for Your World](https://img.shields.io/badge/Build_for_Your_World-Indie_Track-0e4a34)](docs/submission.md)
[![Muse Spark](https://img.shields.io/badge/Muse_Spark-1.3-0467DF)](https://dev.meta.ai/models/muse-spark)
[![Tests](https://img.shields.io/badge/pytest-81_passed-1c6a4c)](backend/tests)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](backend)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](frontend)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?logo=fastapi)](backend/main.py)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Investigates profit leaks, verifies financial evidence, anticipates
cash-flow risk, and prepares the next best business action — with human
approval. Built for the **Meta Global AI Developer Hackathon**
(**Build for Your World**, Indie track).

**Core promise:** don't just tell an owner what is wrong. Show the evidence,
verify the numbers, explain what happens next, and prepare a defensible
response. **Muse Spark** reasons via the Meta Model API; deterministic
finance code computes every figure; **TradeGuard** re-verifies each claim;
controlled execution drafts WhatsApp-ready actions that nothing sends without
owner approval.

**Live demo:** https://frontend-five-ebon-61.vercel.app/

## How it works

1. **Bring records** — upload 5 files (invoices, supplier bills, bank,
   sales, inventory; CSV, TSV, JSON, or XLSX) or start with the bundled demo.
   Bad rows are flagged, never silently dropped.
2. **Ask plainly** — type or speak the question you'd ask an accountant.
3. **Agent investigates** — Muse Spark runs up to 8 tool-call rounds over 10
   deterministic Decimal finance tools, then TradeGuard grades every finding
   `verified` / `unverified` / `contradicted` with source record IDs.
4. **Approve the move** — the top cash-impact action is drafted
   (payment reminder, supplier review, purchase hold), audit-logged, and sent
   only on approval.

No API key? **Instant Review** runs the same tools + verifier
deterministically in seconds, so the demo never depends on quota.

## Meta products used

- **Muse Spark 1.3** (`muse-spark-1.3`) through the **Meta Model API**
  (OpenAI-compatible tool calling) — hypothesis-driven investigation loop
  in `backend/agent/orchestrator.py`, CFO prompt in `backend/agent/prompts.py`.
- **Muse Code** — agentic CLI used to build the full stack during the event.
- **$150 participant API credits** fund the live Full AI Investigation path.

Why Muse matters: the task is testing competing explanations against the
owner's own records (uncollected receivables? dead stock? thin margins?
payables crunch?) — Muse plans a genuine audit trail with machine-checkable
amount proofs instead of narrating vibes. Details: [docs/submission.md](docs/submission.md).

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

Frontend (needs the backend on port 8000):

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:3000: assemble a dataset (or use demo data), ask the
demo question by typing or voice, review TradeGuard-graded evidence, then
approve actions on the Actions page. Set `NEXT_PUBLIC_API_URL` if the
backend runs elsewhere. Mobile-first with bottom nav, live cash snapshot,
CSV templates, WhatsApp sharing, history, and pricing with ROI calculator.

CLI investigation (demo mode works without a key; set `MODEL_API_KEY` in
`.env` for live Muse):

```powershell
python -m backend.investigate --data data/demo "Sales are up but I'm running out of cash. Find the problem and tell me what to do first."
```

Full story end to end (investigate → verify → draft → approve → audit),
no servers needed:

```powershell
python demo.py --yes
```

Own files via API: create a session (`POST /sessions`), upload each dataset
(`POST /sessions/{id}/files`), set meta (`POST /sessions/{id}/meta`), then
investigate with `session_id` in `POST /investigations`.

## The demo story

Fictional Accra Foods Distributors Ltd (all data synthetic, planted
problems, hand-verified answers in `data/demo/expected_answers.md`):

- October sales GH₵120,000 (+27.39%) — yet only GH₵8,000 cash on hand.
- GH₵27,000 overdue receivables; GH₵57,000 dead stock; sugar margin at 4.44%.
- 14-day forecast: +GH₵4,000 if customers pay on time, **−GH₵14,000** if not.

Ask: *"Sales are up but I'm running out of cash. Find the problem and tell
me what to do first."* The agent investigates with tools, TradeGuard
verifies each finding, and the owner approves a drafted payment reminder.
Script: [docs/demo-script.md](docs/demo-script.md).

## Deploy

- Backend API: Render free tier via [render.yaml](render.yaml) — see
  [docs/render-deploy.md](docs/render-deploy.md). Push to `main` auto-deploys.
- Frontend: Vercel project, Root Directory `frontend`, `NEXT_PUBLIC_API_URL`
  pointing at the Render service URL. Push to `main` auto-deploys.
  Live: https://frontend-five-ebon-61.vercel.app/

## Submission

Track: **Indie developer** · Problem statement: **Build for Your World**.
Paste-ready form answers and the pre-flight checklist live in
[docs/submission.md](docs/submission.md). Deadline: Nov 4, 9:00 PM ET.

## Repo map

- `backend/agent/` — Muse tool-calling loop, tool registry, prompts,
  deterministic demo-mode fallback (same tools, no model call)
- `backend/finance/` — revenue, margins, reconciliation, receivables,
  payables, inventory aging, cash forecast, KPIs, ranked collections,
  customer exposure, chart series (all Decimal, stdlib-only)
- `backend/verification/` — TradeGuard evidence + verifier + action guard
- `backend/api/` — FastAPI: uploads + CSV templates, sessions + live
  snapshot, session-backed investigations, chart series per session and per
  investigation, actions/approvals with WhatsApp-ready drafts
- `backend/investigate.py` — CLI runner (`--demo` for keyless reviews)
- `demo.py` — full story runner, no servers needed
- `backend/tests/` — 81-test pytest suite with deterministic expected outputs
- `frontend/` — Next.js app: mobile-first assembly, voice questions,
  investigation review, live insight charts (SVG, downloadable),
  history, approvals, pricing/ROI
- `data/demo/` — synthetic dataset + expected answers
- `docs/` — architecture, demo script, submission drafts, monetization

## Judging criteria

- **Impact (30%)** — cash-flow survival for distributors; one verified
  answer beats a dashboard of charts.
- **Meta tooling (25%)** — Muse drives hypothesis testing and tool
  selection via the Meta Model API.
- **Technical execution (20%)** — deterministic Decimal finance, evidence
  IDs on every claim, contradiction tests, audit trail.
- **Demo (25%)** — 3-minute cash-flow mystery, see `docs/demo-script.md`.

## License

MIT — see [LICENSE](LICENSE).
