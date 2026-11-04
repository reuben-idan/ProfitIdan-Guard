import { formatMoney } from "@/lib/format";

/** 14-day cash outlook: three honest bars from the deterministic forecast.
 * No chart library — pure markup, readable without CSS. */
export default function CashOutlook({
  cash,
  onTime,
  slip,
  currency,
}: {
  cash: string;
  onTime: string;
  slip: string;
  currency: string;
}) {
  const rows = [
    { label: "Cash today", value: Number(cash) || 0 },
    { label: "In 14 days · paid on time", value: Number(onTime) || 0 },
    { label: "In 14 days · if collections slip", value: Number(slip) || 0 },
  ];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));

  return (
    <figure className="rounded-xl border border-ink/10 bg-white p-4 shadow-card">
      <figcaption className="text-sm font-bold">14-day cash outlook</figcaption>
      <div className="mt-2.5 space-y-2.5">
        {rows.map((r) => {
          const negative = r.value < 0;
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="text-ink/65">{r.label}</span>
                <span
                  className={`font-display font-bold tabular-nums ${
                    negative ? "text-clay" : "text-ink"
                  }`}
                >
                  {formatMoney(r.value.toFixed(2), currency)}
                </span>
              </div>
              <div
                className="mt-1 h-2 overflow-hidden rounded-full bg-ink/10"
                role="img"
                aria-label={`${r.label}: ${formatMoney(r.value.toFixed(2), currency)}`}
              >
                <div
                  className={`h-full rounded-full ${negative ? "bg-clay" : "bg-pine-600"}`}
                  style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2.5 text-xs text-ink/55">
        Deterministic forecast from your records — no AI involved.
      </p>
    </figure>
  );
}
