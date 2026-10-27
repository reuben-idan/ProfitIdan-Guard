"use client";

import { useState } from "react";
import { api, type Finding, type Verdict } from "@/lib/api";
import EvidenceDrawer from "./EvidenceDrawer";

interface Step {
  tool: string;
  args: Record<string, unknown>;
  status: string;
  evidence_ids: string[];
}

const badge: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-800",
  unverified: "bg-amber-100 text-amber-800",
  contradicted: "bg-red-100 text-red-800",
};

export default function InvestigationPanel({
  record,
}: {
  record: {
    question: string;
    status: string;
    result: { steps: Step[]; findings: Finding[]; recommended_actions: Record<string, string>[]; narrative: string };
    verdicts: Verdict[];
  };
}) {
  const [draftMsg, setDraftMsg] = useState<string | null>(null);

  async function draft(action: Record<string, string>) {
    setDraftMsg(null);
    try {
      const res = await api.draftAction({
        type: ["payment_reminder", "supplier_review", "purchase_hold"].includes(action.type ?? "")
          ? (action.type as string)
          : "supplier_review",
        target: action.target ?? "unknown",
        amount: action.amount ?? "0.00",
        finding_ref: record.question,
        verified_amount: action.amount ?? "0.00",
      });
      setDraftMsg(`Drafted ${res.id}. Review it on the Actions page.`);
    } catch (err) {
      setDraftMsg(`Draft failed: ${(err as Error).message}`);
    }
  }

  const { steps, findings, recommended_actions, narrative } = record.result;
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold">What the agent did</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono font-semibold">{i + 1}.</span>
              <span className="font-mono">{s.tool}</span>
              <span className="text-slate-600">
                {s.status} · {s.evidence_ids.length} records
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Findings</h2>
        <div className="mt-2 space-y-3">
          {findings.map((f, i) => {
            const v = record.verdicts[i];
            return (
              <article key={i} className="rounded-lg border bg-white p-4">
                <div className="flex items-center gap-2">
                  {v && (
                    <span className={`rounded px-2 py-0.5 text-xs font-bold uppercase ${badge[v.status]}`}>
                      {v.status}
                    </span>
                  )}
                  <h3 className="font-semibold">{f.title ?? "(untitled)"}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-700">{f.claim}</p>
                <EvidenceDrawer finding={f} verdict={v} />
              </article>
            );
          })}
        </div>
        {narrative && <p className="mt-2 text-sm text-slate-700">Note: {narrative}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Recommended actions</h2>
        {draftMsg && <p className="mt-1 text-sm text-slate-700">{draftMsg}</p>}
        <ul className="mt-2 space-y-2">
          {recommended_actions.map((a, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3 text-sm"
            >
              <span>
                <strong>{a.type}</strong> — {a.target} · GH₵{a.amount}
                <span className="text-slate-600"> ({a.reason})</span>
              </span>
              <button
                onClick={() => draft(a)}
                className="rounded-md bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800"
              >
                Draft
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
