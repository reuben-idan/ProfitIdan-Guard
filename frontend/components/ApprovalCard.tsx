"use client";

import { useState } from "react";
import { api, type Action } from "@/lib/api";

export default function ApprovalCard({ action, onChange }: { action: Action; onChange: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [trail, setTrail] = useState<{ event: string; actor: string; created_at: string }[] | null>(null);

  async function run(fn: () => Promise<unknown>, label: string) {
    setMsg(null);
    try {
      await fn();
      onChange();
    } catch (err) {
      setMsg(`${label} failed: ${(err as Error).message}`);
    }
  }

  async function showTrail() {
    if (trail) {
      setTrail(null);
      return;
    }
    const res = await api.auditTrail(action.id);
    setTrail(res.trail);
  }

  const isDraft = action.status === "draft";
  return (
    <article className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded bg-slate-200 px-2 py-0.5 text-xs font-bold uppercase">{action.status}</span>
        <h3 className="font-semibold">
          {action.type} — {action.target} · GH₵{action.amount}
        </h3>
      </div>
      <p className="mt-1 text-sm text-slate-700">{action.draft_text}</p>
      {msg && <p className="mt-1 text-sm text-red-800">{msg}</p>}
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <button
          disabled={!isDraft}
          onClick={() => run(() => api.approveAction(action.id, "owner"), "Approve")}
          className="rounded-md bg-emerald-700 px-3 py-1 text-white hover:bg-emerald-800 disabled:opacity-40"
        >
          Approve
        </button>
        <button
          disabled={!isDraft}
          onClick={() => run(() => api.rejectAction(action.id, "owner"), "Reject")}
          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        >
          Reject
        </button>
        <button
          disabled={action.status !== "approved"}
          onClick={() => run(() => api.executeAction(action.id), "Execute")}
          className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
        >
          Execute (simulated)
        </button>
        <button onClick={showTrail} className="px-2 py-1 text-emerald-700 underline-offset-2 hover:underline">
          {trail ? "Hide audit trail" : "Audit trail"}
        </button>
      </div>
      {trail && (
        <ul className="mt-2 space-y-1 rounded-md bg-slate-100 p-3 text-sm">
          {trail.map((t, i) => (
            <li key={i}>
              {t.event} — {t.actor || "system"} · {t.created_at}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
