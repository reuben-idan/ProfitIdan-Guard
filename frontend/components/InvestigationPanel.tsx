"use client";

import { useMemo, useState } from "react";
import { api, type InvestigationRecord } from "@/lib/api";
import { formatMoney, severityRank, symbolFor } from "@/lib/format";
import EvidenceDrawer from "./EvidenceDrawer";
import VerdictBadge from "./VerdictBadge";
import { Card } from "./ui";

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-clay text-white",
  high: "bg-red-100 text-clay",
  medium: "bg-gold-100 text-gold-800",
  low: "bg-ink/5 text-ink/70",
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
      {!record.result.completed && (
        <p
          role="alert"
          className="rounded-xl border border-gold-700/30 bg-gold-100/60 px-4 py-3 text-sm leading-relaxed text-gold-800"
        >
          <strong>Incomplete investigation.</strong> The model&apos;s final answer could not be
          read, so findings below may be partial. The tool steps ran — re-run, or use Instant
          review for a deterministic answer from the same records.
        </p>
      )}
      <Card className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5">
        <p className="text-sm font-bold">TradeGuard</p>
        <p className="font-display text-lg font-bold text-pine-700 tabular-nums">
          {counts.verified} <span className="font-sans text-xs font-semibold text-ink/60">verified</span>
        </p>
        <p className="font-display text-lg font-bold text-gold-800 tabular-nums">
          {counts.unverified} <span className="font-sans text-xs font-semibold text-ink/60">unverified</span>
        </p>
        <p className="font-display text-lg font-bold text-clay tabular-nums">
          {counts.contradicted} <span className="font-sans text-xs font-semibold text-ink/60">contradicted</span>
        </p>
        <p className="text-xs text-ink/55">{steps.length} tool calls · every figure recomputed</p>
      </Card>

      <section>
        <h2 className="text-lg font-bold tracking-tight">Findings, worst first</h2>
        <div className="mt-2.5 space-y-3">
          {ordered.map(({ finding: f, verdict: v }) => (
            <Card key={`${f.title}`} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                {v && <VerdictBadge status={v.status} />}
                {f.severity && (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${SEVERITY_STYLE[f.severity.toLowerCase()] ?? "bg-ink/5 text-ink"}`}>
                    {f.severity}
                  </span>
                )}
                {f.cash_impact && f.cash_impact !== "0.00" && (
                  <span className="text-xs font-semibold text-ink/70">
                    cash impact <span className="font-display text-sm">{formatMoney(f.cash_impact, f.currency)}</span>
                  </span>
                )}
              </div>
              <h3 className="mt-2 break-words font-bold leading-snug">{f.title ?? "(untitled)"}</h3>
              <p className="mt-1 break-words text-sm leading-relaxed text-ink/80">{f.claim}</p>
              <EvidenceDrawer finding={f} verdict={v} />
            </Card>
          ))}
        </div>
        {narrative && (
          <p className="mt-2.5 break-words text-sm leading-relaxed text-ink/60">Note: {narrative}</p>
        )}
      </section>

      <section>
        <h2 className="text-lg font-bold tracking-tight">Do this first</h2>
        <p className="mt-0.5 text-sm text-ink/60">
          Ranked by cash freed fastest. Drafting prepares a message — approval still required.
        </p>
        {recommended_actions.length === 0 && (
          <p className="mt-2 rounded-lg bg-mist px-3.5 py-2.5 text-sm text-ink/60">
            No actions were drafted for this run.
          </p>
        )}
        {draftMsg && <p role="status" className="mt-2 rounded-lg bg-pine-50 px-3.5 py-2.5 text-sm text-pine-900">{draftMsg}</p>}
        <ol className="mt-2.5 space-y-2.5">
          {recommended_actions.map((a, i) => (
            <li key={i}>
              <Card className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine-800 font-display text-sm font-bold text-white"
                  >
                    {i + 1}
                  </span>
                  <div className="text-sm">
                    <p>
                      <strong>{a.type?.replace(/_/g, " ")}</strong> — {a.target} ·{" "}
                      <span className="font-display font-bold tabular-nums">
                        {symbolFor(currency)}{a.amount}
                      </span>
                    </p>
                    <p className="mt-0.5 leading-relaxed text-ink/65">
                      {a.reason}
                      {a.timeframe_days ? ` · act within ${a.timeframe_days} days` : ""}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => draft(a, i)}
                  disabled={drafting === i}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg bg-pine-800 px-5 py-2 text-sm font-bold text-white transition hover:bg-pine-900 active:scale-[0.98] disabled:opacity-40 sm:self-center"
                >
                  {drafting === i ? "Drafting…" : "Draft"}
                </button>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="text-lg font-bold tracking-tight">What the agent checked</h2>
        <ol className="mt-2 divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white text-sm shadow-card">
          {steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2.5 px-4 py-2.5">
              <span className="font-display font-bold text-pine-700 tabular-nums">{i + 1}.</span>
              <span className="font-mono text-[13px] font-semibold">{s.tool}</span>
              <span className="text-ink/55">
                {s.status} · {s.evidence_ids.length} records
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
