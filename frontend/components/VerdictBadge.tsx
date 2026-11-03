"use client";

const styles: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-900",
  unverified: "bg-amber-100 text-amber-900",
  contradicted: "bg-red-100 text-red-900",
};

export default function VerdictBadge({ status }: { status: string }) {
  const key = status.toLowerCase();
  return (
    <span
      className={`inline-block shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${styles[key] ?? "bg-slate-200 text-slate-800"}`}
    >
      {status}
    </span>
  );
}
