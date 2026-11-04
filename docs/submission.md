# Hackathon submission drafts — ProfitPilot AI

Deadline: **Wed Nov 4, 9:00 PM ET.** Submit at the CV platform submission
form (one submission per team). Track: **Indie developer**.
Problem statement: **Build for Your World**.

Pre-flight checklist (do these in the form + repo):

- [ ] Repository is **public** on GitHub.
- [ ] 3-minute demo video uploaded (unlisted YouTube is fine) — follow
  `docs/demo-script.md`: upload → ask → verified findings → approve action.
- [ ] All team members listed on the submission.
- [ ] Backend redeployed on Render (push to main auto-deploys) with
  `MODEL_NAME=muse-spark-1.3`, `META_API_BASE_URL=https://api.meta.ai/v1`,
  `MODEL_API_KEY` set; frontend `NEXT_PUBLIC_API_URL` points at Render.
- [ ] If competing for Most Viral ($20k): post the demo on X, paste the link.

## Project description (paste-ready, < 3000 chars)

ProfitPilot AI is the AI CFO for African wholesale distributors — owners who
see sales climbing while cash mysteriously disappears before payroll. The
owner uploads five record files (invoices, supplier bills, bank movements,
sales, inventory — CSV, TSV, JSON, or Excel) or starts with the built-in
Accra Foods demo, then asks a plain question by typing or voice: "Sales are
up but I'm running out of cash. Find the problem and tell me what to do
first."

A Muse Spark agent investigates with tools, not memory: it calls 10
deterministic finance tools (revenue, margins, bank reconciliation,
receivables, payables, inventory aging, cash forecast, KPIs, ranked
collections, customer exposure), all computed in Decimal code. Then
TradeGuard, our verification layer, independently re-runs every figure —
each finding is graded verified, unverified, or contradicted, with source
record IDs as evidence. Finally the agent drafts the highest cash-impact
next action (payment reminder, supplier review, purchase hold) as a
WhatsApp-ready message — but nothing sends without owner approval, and every
approval is audit-logged.

Without an API key the app still delivers value: Instant Review runs the
same tools and verifier deterministically in seconds, so judges and free-tier
deployments always see verified answers. The mobile-first UI adds a live
cash snapshot (no AI call needed), voice questions, CSV templates, history,
and an ROI-priced pricing page. Demo data is fully synthetic with planted,
hand-verified problems (GH₵27,000 overdue, −GH₵14,000 slip scenario).

## Describe your use of Meta products (< 3000 chars)

Reasoning: Muse Spark 1.3 (`muse-spark-1.3`) via the Meta Model API
(OpenAI-compatible chat completions with native tool calling) drives the
investigation agent in `backend/agent/orchestrator.py` — up to 8 tool-call
rounds guided by a CFO system prompt (`backend/agent/prompts.py`), with a
JSON-repair turn for robustness. The model selects hypotheses and tools;
deterministic Python computes every number.

Build speed: Muse Code (agentic CLI) authored the full stack during the
hackathon — FastAPI backend, 10 finance tools, TradeGuard verifier, Next.js
mobile-first frontend, and the 72-test pytest suite — with human review on
every diff.

Credits: $150 Meta Model API participant credits fund the live Full AI
Investigation path; Instant Review is keyless so the demo never depends on
quota.

## Why are Meta's models important to your solution? (< 3000 chars)

The core task is hypothesis-driven investigation, not retrieval: "sales up,
cash gone" could mean uncollected receivables, dead stock, thin margins, or
a payables crunch — and the right answer requires testing competing
explanations against the owner's own records. Muse Spark's tool-calling
reasoning does exactly this: it orients with a business snapshot, drills
into receivables/margins/inventory/bank evidence, revises when contradicted,
and ranks conclusions by 14-day cash impact. A smaller or non-tool model
could narrate; Muse plans a genuine audit trail (every step logged with
evidence IDs) and emits machine-checkable amount proofs that TradeGuard
re-executes. Without that reasoning quality, the product degrades to a
dashboard of charts — the verified "do this first" answer is the product.

## Biggest obstacle (short)

Free-tier production hardening under deadline: Render's ephemeral disk wipes
upload sessions on restart and cold-starts slowly, so we made the demo
dataset bulletproof (bundled in-repo, keyless Instant Review), switched
investigations to server-resolved session IDs with checklist errors naming
exactly which files are still missing, and persisted sessions in the browser
so a refresh never orphans uploads.

## Meta Model API likelihood / opinion (suggested)

- Build with again: very likely — OpenAI-compatible tool calling meant the
  agent loop worked first try.
- Opinion: positive — model quality on multi-step financial reasoning is
  strong; a Frankfurt-egress 404 on the model ID cost us a redeploy to
  Oregon (documented in `render.yaml`), so region transparency could improve.
- Recommend to others: yes for agentic tool-use workloads with verifiable
  outputs.
