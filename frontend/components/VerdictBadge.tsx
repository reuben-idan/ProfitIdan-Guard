"use client";

const styles: Record<string, string> = {
  verified: "bg-pine-100 text-pine-900",
  unverified: "bg-gold-100 text-gold-800",
  contradicted: "bg-red-100 text-clay",
};

const dots: Record<string, string> = {
  verified: "bg-pine-600",
  unverified: "bg-gold-700",
  contradicted: "bg-clay",
};

export default function VerdictBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${styles[key] ?? "bg-ink/5 text-ink"}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dots[key] ?? "bg-ink/30"}`} />
      {status}
    </span>
  );
}
