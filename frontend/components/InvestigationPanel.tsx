"use client";

import { useMemo, useState } from "react";
import { api, type InvestigationRecord } from "@/lib/api";
import { formatMoney, severityRank, symbolFor } from "@/lib/format";
import EvidenceDrawer from "./EvidenceDrawer";
import VerdictBadge from "./VerdictBadge";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-800 text-white",
  high: "bg-red-100 text-red-900",
  medium: "bg-amber-100 text-amber-900",
  low: "bg-slate-200 text-slate-800",
};

export default function InvestigationPanel({ record }: { record: InvestigationRecord }) {
  const [draftMsg, setDraftMsg] = useState<string | null>(null);
  const [drafting, setDrafting] = useState<number | null>(null);

  const ordered = useMemo(() => {
    return record.result.findings
      .map((finding, index) => ({ finding, verdict: record.verdicts[index], index }))
      .sort((a, b) => severityRank(a.finding.severity) - severityRank(b.finding.severity));
  }, [record]);

  const counts = useMemo(() => {
    const tally = { verified: 0, unverified: 0, contradicted: 0 };
    for (const v of record.verdicts) {
      if (v.status in tally) tally[v.status as keyof typeof tally] += 1;
    }
    return tally;
  }, [record]);

  const currency = record.result.findings[0]?.currency ?? "GHS";

  async function draft(action: InvestigationRecord["result"]["recommended_actions"][number], i: number) {
    setDrafting(i);
    setDraftMsg(null);
    try {
      const res = await api.draftAction({
        type: ["payment_reminder", "supplier_review", "purchase_hold"].includes(action.type ?? "")
          ? (action.type as string)
          : "supplier_review",
        target: action.target ?? "unknown",
        amount: action.amount ?? "0.00",
        finding_ref: record.question.slice(0, 120),
        verified_amount: action.amount ?? "0.00",
        currency,
      });
      setDraftMsg(`Drafted ${res.id}. Review it on the Actions page — nothing sends itself.`);
    } catch (err) {
      setDraftMsg(`Draft failed: ${(err as Error).message}`);
    } finally {
      setDrafting(null);
    }
  }

  const { steps, recommended_actions, narrative } = record.result;
  return (
    <div className="space-y-6">
      <section aria-label="Verification summary" className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="font-semibold">TradeGuard:</span>
          <span><strong className="text-emerald-800">{counts.verified}</strong> verified</span>
          <span><strong className="text-amber-800">{counts.unverified}</strong> unverified</span>
          <span><strong className="text-red-800">{counts.contradicted}</strong> contradicted</span>
          <span className="text-slate-500">· {steps.length} tool calls · every figure recomputed</span>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold">Findings, worst first</h2>
        <div className="mt-2 space-y-3">
          {ordered.map(({ finding: f, verdict: v }) => (
            <article key={`${f.title}`} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                {v && <VerdictBadge status={v.status} />}
                {f.severity && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${SEVERITY_STYLE[f.severity.toLowerCase()] ?? "bg-slate-200 text-slate-800"}`}>
                    {f.severity}
                  </span>
                )}
                {f.cash_impact && f.cash_impact !== "0.00" && (
                  <span className="text-xs font-semibold text-slate-700">
                    cash impact {formatMoney(f.cash_impact, f.currency)}
                  </span>
                )}
              </div>
              <h3 className="mt-2 font-semibold">{f.title ?? "(untitled)"}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{f.claim}</p>
              <EvidenceDrawer finding={f} verdict={v} />
            </article>
          ))}
        </div>
        {narrative && <p className="mt-2 text-sm text-slate-600">Note: {narrative}</p>}
      </section>

      <section>
        <h2 className="text-lg font-bold">Do this first</h2>
        <p className="mt-0.5 text-sm text-slate-600">
          Ranked by cash freed fastest. Drafting prepares a message — approval still required.
        </p>
        {draftMsg && <p role="status" className="mt-2 rounded-md bg-slate-100 p-3 text-sm">{draftMsg}</p>}
        <ol className="mt-2 space-y-2">
          {recommended_actions.map((a, i) => (
            <li key={i} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-800 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <strong>{a.type?.replace(/_/g, " ")}</strong> — {a.target} ·{" "}
                  <span className="font-mono font-semibold">
                    {symbolFor(currency)}{a.amount}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => draft(a, i)}
                  disabled={drafting === i}
                  className="min-h-[44px] rounded-md bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-900 disabled:opacity-40"
                >
                  {drafting === i ? "Drafting…" : "Draft"}
                </button>
              </div>
              <p className="mt-1 text-slate-600">
                {a.reason}
                {a.timeframe_days ? ` · act within ${a.timeframe_days} days` : ""}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-bold">What the agent checked</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {steps.map((s, i) => (
            <li key={i} className="flex flex-wrap gap-x-2 gap-y-0.5 rounded-md bg-white px-3 py-2">
              <span className="font-mono font-semibold text-slate-500">{i + 1}.</span>
              <span className="font-mono">{s.tool}</span>
              <span className="text-slate-600">
                {s.status} · {s.evidence_ids.length} records
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
