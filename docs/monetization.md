# Monetization — how ProfitPilot earns its keep

One recovered invoice covers years of subscription. Pricing is anchored to
cash recovered, not seats or dashboards.

## Tiers

| Tier | Price | What it includes |
| ---- | ----- | ---------------- |
| Try | GH₵0 | Demo dataset, 3 instant reviews, 1 WhatsApp-ready draft |
| Distributor | GH₵450/mo (~$30) | Unlimited instant reviews, 40 AI investigations, own CSVs, live snapshot, unlimited drafts + audit trail, weekly cash-risk alert |
| Accountant | GH₵1,800/mo (~$120) | 5 client businesses, exportable evidence packs, priority WhatsApp support |

Annual billing: 2 months free. Mobile-money (MTN MoMo) and card via Paystack.

## Why this works

- **Value metric is cash, not usage.** The ROI calculator on `/pricing` shows
  recoverable overdue × recovery rate against the plan price. Demo math:
  GH₵27,000 overdue × 40% recovery = GH₵10,800 — 24× the monthly plan.
- **Verification is the moat.** Dashboards show numbers; ProfitPilot proves
  them against source rows and fails loudly on contradiction. Accountants
  stake their reputation on that trail.
- **WhatsApp is the workflow.** Distributors live on phones and WhatsApp.
  Drafts are copy-paste-ready; the approval gate keeps the owner in control.
- **Land with instant review, expand with AI.** The deterministic engine is
  nearly free to run (no model tokens), so the free tier costs almost nothing
  while proving value. AI investigations are the metered premium.

## Unit economics (rough)

- Instant review: ~$0 compute (local Decimal code + SQLite).
- AI investigation: ~$0.15–0.60 in Muse tokens (8 tool steps, short context).
- Distributor plan at $30/mo with 40 AI investigations included: gross margin
  stays above 70% at typical use (most days use the free snapshot; owners run
  2–4 deep investigations per month).

## Go-to-market (Ghana first, then Nigeria/Kenya)

1. Makola/Kumasi distributor pilots: 10 owners, free month, collect recovery stories.
2. Accountant channel: 3 firms run client month-ends on evidence packs.
3. Demo video + open-source repo → hackathon judges, then Product Hunt / tech Twitter.
4. Mobile-money billing and Twi/Ga/Hausa prompt templates remove adoption friction.

## What to build next for revenue

- Paystack subscription + usage metering (investigations/month, drafts sent).
- Scheduled cash-risk alerts (email/WhatsApp) — the retention hook.
- Evidence-pack PDF export for accountants (per-pack upsell).
- Multi-business workspaces (Accountant tier enforcement).
