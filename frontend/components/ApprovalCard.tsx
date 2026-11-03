"use client";

import { useState } from "react";
import { api, whatsappLink, type Action } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-200 text-slate-800",
  approved: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  executed_simulated: "bg-sky-100 text-sky-900",
};

export default function ApprovalCard({ action, onChange }: { action: Action; onChange: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trail, setTrail] = useState<{ event: string; actor: string; created_at: string }[] | null>(null);

  async function run(fn: () => Promise<unknown>, label: string) {
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (err) {
      setMsg(`${label} failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function showTrail() {
    if (trail) {
      setTrail(null);
      return;
    }
    try {
      const res = await api.auditTrail(action.id);
      setTrail(res.trail);
    } catch (err) {
      setMsg(`Audit failed: ${(err as Error).message}`);
    }
  }

  const isDraft = action.status === "draft";
  const whatsappText = `Hello ${action.target}, our records show ${formatMoney(action.amount)} outstanding. Please confirm payment this week so we can keep your supply running.`;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLE[action.status] ?? STATUS_STYLE.draft}`}>
          {action.status.replace(/_/g, " ")}
        </span>
        <h3 className="font-semibold">
          {action.type.replace(/_/g, " ")} — {action.target} · {formatMoney(action.amount)}
        </h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{action.draft_text}</p>
      {action.finding_ref && (
        <p className="mt-1 text-xs text-slate-500">Linked finding: {action.finding_ref}</p>
      )}
      {msg && <p role="alert" className="mt-2 text-sm text-red-900">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          disabled={!isDraft || busy}
          onClick={() => run(() => api.approveAction(action.id, "owner"), "Approve")}
          className="min-h-[44px] rounded-md bg-emerald-800 px-4 py-2 font-medium text-white hover:bg-emerald-900 disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!isDraft || busy}
          onClick={() => run(() => api.rejectAction(action.id, "owner"), "Reject")}
          className="min-h-[44px] rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-100 disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={action.status !== "approved" || busy}
          onClick={() => run(() => api.executeAction(action.id), "Execute")}
          className="min-h-[44px] rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-100 disabled:opacity-40"
        >
          Execute (simulated)
        </button>
        <a
          href={whatsappLink(whatsappText)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-100"
        >
          Open in WhatsApp
        </a>
        <button
          type="button"
          onClick={showTrail}
          className="min-h-[44px] px-2 py-2 text-emerald-800 underline-offset-2 hover:underline"
        >
          {trail ? "Hide audit trail" : "Audit trail"}
        </button>
      </div>
      {trail && (
        <ul className="mt-2 space-y-1 rounded-md bg-slate-100 p-3 text-sm">
          {trail.map((t, i) => (
            <li key={i}>
              <span className="font-mono text-xs">{t.event}</span> — {t.actor || "system"} · {t.created_at}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
