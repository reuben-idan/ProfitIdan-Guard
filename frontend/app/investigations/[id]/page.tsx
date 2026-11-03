"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, type InvestigationRecord } from "@/lib/api";
import InvestigationPanel from "@/components/InvestigationPanel";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { ShareActions } from "@/components/FileDrop";
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

  if (error) return <p role="alert" className="text-sm text-red-900">Failed to load: {error}</p>;
  if (!record) return <LoadingSkeleton lines={6} />;

  const verified = record.verdicts.filter((v) => v.status === "verified").length;
  const summary = record.result.findings
    .slice(0, 3)
    .map((f) => `- ${f.title}: ${f.claim}`)
    .join("\n");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">
          Investigation <span className="font-mono">{params.id}</span> · {record.status}
          {" · "}{timeAgo((record as unknown as { created_at?: string }).created_at)}
          {record.demo_mode && (
            <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-900">
              Instant review
            </span>
          )}
        </p>
        <h1 className="mt-1 text-xl font-bold leading-snug sm:text-2xl">{record.question}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {verified} of {record.verdicts.length} findings verified against source records.
        </p>
      </div>
      <ShareActions title={`ProfitPilot review: ${record.question}`} text={summary || "No findings."} />
      <InvestigationPanel record={record} />
    </div>
  );
}
