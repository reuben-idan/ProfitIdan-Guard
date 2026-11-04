"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, type InvestigationRecord } from "@/lib/api";
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

  return (
    <div className="space-y-4">
      <div>
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
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight tracking-tight sm:text-[32px]">
          {record.question}
        </h1>
        <p className="mt-1.5 text-sm text-ink/65">
          <strong className="font-display text-base text-pine-700 tabular-nums">{verified}</strong>{" "}
          of {record.verdicts.length} findings verified against source records.
        </p>
      </div>
      <ShareActions title={`ProfitPilot review: ${record.question}`} text={summary || "No findings."} />
      <InvestigationPanel record={record} />
    </div>
  );
}
