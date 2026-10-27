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
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-emerald-700 underline-offset-2 hover:underline"
      >
        {open ? "Hide evidence" : "Show evidence"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md bg-slate-100 p-3 text-sm">
          <div>
            <span className="font-semibold">Records: </span>
            {(finding.evidence_ids ?? []).join(", ") || "none cited"}
          </div>
          {finding.amount_checks && finding.amount_checks.length > 0 && (
            <ul className="list-disc pl-5">
              {finding.amount_checks.map((c, i) => (
                <li key={i}>
                  {c.label}: {c.expected}
                  {c.tool ? ` (re-ran ${c.tool}, ${c.path})` : ""}
                </li>
              ))}
            </ul>
          )}
          {verdict ? (
            <ul className="space-y-1">
              {verdict.checks.map((c, i) => (
                <li key={i} className={c.passed ? "text-emerald-800" : "text-red-800"}>
                  {c.passed ? "PASS" : "FAIL"} — {c.check}: {c.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-600">No TradeGuard verdict for this finding.</p>
          )}
        </div>
      )}
    </div>
  );
}
