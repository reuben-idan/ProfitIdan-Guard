"use client";

import { useState } from "react";
import { api, whatsappLink, type Action } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { Card, Pill } from "./ui";

const STATUS_TONE: Record<string, "ok" | "warn" | "bad" | "info" | "neutral"> = {
  draft: "neutral",
  approved: "ok",
  rejected: "bad",
  executed_simulated: "info",
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
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={STATUS_TONE[action.status] ?? "neutral"}>
          {action.status.replace(/_/g, " ")}
        </Pill>
        <p className="text-xs text-ink/50">
          {action.type.replace(/_/g, " ")} · <span className="font-mono">{action.id}</span>
        </p>
      </div>
      <h3 className="mt-2 text-lg font-bold tracking-tight">
        {action.target} ·{" "}
        <span className="font-display tabular-nums">{formatMoney(action.amount)}</span>
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/80">{action.draft_text}</p>
      {action.finding_ref && (
        <p className="mt-1.5 text-xs text-ink/55">Linked finding: {action.finding_ref}</p>
      )}
      {msg && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-clay">{msg}</p>}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-ink/10 pt-3 text-sm">
        <button
          type="button"
          disabled={!isDraft || busy}
          onClick={() => run(() => api.approveAction(action.id, "owner"), "Approve")}
          className="inline-flex min-h-[44px] items-center rounded-lg bg-pine-800 px-5 py-2 font-bold text-white transition hover:bg-pine-900 active:scale-[0.98] disabled:opacity-40"
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!isDraft || busy}
          onClick={() => run(() => api.rejectAction(action.id, "owner"), "Reject")}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-ink/15 px-4 py-2 font-semibold transition hover:border-pine-700 active:scale-[0.98] disabled:opacity-40"
        >
          Reject
        </button>
        <button
          type="button"
          disabled={action.status !== "approved" || busy}
          onClick={() => run(() => api.executeAction(action.id), "Execute")}
          className="inline-flex min-h-[44px] items-center rounded-lg border border-ink/15 px-4 py-2 font-semibold transition hover:border-pine-700 active:scale-[0.98] disabled:opacity-40"
        >
          Execute (simulated)
        </button>
        <a
          href={whatsappLink(whatsappText)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center rounded-lg border border-ink/15 px-4 py-2 font-semibold transition hover:border-pine-700 active:scale-[0.98]"
        >
          Open in WhatsApp
        </a>
        <button
          type="button"
          onClick={showTrail}
          className="inline-flex min-h-[44px] items-center px-2 py-2 font-semibold text-pine-800"
        >
          {trail ? "Hide audit trail" : "Audit trail"}
        </button>
      </div>
      {trail && (
        <ol className="mt-1 space-y-0 divide-y divide-ink/10 border-t border-ink/10 text-sm">
          {trail.map((t, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 py-2">
              <span className="font-mono text-xs font-bold text-pine-800">{t.event}</span>
              <span className="text-ink/60">— {t.actor || "system"} · {t.created_at}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
