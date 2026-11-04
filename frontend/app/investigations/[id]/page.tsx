"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type InvestigationRecord } from "@/lib/api";
import CountUp from "@/components/CountUp";
import InsightCharts from "@/components/InsightCharts";
import InvestigationPanel from "@/components/InvestigationPanel";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { ShareActions } from "@/components/FileDrop";
import { Pill } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export default function InvestigationPage() {
  const params = useParams<{ id: string }>();
  const [record, setRecord] = useState<InvestigationRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInvestigation(params.id)
      .then((r) => setRecord(r))
      .catch((err) => setError((err as Error).message));
  }, [params.id]);

  if (error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-clay">
          Failed to load: {error}
        </p>
        <Link href="/" className="inline-block font-semibold text-pine-800 underline-offset-2 hover:underline">
          ← Start a new review
        </Link>
      </div>
    );
  }
  if (!record) return <LoadingSkeleton lines={5} />;

  const verified = record.verdicts.filter((v) => v.status === "verified").length;
  const summary = record.result.findings
    .slice(0, 3)
    .map((f) => `- ${f.title}: ${f.claim}`)
    .join("\n");
  const topCash = record.result.findings
    .filter((f) => f.cash_impact && Number(f.cash_impact) !== 0)
    .sort((a, b) => Math.abs(Number(b.cash_impact)) - Math.abs(Number(a.cash_impact)))[0];

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink/60">
        <Link href="/history" className="font-semibold text-pine-800 underline-offset-2 hover:underline">
          ← History
        </Link>
        <span className="font-mono">{params.id}</span>
        <span aria-hidden="true">·</span>
        {record.status}
        {" · "}{timeAgo((record as unknown as { created_at?: string }).created_at)}
        {record.demo_mode && <Pill tone="info">Instant review</Pill>}
      </p>
      <section className="overflow-hidden rounded-2xl bg-pine-900 p-5 text-white shadow-pop sm:p-6">
        <h1 className="max-w-2xl break-words text-lg font-bold leading-snug sm:text-xl">
          {record.question}
        </h1>
        {topCash ? (
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-white/15 pt-3">
            <div>
              <p className="text-[13px] text-pine-100/80">Largest cash impact · {topCash.title}</p>
              <CountUp
                amount={Number(topCash.cash_impact)}
                currency={topCash.currency ?? "GHS"}
                className="mt-0.5 block text-4xl font-bold sm:text-5xl"
              />
            </div>
            <p className="pb-1 text-sm text-pine-100/90">
              <strong className="font-display text-xl tabular-nums">{verified}</strong>
              <span className="text-pine-100/70">/{record.verdicts.length} verified</span>
            </p>
          </div>
        ) : (
          <p className="mt-3 border-t border-white/15 pt-3 text-sm text-pine-100/90">
            <strong className="font-display text-xl tabular-nums">{verified}</strong>
            <span className="text-pine-100/70">/{record.verdicts.length} findings verified against source records</span>
          </p>
        )}
      </section>
      <ShareActions title={`ProfitPilot review: ${record.question}`} text={summary || "No findings."} />
      <InsightCharts source={{ kind: "investigation", id: params.id }} question={record.question} />
      <InvestigationPanel record={record} />
    </div>
  );
}
