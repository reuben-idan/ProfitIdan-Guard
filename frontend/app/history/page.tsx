"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type InvestigationSummary } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { timeAgo } from "@/lib/format";

export default function HistoryPage() {
  const [items, setItems] = useState<InvestigationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listInvestigations()
      .then((res) => {
        setItems(res.investigations);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Past investigations</h1>
        <p className="mt-1 text-sm text-slate-700">
          Every review is kept with its evidence and verdicts — your audit trail for the accountant.
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-red-900">Failed to load: {error}</p>}
      {loading && <LoadingSkeleton lines={5} />}
      {!loading && items.length === 0 && !error && (
        <EmptyState
          title="No investigations yet"
          body="Ask your first question and the review will be saved here with its proof."
          actionHref="/"
          actionLabel="Ask a question"
        />
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/investigations/${item.id}`}
              className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-700"
            >
              <p className="font-medium leading-snug">{item.question}</p>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-mono">{item.id}</span> · {item.status} · {timeAgo(item.created_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
