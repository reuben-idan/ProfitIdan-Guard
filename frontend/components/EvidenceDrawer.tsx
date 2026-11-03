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
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="min-h-[44px] text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
      >
        {open ? "Hide evidence" : `Show evidence${total ? ` (${passed}/${total} checks pass)` : ""}`}
      </button>
      {open && (
        <div className="mt-1 space-y-2 rounded-md bg-slate-100 p-3 text-sm">
          <p>
            <span className="font-semibold">Records: </span>
            <span className="break-words font-mono text-xs">
              {(finding.evidence_ids ?? []).join(", ") || "none cited"}
            </span>
          </p>
          {finding.amount_checks && finding.amount_checks.length > 0 && (
            <div>
              <p className="font-semibold">Recomputed amounts</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {finding.amount_checks.map((c, i) => (
                  <li key={i}>
                    {c.label}: <span className="font-mono">{c.expected}</span>
                    {c.tool ? <span className="text-slate-600"> (re-ran {c.tool})</span> : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {verdict ? (
            <div>
              <p className="font-semibold">TradeGuard checks</p>
              <ul className="mt-1 space-y-1">
                {verdict.checks.map((c, i) => (
                  <li key={i} className={c.passed ? "text-emerald-900" : "text-red-900"}>
                    <span className="font-mono text-xs font-bold">{c.passed ? "PASS" : "FAIL"}</span>
                    {" — "}
                    {c.check}: {c.detail}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-slate-600">No TradeGuard verdict for this finding.</p>
          )}
        </div>
      )}
    </div>
  );
}
