export default function KpiCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad" | "neutral";
}) {
  const valueColor =
    tone === "good" ? "text-pine-700" : tone === "bad" ? "text-clay" : "text-ink";
  return (
    <div className="rounded-xl border border-ink/10 bg-white p-3.5 shadow-card">
      <p className="text-[13px] font-medium text-ink/60">{label}</p>
      <p className={`mt-1 break-words font-display text-[22px] font-bold leading-none tabular-nums ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-xs text-ink/55">{sub}</p>}
    </div>
  );
}
