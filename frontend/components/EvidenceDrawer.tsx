"use client";

import { useState } from "react";
import type { Finding, Verdict } from "@/lib/api";

export default function EvidenceDrawer({
  finding,
  verdict,
}: {
  finding: Finding;
  verdict?: Verdict;
}) {
  const [open, setOpen] = useState(false);
  const passed = verdict?.checks.filter((c) => c.passed).length ?? 0;
  const total = verdict?.checks.length ?? 0;
  return (
    <div className="mt-3 border-t border-ink/10 pt-2.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left text-sm font-semibold text-pine-800"
      >
        {open ? "Hide evidence" : `Show evidence${total ? ` · ${passed}/${total} checks pass` : ""}`}
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M3 6l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="space-y-3 rounded-lg bg-mist p-3.5 text-sm leading-relaxed">
          <p>
            <span className="font-semibold">Records: </span>
            <span className="break-words font-mono text-xs">
              {(finding.evidence_ids ?? []).join(", ") || "none cited"}
            </span>
          </p>
          {finding.amount_checks && finding.amount_checks.length > 0 && (
            <div>
              <p className="font-semibold">Recomputed amounts</p>
              <ul className="mt-1 space-y-1">
                {finding.amount_checks.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                    <span>{c.label}</span>
                    <span className="font-mono font-semibold">{c.expected}</span>
                    {c.tool && <span className="text-xs text-ink/55">(re-ran {c.tool})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {verdict ? (
            <div>
              <p className="font-semibold">TradeGuard checks</p>
              <ul className="mt-1 space-y-1.5">
                {verdict.checks.map((c, i) => (
                  <li key={i} className="flex gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.passed ? "bg-pine-600" : "bg-clay"}`}
                    />
                    <span className={c.passed ? "text-ink" : "font-medium text-clay"}>
                      <span className="font-mono text-xs font-bold">
                        {c.passed ? "PASS" : "FAIL"}
                      </span>{" "}
                      {c.check}: {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-ink/60">No TradeGuard verdict for this finding.</p>
          )}
        </div>
      )}
    </div>
  );
}
