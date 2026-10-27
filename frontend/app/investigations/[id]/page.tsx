"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import InvestigationPanel from "@/components/InvestigationPanel";

export default function InvestigationPage() {
  const params = useParams<{ id: string }>();
  const [record, setRecord] = useState<Parameters<typeof InvestigationPanel>[0]["record"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInvestigation(params.id)
      .then((r) => setRecord(r as unknown as Parameters<typeof InvestigationPanel>[0]["record"]))
      .catch((err) => setError((err as Error).message));
  }, [params.id]);

  if (error) return <p className="text-sm text-red-800">Failed to load: {error}</p>;
  if (!record) return <p className="text-sm text-slate-700">Loading investigation…</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-slate-600">
          Investigation <span className="font-mono">{params.id}</span> · {record.status}
        </p>
        <h1 className="text-xl font-bold">{record.question}</h1>
      </div>
      <InvestigationPanel record={record} />
    </div>
  );
}
