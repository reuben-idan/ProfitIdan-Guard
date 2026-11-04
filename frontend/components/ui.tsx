import type { ReactNode } from "react";
import { formatMoney } from "@/lib/format";

/* Shared lightweight primitives: no client JS, just consistent styling. */

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border border-ink/10 bg-white shadow-card ${className}`}>
      {children}
    </div>
  );
}

const PILL_TONES: Record<string, string> = {
  ok: "bg-pine-100 text-pine-900",
  warn: "bg-gold-100 text-gold-800",
  bad: "bg-red-100 text-clay",
  info: "bg-sky-100 text-sky-900",
  neutral: "bg-ink/5 text-ink",
};

export function Pill({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: keyof typeof PILL_TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${PILL_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Live status dot: gentle ping when on, flat when off. */
export function LiveDot({ on, className = "" }: { on: boolean; className?: string }) {
  return (
    <span className={`relative inline-flex h-2 w-2 shrink-0 ${className}`} aria-hidden="true">
      {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pine-600 opacity-60" />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${on ? "bg-pine-600" : "bg-ink/25"}`} />
    </span>
  );
}

/** Money figure in the ledger serif with tabular numerals. */
export function Money({
  amount,
  currency,
  className = "",
}: {
  amount: string | number | null | undefined;
  currency?: string;
  className?: string;
}) {
  return <span className={`font-display tabular-nums ${className}`}>{formatMoney(amount, currency)}</span>;
}

/** Numbered step heading: serif numeral + title. */
export function Step({
  n,
  title,
  hint,
}: {
  n: string;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <h2 className="flex items-baseline gap-2.5 text-lg font-bold tracking-tight">
        <span className="font-display text-xl text-pine-700" aria-hidden="true">
          {n}
        </span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm leading-relaxed text-ink/70">{hint}</p>}
    </div>
  );
}

export const btnPrimary =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-pine-800 px-5 py-3 text-sm font-bold text-white shadow-card transition hover:bg-pine-900 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

export const btnLight =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-bold text-pine-900 shadow-card transition hover:bg-pine-50 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

export const btnOutline =
  "inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-pine-700 hover:text-pine-900 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

export const btnOutlineLight =
  "inline-flex min-h-[48px] items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100";

export const inputCls =
  "min-h-[48px] w-full rounded-lg border border-ink/15 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink/40 transition focus:border-pine-700";
