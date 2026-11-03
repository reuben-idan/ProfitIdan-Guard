"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type CollectionItem, type SessionStatus, type SnapshotKpis } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import FileDrop, { KindStatus } from "@/components/FileDrop";
import KpiCard from "@/components/KpiCard";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import VoiceInput from "@/components/VoiceInput";

const DEMO_QUESTION =
  "Sales are up but I'm running out of cash. Find the problem and tell me what to do first.";

const QUICK_QUESTIONS = [
  "Which customers should I chase first for cash?",
  "Is my stock tying up too much cash?",
  "Will I survive the next two weeks of payments?",
  "Which product is killing my margin?",
];

export default function Home() {
  const router = useRouter();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [sessionName, setSessionName] = useState("October review");
  const [session, setSession] = useState<{ id: string; path: string } | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotKpis | null>(null);
  const [queue, setQueue] = useState<CollectionItem[]>([]);
  const [meta, setMeta] = useState({
    business_name: "Accra Foods Distributors Ltd",
    currency: "GHS",
    as_of: "2026-10-27",
    opening_cash: "20000.00",
    opening_cash_date: "2026-10-01",
  });
  const [question, setQuestion] = useState(DEMO_QUESTION);
  const [useDemo, setUseDemo] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    api.health().then(() => setBackendOk(true)).catch(() => setBackendOk(false));
  }, []);

  async function createSession() {
    setMsg(null);
    try {
      const s = await api.createSession(sessionName);
      setSession(s);
      setUseDemo(false);
    } catch (err) {
      setMsg(`Could not reach the backend: ${(err as Error).message}`);
    }
  }

  async function refresh() {
    if (!session) return;
    try {
      const st = await api.sessionStatus(session.id);
      setStatus(st);
      if (st.ready_for_investigation) {
        setLoadingSnapshot(true);
        try {
          const snap = await api.sessionSnapshot(session.id);
          setSnapshot(snap.snapshot);
          setQueue(snap.collections.queue ?? []);
        } catch {
          setSnapshot(null);
        } finally {
          setLoadingSnapshot(false);
        }
      }
    } catch (err) {
      setMsg(`Status failed: ${(err as Error).message}`);
    }
  }

  async function saveMeta() {
    if (!session) return;
    setMsg(null);
    try {
      await api.setMeta(session.id, meta);
      await refresh();
    } catch (err) {
      setMsg(`Meta failed: ${(err as Error).message}`);
    }
  }

  async function investigate(fast: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const data_dir = useDemo || !session ? "data/demo" : session.path;
      const res = await api.investigate(question, data_dir, fast ? true : undefined);
      router.push(`/investigations/${res.id}`);
    } catch (err) {
      setMsg(`Investigation failed: ${(err as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="border-b border-slate-200 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`inline-block rounded-full px-2.5 py-1 font-semibold ${backendOk === false ? "bg-red-100 text-red-900" : "bg-emerald-100 text-emerald-900"}`}
          >
            {backendOk === null ? "Checking backend…" : backendOk ? "Backend online" : "Backend unreachable — start it on :8000"}
          </span>
          <span className="text-slate-500">Muse reasoning · TradeGuard verification · owner approval</span>
        </div>
        <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          Sales are up. Cash is gone. Find the leak before Friday payroll.
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-700">
          ProfitPilot investigates like a CFO: it recomputes your receivables, margins, stock, and
          forecast from your own records, shows the evidence behind every claim, and drafts the one
          action that frees cash fastest. Nothing sends without your approval.
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
          <span><strong className="text-slate-900">GH₵27,000</strong> overdue found in the demo</span>
          <span><strong className="text-slate-900">−GH₵14,000</strong> slip scenario flagged</span>
          <span><strong className="text-slate-900">4</strong> ranked next actions drafted</span>
        </div>
      </section>

      {msg && <p role="alert" className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">{msg}</p>}

      <section aria-label="Dataset" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-bold"><span className="mr-2 text-emerald-800">1.</span>Dataset</h2>
        <label className="mt-2 flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useDemo}
            onChange={(e) => setUseDemo(e.target.checked)}
            className="h-5 w-5 accent-emerald-800"
          />
          Use the built-in demo dataset (Accra Foods, fictional — works instantly)
        </label>
        {!useDemo && !session && (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              aria-label="Session name"
              className="min-h-[44px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createSession}
              className="min-h-[44px] rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
            >
              Create session
            </button>
          </div>
        )}
        {session && !useDemo && (
          <div className="mt-3 space-y-4">
            <p className="text-sm">
              Session <span className="font-mono font-semibold">{session.id}</span>
              <button type="button" onClick={refresh} className="ml-3 min-h-[44px] text-emerald-800 underline-offset-2 hover:underline">
                Refresh status
              </button>
            </p>
            <KindStatus status={status} />
            <FileDrop sessionId={session.id} onUploaded={refresh} />
            <details className="rounded-md bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer font-medium">Business details (currency, dates, opening cash)</summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(meta).map(([k, v]) => (
                  <label key={k} className="flex min-w-[140px] flex-1 flex-col text-xs text-slate-600">
                    {k}
                    <input
                      value={v}
                      onChange={(e) => setMeta({ ...meta, [k]: e.target.value })}
                      className="mt-0.5 min-h-[44px] rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-900"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={saveMeta}
                  className="min-h-[44px] self-end rounded-md border border-slate-300 px-4 py-2 hover:bg-slate-100"
                >
                  Save details
                </button>
              </div>
            </details>
            {status && (
              <p className="text-sm">
                Ready: <strong>{status.ready_for_investigation ? "yes" : "not yet"}</strong>
                {" · "}Details: {status.meta_present ? "set" : "missing"}
              </p>
            )}
            {loadingSnapshot && <LoadingSkeleton lines={3} />}
            {snapshot && (
              <div>
                <h3 className="text-sm font-semibold">Live snapshot — no AI call needed</h3>
                <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <KpiCard label="Cash on hand" value={formatMoney(snapshot.cash_on_hand, snapshot.currency)} />
                  <KpiCard label="Overdue" value={formatMoney(snapshot.overdue_total, snapshot.currency)} tone="bad" sub="collect first" />
                  <KpiCard label="Payables due" value={formatMoney(snapshot.payables_due, snapshot.currency)} sub="14 days" />
                  <KpiCard
                    label="If collections slip"
                    value={formatMoney(snapshot.forecast_slip, snapshot.currency)}
                    tone={Number(snapshot.forecast_slip) < 0 ? "bad" : "good"}
                  />
                </div>
                {queue.length > 0 && (
                  <p className="mt-2 text-sm text-slate-600">
                    Top chase: <strong>{queue[0].customer}</strong> — {formatMoney(queue[0].balance, snapshot.currency)} ({queue[0].reason})
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section aria-label="Question" className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-bold"><span className="mr-2 text-emerald-800">2.</span>Ask in your own words</h2>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            aria-label="Your question"
            className="w-full rounded-md border border-slate-300 p-3 text-base"
          />
          <div className="flex flex-wrap gap-2">
            <VoiceInput onText={(t) => setQuestion(t)} />
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuestion(q)}
                className="min-h-[44px] rounded-full border border-slate-300 px-3 py-2 text-left text-xs hover:bg-slate-100"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Investigate" className="rounded-lg border border-emerald-800 bg-emerald-900 p-4 text-white sm:p-5">
        <h2 className="font-bold"><span className="mr-2 text-emerald-200">3.</span>Get a verified answer</h2>
        <p className="mt-1 text-sm text-emerald-100">
          Instant review uses the deterministic engine (seconds, always available). Full investigation
          uses the Muse model (about a minute, needs the API key on the backend).
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => investigate(true)}
            disabled={busy || question.trim().length === 0}
            className="min-h-[48px] flex-1 rounded-md bg-white px-4 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-50"
          >
            {busy ? "Working…" : "Instant review (seconds)"}
          </button>
          <button
            type="button"
            onClick={() => investigate(false)}
            disabled={busy || question.trim().length === 0}
            className="min-h-[48px] flex-1 rounded-md border border-emerald-200 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            Full AI investigation (~1 min)
          </button>
        </div>
      </section>

      <section aria-label="How it works" className="grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="font-bold">How it works</h2>
          <ol className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
            <li><strong className="text-slate-900">1. Bring your records.</strong> Upload five CSVs or start with the demo. Bad rows are flagged, never faked.</li>
            <li><strong className="text-slate-900">2. Ask plainly.</strong> Type or speak the question you would ask an accountant.</li>
            <li><strong className="text-slate-900">3. Get proof, not vibes.</strong> Every figure is recomputed from source rows and graded verified, unverified, or contradicted.</li>
            <li><strong className="text-slate-900">4. Approve the next move.</strong> Collection reminders and holds are drafted for you — WhatsApp-ready, audit-logged.</li>
          </ol>
        </div>
        <div>
          <h2 className="font-bold">Why owners trust it</h2>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-slate-700">
            <li>Money is computed in Decimal code, never by the model from memory.</li>
            <li>A wrong number fails loudly as <span className="font-mono text-xs">contradicted</span> instead of shipping.</li>
            <li>Actions above the verified ceiling are rejected before drafting.</li>
            <li>Past investigations stay in <Link href="/history" className="text-emerald-800 underline-offset-2 hover:underline">History</Link> with their evidence.</li>
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/pricing" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
              See pricing — from GH₵0 to try, GH₵450/mo to run the business on it →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
