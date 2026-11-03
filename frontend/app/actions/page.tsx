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
        <h1 className="text-xl font-bold sm:text-2xl">Actions awaiting review</h1>
        <p className="mt-1 text-sm text-slate-700">
          {drafts > 0 ? `${drafts} draft(s) need your decision. ` : ""}
          Nothing executes without your approval. Execution is simulated for the demo.
        </p>
      </div>
      <div className="no-print flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`min-h-[44px] rounded-full border px-3 py-2 text-xs font-medium ${
              filter === f ? "border-emerald-800 bg-emerald-800 text-white" : "border-slate-300 bg-white hover:bg-slate-100"
            }`}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-900">Failed to load: {error}</p>}
      {loading && <LoadingSkeleton lines={4} />}
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
