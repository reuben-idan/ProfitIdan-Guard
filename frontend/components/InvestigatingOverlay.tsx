"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "Reading your records",
  "Recomputing every figure",
  "Verifying claims with TradeGuard",
  "Ranking your next actions",
];

/** Full-screen wait state while an investigation runs: staged checklist
 * with honest pacing (instant reviews clear it in seconds). */
export default function InvestigatingOverlay({ fast }: { fast: boolean }) {
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const pace = fast ? 1400 : 9000;
    const advance = window.setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      pace
    );
    const clock = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      window.clearInterval(advance);
      window.clearInterval(clock);
    };
  }, [fast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center bg-pine-950/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop">
        <h2 className="font-display text-2xl font-bold tracking-tight">
          Investigating…
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          {fast
            ? "Instant review — usually just a few seconds."
            : "Full AI investigation — usually about a minute."}{" "}
          {elapsed > 0 && <span className="tabular-nums">({elapsed}s)</span>}
        </p>
        <ol className="mt-4 space-y-2.5">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    done
                      ? "bg-pine-700 text-white"
                      : active
                        ? "bg-pine-100 text-pine-800"
                        : "bg-ink/10 text-ink/40"
                  }`}
                >
                  {done ? "✓" : active ? <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-pine-700" /> : i + 1}
                </span>
                <span className={done || active ? "font-semibold" : "text-ink/50"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-ink/55">
          The review saves to History when it lands — feel free to wait here.
        </p>
      </div>
    </div>
  );
}
