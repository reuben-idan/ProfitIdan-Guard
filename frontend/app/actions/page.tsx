"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Action } from "@/lib/api";
import ApprovalCard from "@/components/ApprovalCard";

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listActions()
      .then((res) => setActions(res.actions))
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Actions awaiting review</h1>
        <p className="mt-1 text-sm text-slate-700">
          Nothing executes without your approval. Execution is simulated for the demo.
        </p>
      </div>
      {error && <p className="text-sm text-red-800">Failed to load: {error}</p>}
      {actions.length === 0 && !error && (
        <p className="text-sm text-slate-700">
          No actions yet. Draft one from an investigation&apos;s recommended actions.
        </p>
      )}
      {actions.map((a) => (
        <ApprovalCard key={a.id} action={a} onChange={load} />
      ))}
    </div>
  );
}
