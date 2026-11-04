"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type InvestigationSummary } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { Card, Pill } from "@/components/ui";
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
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Past investigations
        </h1>
        <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink/70">
          Every review is kept with its evidence and verdicts — your audit trail for the accountant.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-clay">
          Failed to load: {error}
        </p>
      )}
      {loading && <LoadingSkeleton lines={4} />}
      {!loading && items.length === 0 && !error && (
        <EmptyState
          title="No investigations yet"
          body="Ask your first question and the review will be saved here with its proof."
          actionHref="/"
          actionLabel="Ask a question"
        />
      )}
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/investigations/${item.id}`}
              className="block rounded-xl border border-ink/10 bg-white p-4 shadow-card transition hover:border-pine-700/50 active:scale-[0.99] sm:p-5"
            >
              <p className="break-words font-semibold leading-snug">{item.question}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink/55">
                <span className="font-mono">{item.id}</span>
                <span aria-hidden="true">·</span>
                <Pill tone={item.status === "completed" ? "ok" : "neutral"}>{item.status}</Pill>
                <span aria-hidden="true">·</span>
                {timeAgo(item.created_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && items.length > 0 && !error && (
        <Card className="px-4 py-3 text-sm text-ink/65">
          {items.length} review{items.length === 1 ? "" : "s"} on file. Note: on the free
          backend tier, history resets when the server sleeps — export anything you need.
        </Card>
      )}
    </div>
  );
}
