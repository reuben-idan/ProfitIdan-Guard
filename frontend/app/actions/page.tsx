"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Action } from "@/lib/api";
import ApprovalCard from "@/components/ApprovalCard";
import EmptyState from "@/components/EmptyState";
import LoadingSkeleton from "@/components/LoadingSkeleton";

const FILTERS = ["all", "draft", "approved", "rejected", "executed_simulated"] as const;

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const load = useCallback(() => {
    setLoading(true);
    api
      .listActions()
      .then((res) => {
        setActions(res.actions);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = filter === "all" ? actions : actions.filter((a) => a.status === filter);
  const drafts = actions.filter((a) => a.status === "draft").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Actions awaiting review
        </h1>
        <p className="mt-1.5 max-w-xl text-[15px] leading-relaxed text-ink/70">
          {drafts > 0 ? (
            <>
              <strong className="text-ink">{drafts} draft{drafts === 1 ? "" : "s"} need{drafts === 1 ? "s" : ""} your decision.</strong>{" "}
            </>
          ) : (
            "All caught up. "
          )}
          Nothing executes without your approval. Execution is simulated for the demo.
        </p>
      </div>
      <div className="no-print -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter by status">
        <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`min-h-[44px] shrink-0 rounded-full border px-4 py-2 text-[13px] font-semibold transition active:scale-[0.98] ${
                filter === f
                  ? "border-pine-800 bg-pine-800 text-white"
                  : "border-ink/15 bg-white text-ink/70 hover:border-pine-700/50"
              }`}
            >
              {f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-clay">
          Failed to load: {error}
        </p>
      )}
      {loading && <LoadingSkeleton lines={3} />}
      {!loading && shown.length === 0 && !error && (
        <EmptyState
          title={filter === "all" ? "No actions yet" : `No ${filter.replace(/_/g, " ")} actions`}
          body="Draft one from an investigation's ranked recommendations, then approve it here."
          actionHref="/"
          actionLabel="Run an investigation"
        />
      )}
      <div className="space-y-3">
        {shown.map((a) => (
          <ApprovalCard key={a.id} action={a} onChange={load} />
        ))}
      </div>
    </div>
  );
}
