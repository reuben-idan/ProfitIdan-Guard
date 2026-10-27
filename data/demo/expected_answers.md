# Demo dataset: expected answers

Fictional Ghanaian wholesaler: **Accra Foods Distributors Ltd**.
Currency GHS. All figures below are independently hand-computed and asserted
in `backend/tests/test_finance.py`. If the agent disagrees with this file,
the agent is wrong.

As-of date: 2026-10-27. Opening cash 2026-10-01: GH₵20,000.00.

## Planted problems

1. **Overdue receivables (GH₵27,000):** INV-002 (Kumasi Mart, GH₵12,000,
   12 days overdue) and INV-005 balance (Tema Provisions, GH₵15,000,
   38 days overdue).
2. **Dead stock:** SOAP-BOX, 600 units x GH₵95 = GH₵57,000 tied up, zero
   sales in the trailing 30 days.
3. **Slow-moving stock:** SUGAR-50KG, 500 units on hand vs 40/month sales
   = 375 days of cover, GH₵215,000 tied up.
4. **Margin collapse:** SUGAR-50KG unit cost rose GH₵380 -> GH₵430
   (+13.16%); margin fell to 4.44%.
5. **Cash crunch:** only GH₵8,000 cash against GH₵22,000 payables due in
   14 days. Even if INV-003 (GH₵18,000, due Oct 31) arrives on time, the
   buffer is GH₵4,000; if collections slip as before, the gap is
   GH₵14,000.

## Revenue

- Sep 2026 revenue: GH₵94,200.00 (4 sales)
- Oct 2026 revenue: GH₵120,000.00 (4 sales)
- Growth: +27.39%

## Product margins (Oct 2026)

| Product    | Revenue     | COGS       | Gross profit | Margin |
| ---------- | ----------- | ---------- | ------------ | ------ |
| RICE-25KG  | 64,000.00   | 52,000.00  | 12,000.00    | 18.75% |
| OIL-5L     | 27,000.00   | 22,500.00  | 4,500.00     | 16.67% |
| SUGAR-50KG | 18,000.00   | 17,200.00  | 800.00       | 4.44%  |
| MILK-CRT   | 11,000.00   | 9,500.00   | 1,500.00     | 13.64% |
| Total      | 120,000.00  | 101,200.00 | 18,800.00    | 15.67% |

Alert: SUGAR-50KG margin 4.44% is below the 10% threshold.

## Receivables (as of 2026-10-27)

- Total outstanding: GH₵65,000.00
- Overdue: GH₵27,000.00 (INV-002 GH₵12,000 + INV-005 GH₵15,000)
- Due within 14 days: GH₵18,000.00 (INV-003)

## Payables due within 14 days

- BILL-002 GH₵14,000.00 + BILL-003 GH₵8,000.00 = GH₵22,000.00
- Overdue: GH₵0.00

## Bank reconciliation

- Opening (Oct 1): GH₵20,000.00
- Movements: GH₵-12,000.00
- Closing (Oct 27): GH₵8,000.00
- Matched: BANK-001/INV-001 (full), BANK-003/INV-005 (recorded
  part-payment), BANK-002/BILL-001 (full)
- Unmatched (no reference): BANK-004, BANK-005, BANK-006
- Discrepancies: none

## Inventory aging (30-day window)

| Product    | On hand | Value      | Sold/30d | Cover         |
| ---------- | ------- | ---------- | -------- | ------------- |
| RICE-25KG  | 400     | 104,000.00 | 200      | 60 days       |
| OIL-5L     | 300     | 45,000.00  | 150      | 60 days       |
| SUGAR-50KG | 500     | 215,000.00 | 40       | 375 days      |
| MILK-CRT   | 120     | 22,800.00  | 50       | 72 days       |
| SOAP-BOX   | 600     | 57,000.00  | 0        | dead stock    |

Total stock value: GH₵443,800.00.

## 14-day cash forecast (as of 2026-10-27)

- Cash on hand: GH₵8,000.00
- Receivables due in window: GH₵18,000.00
- Payables due in window: GH₵22,000.00
- Scenario A (collections on time): +GH₵4,000.00
- Scenario B (receivables slip): -GH₵14,000.00
