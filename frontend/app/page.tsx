"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type CollectionItem, type SessionStatus, type SnapshotKpis } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import CashOutlook from "@/components/CashOutlook";
import FileDrop, { KindStatus } from "@/components/FileDrop";
import InvestigatingOverlay from "@/components/InvestigatingOverlay";
import KpiCard from "@/components/KpiCard";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import VoiceInput from "@/components/VoiceInput";
import { Card, LiveDot, Money, Pill, Step, btnLight, btnOutlineLight, inputCls } from "@/components/ui";

const DEMO_QUESTION =
  "Sales are up but I'm running out of cash. Find the problem and tell me what to do first.";

const QUICK_QUESTIONS = [
  "Which customers should I chase first for cash?",
  "Is my stock tying up too much cash?",
  "Will I survive the next two weeks of payments?",
  "Which product is killing my margin?",
];

const PROOF_STATS = [
  { value: "GH₵27,000", label: "overdue found in the demo" },
  { value: "−GH₵14,000", label: "slip scenario flagged" },
  { value: "4", label: "ranked next actions drafted" },
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
  const [runMode, setRunMode] = useState<boolean | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShowOverlay(false);
      return;
    }
    const timer = window.setTimeout(() => setShowOverlay(true), 600);
    return () => window.clearTimeout(timer);
  }, [busy]);

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
    setRunMode(fast);
    setMsg(null);
    // The free-tier server can be slow to wake; stop waiting before the
    // server's own worker timeout so the user gets words, not a hang.
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 150000);
    try {
      const data_dir = useDemo || !session ? "data/demo" : session.path;
      const res = await api.investigate(question, data_dir, fast ? true : undefined, ctrl.signal);
      router.push(`/investigations/${res.id}`);
    } catch (err) {
      setMsg(
        err instanceof DOMException && err.name === "AbortError"
          ? "Investigation timed out — the server may still be waking up. Try Instant review, which answers in seconds."
          : `Investigation failed: ${(err as Error).message}`
      );
      setBusy(false);
      setRunMode(null);
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      {showOverlay && runMode !== null && <InvestigatingOverlay fast={runMode} />}
      <section className="animate-rise pb-1 pt-1 sm:pt-3">
        <Pill tone={backendOk === false ? "bad" : "ok"}>
          <LiveDot on={backendOk !== false} />
          {backendOk === null
            ? "Checking backend…"
            : backendOk
              ? "Backend online"
              : "Backend unreachable — start it on :8000"}
        </Pill>
        <h1 className="mt-3 max-w-xl font-display text-[34px] font-bold leading-[1.08] tracking-tight sm:text-5xl">
          Sales are up. Cash is gone. Find the leak before Friday payroll.
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink/70">
          ProfitPilot investigates like a CFO: it recomputes your receivables, margins, stock, and
          forecast from your own records, shows the evidence behind every claim, and drafts the one
          action that frees cash fastest. Nothing sends without your approval.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-3 border-y border-ink/10 py-3.5 sm:max-w-xl">
          {PROOF_STATS.map((s) => (
            <div key={s.label} className="flex flex-col">
              <dt className="order-2 mt-1 text-xs leading-snug text-ink/60">{s.label}</dt>
              <dd className="order-1 font-display text-[17px] font-bold leading-tight tabular-nums sm:text-2xl">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {msg && (
        <p role="alert" className="rounded-xl bg-gold-100 px-4 py-3 text-sm font-medium text-gold-800">
          {msg}
        </p>
      )}

      <Card className="p-4 sm:p-6">
        <Step
          n="01"
          title="Dataset"
          hint="Start with the built-in demo, or bring your own records."
        />
        <button
          type="button"
          role="switch"
          aria-checked={useDemo}
          onClick={() => setUseDemo(!useDemo)}
          className="mt-3 flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl bg-mist px-4 py-2.5 text-left transition active:scale-[0.99]"
        >
          <span>
            <span className="block text-sm font-bold">Use the demo dataset</span>
            <span className="block text-xs text-ink/60">Accra Foods, fictional — works instantly</span>
          </span>
          <span
            aria-hidden="true"
            className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
              useDemo ? "justify-end bg-pine-700" : "justify-start bg-ink/20"
            }`}
          >
            <span className="h-5 w-5 rounded-full bg-white shadow" />
          </span>
        </button>
        {!useDemo && !session && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              aria-label="Session name"
              placeholder="Session name"
              className={`${inputCls} flex-1`}
            />
            <button
              type="button"
              onClick={createSession}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-pine-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pine-900 active:scale-[0.98]"
            >
              Create session
            </button>
          </div>
        )}
        {session && !useDemo && (
          <div className="mt-4 space-y-4">
            <p className="text-sm">
              Session <span className="font-mono font-semibold">{session.id}</span>
              <button
                type="button"
                onClick={refresh}
                className="ml-3 min-h-[44px] font-semibold text-pine-800 underline-offset-2 hover:underline"
              >
                Refresh status
              </button>
            </p>
            <KindStatus status={status} />
            <FileDrop sessionId={session.id} onUploaded={refresh} />
            <details className="rounded-xl bg-mist p-4 text-sm">
              <summary className="cursor-pointer font-semibold">
                Business details (currency, dates, opening cash)
              </summary>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(meta).map(([k, v]) => (
                  <label key={k} className="flex min-w-[140px] flex-1 flex-col text-xs font-medium text-ink/60">
                    {k}
                    <input
                      value={v}
                      onChange={(e) => setMeta({ ...meta, [k]: e.target.value })}
                      className="mt-1 min-h-[44px] rounded-lg border border-ink/15 bg-white px-2.5 py-2 text-sm text-ink"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={saveMeta}
                  className="min-h-[44px] self-end rounded-lg border border-ink/15 bg-white px-4 py-2 font-semibold transition hover:border-pine-700 active:scale-[0.98]"
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
            {loadingSnapshot && <LoadingSkeleton lines={2} />}
            {snapshot && (
              <div>
                <h3 className="text-sm font-bold">Live snapshot — no AI call needed</h3>
                <div className="mt-2.5">
                  <CashOutlook
                    cash={snapshot.cash_on_hand}
                    onTime={snapshot.forecast_on_time}
                    slip={snapshot.forecast_slip}
                    currency={snapshot.currency}
                  />
                </div>
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
                  <p className="mt-2.5 rounded-lg bg-pine-50 px-3.5 py-2.5 text-sm text-pine-900">
                    Top chase: <strong>{queue[0].customer}</strong> —{" "}
                    <Money amount={queue[0].balance} currency={snapshot.currency} className="font-bold" /> ({queue[0].reason})
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <Step n="02" title="Ask in your own words" />
        <div className="mt-3 flex flex-col gap-2.5">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            aria-label="Your question"
            className={`${inputCls} resize-y leading-relaxed`}
          />
          <div className="flex flex-wrap gap-2">
            <VoiceInput onText={(t) => setQuestion(t)} />
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setQuestion(q)}
                className={`min-h-[44px] rounded-full border px-4 py-2 text-left text-[13px] font-medium transition active:scale-[0.98] ${
                  question === q
                    ? "border-pine-700 bg-pine-50 text-pine-900"
                    : "border-ink/15 bg-white text-ink/75 hover:border-pine-700/50"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <section
        aria-label="Investigate"
        className="rounded-2xl bg-pine-900 p-5 text-white shadow-pop sm:p-7"
      >
        <h2 className="flex items-baseline gap-2.5 text-lg font-bold tracking-tight">
          <span className="font-display text-xl text-pine-200" aria-hidden="true">03</span>
          Get a verified answer
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-relaxed text-pine-100/90">
          Instant review uses the deterministic engine (seconds, always available). Full
          investigation uses the Muse model (about a minute, needs the API key on the backend).
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => investigate(true)}
            disabled={busy || question.trim().length === 0}
            className={`${btnLight} flex-1`}
          >
            {busy ? "Working…" : "Instant review (seconds)"}
          </button>
          <button
            type="button"
            onClick={() => investigate(false)}
            disabled={busy || question.trim().length === 0}
            className={`${btnOutlineLight} flex-1`}
          >
            Full AI investigation (~1 min)
          </button>
        </div>
      </section>

      <section aria-label="How it works" className="grid gap-6 pt-1 md:grid-cols-2 md:gap-10">
        <div>
          <h2 className="text-lg font-bold tracking-tight">How it works</h2>
          <ol className="mt-2 divide-y divide-ink/10 text-sm leading-relaxed">
            <li className="flex gap-3 py-2.5">
              <span className="font-display font-bold text-pine-700" aria-hidden="true">1</span>
              <span><strong>Bring your records.</strong> <span className="text-ink/70">Upload five files (CSV, TSV, JSON, or Excel) or start with the demo. Bad rows are flagged, never faked.</span></span>
            </li>
            <li className="flex gap-3 py-2.5">
              <span className="font-display font-bold text-pine-700" aria-hidden="true">2</span>
              <span><strong>Ask plainly.</strong> <span className="text-ink/70">Type or speak the question you would ask an accountant.</span></span>
            </li>
            <li className="flex gap-3 py-2.5">
              <span className="font-display font-bold text-pine-700" aria-hidden="true">3</span>
              <span><strong>Get proof, not vibes.</strong> <span className="text-ink/70">Every figure is recomputed from source rows and graded verified, unverified, or contradicted.</span></span>
            </li>
            <li className="flex gap-3 py-2.5">
              <span className="font-display font-bold text-pine-700" aria-hidden="true">4</span>
              <span><strong>Approve the next move.</strong> <span className="text-ink/70">Collection reminders and holds are drafted for you — WhatsApp-ready, audit-logged.</span></span>
            </li>
          </ol>
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">Why owners trust it</h2>
          <ul className="mt-2 divide-y divide-ink/10 text-sm leading-relaxed text-ink/75">
            <li className="py-2.5">Money is computed in Decimal code, never by the model from memory.</li>
            <li className="py-2.5">A wrong number fails loudly as <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs font-bold text-clay">contradicted</span> instead of shipping.</li>
            <li className="py-2.5">Actions above the verified ceiling are rejected before drafting.</li>
            <li className="py-2.5">
              Past investigations stay in{" "}
              <Link href="/history" className="font-semibold text-pine-800 underline-offset-2 hover:underline">
                History
              </Link>{" "}
              with their evidence.
            </li>
          </ul>
          <p className="mt-3 text-sm">
            <Link href="/pricing" className="font-bold text-pine-800 underline-offset-2 hover:underline">
              See pricing — from GH₵0 to try, GH₵450/mo to run the business on it →
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
