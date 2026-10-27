# Demo script — "The cash-flow mystery" (3 minutes)

Dataset: fictional Accra Foods Distributors Ltd. All figures are computed
live by the finance tools; expected values in `data/demo/expected_answers.md`.

## 0:00–0:25 — The problem

Owner: "My October sales hit GH₵120,000, up 27% on September — so why do I
only have GH₵8,000 in the bank with GH₵22,000 due in two weeks? Find the
problem and tell me what to do first."

## 0:25–0:55 — The agent investigates

Upload `sales.csv`, `bank.csv`, `invoices.csv` (validation report shown).
Ask the question. Show the model calling tools: `summarize_revenue`,
`reconcile_bank_transactions`, `identify_unpaid_invoices`,
`forecast_cash_position`, `analyze_inventory_aging`.

## 0:55–1:35 — The discovery

Agent reports, with evidence IDs:

- GH₵27,000 overdue: INV-002 (GH₵12,000, 12 days) + INV-005 balance
  (GH₵15,000, 38 days).
- October collected only GH₵25,000 of GH₵120,000 sold (~21%).
- GH₵57,000 dead stock (SOAP-BOX) + GH₵215,000 slow sugar (375 days cover).
- Sugar margin collapsed to 4.44% after a 13.16% cost rise.

## 1:35–2:15 — TradeGuard verifies

Open the evidence drawer for the lead finding: source rows, recomputed
total GH₵27,000, period, assumptions. Show a contradiction test: a claim of
GH₵37,000 from the same evidence comes back `contradicted` with the
recomputed figure. Note the slip scenario: if INV-003 also slips, the
14-day gap is GH₵14,000.

## 2:15–2:45 — The action

Ranked actions: (1) payment reminder to Tema Provisions GH₵15,000;
(2) reminder to Kumasi Mart GH₵12,000; (3) purchase hold on SUGAR-50KG /
SOAP-BOX; (4) supplier review for BILL-002. Draft the first reminder.
Show the guard: a GH₵99,999 draft against a GH₵27,000 verified ceiling is
rejected.

## 2:45–3:00 — The result

Owner approves. Audit trail shows drafted -> approved -> executed
(simulated delivery, clearly labeled). Closing line: "Sales are fine —
collections are the leak. Start with the two reminders."
