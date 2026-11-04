"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const SESSION_KEY = "profitpilot.session";

type PersistedSession = { id: string; path: string; name?: string };

function loadPersistedSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Home() {
  const router = useRouter();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [sessionName, setSessionName] = useState("October review");
  const [session, setSession] = useState<PersistedSession | null>(null);
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
  const [msgKind, setMsgKind] = useState<"error" | "info">("error");
  const [busy, setBusy] = useState(false);
  const [runMode, setRunMode] = useState<boolean | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const missingParts = useMemo(() => {
    if (useDemo || !session) return [];
    if (!status) return ["status"];
    const missing: string[] = [];
    for (const [kind, f] of Object.entries(status.files)) {
      if (!f?.present) missing.push(kind);
    }
    if (!status.meta_present) missing.push("business details");
    return missing;
  }, [useDemo, session, status]);

  const canInvestigate = useDemo || (session !== null && status?.ready_for_investigation === true);
  const needsSessionSetup = !useDemo && (!session || !status?.ready_for_investigation);

  // Stable ref so refresh() always sees the current session.
  const sessionRef = useRef<PersistedSession | null>(null);
  sessionRef.current = session;

  const refresh = useCallback(async (sid?: string) => {
    const id = sid ?? sessionRef.current?.id;
    if (!id) return;
    setRefreshing(true);
    try {
      const st = await api.sessionStatus(id);
      setStatus(st);
      if (st.ready_for_investigation) {
        setLoadingSnapshot(true);
        try {
          const snap = await api.sessionSnapshot(id);
          setSnapshot(snap.snapshot);
          setQueue(snap.collections.queue ?? []);
        } catch {
          setSnapshot(null);
        } finally {
          setLoadingSnapshot(false);
        }
      } else {
        setSnapshot(null);
        setQueue([]);
      }
    } catch (err) {
      // Session vanished on the free tier (ephemeral disk): tell the user
      // plainly and offer the demo, instead of a dead session id.
      const message = (err as Error).message;
      if (/not found|404/i.test(message)) {
        setMsgKind("error");
        setMsg(
          "That session is gone from the server — free-tier restarts wipe uploads. Create a new session and re-upload, or switch to the demo dataset to continue instantly."
        );
        setStatus(null);
        setSnapshot(null);
      } else {
        setMsgKind("error");
        setMsg(`Status failed: ${message}`);
      }
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Restore the last session so a refresh never orphans uploads.
  useEffect(() => {
    const restored = loadPersistedSession();
    if (restored) {
      setSession(restored);
      setUseDemo(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      } catch {
        // private mode — session simply won't persist
      }
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  function fail(message: string) {
    setMsgKind("error");
    setMsg(message);
  }

  async function createSession() {
    setMsg(null);
    try {
      const s = await api.createSession(sessionName.trim() || "October review");
      const next = { ...s };
      setSession(next);
      setStatus(null);
      setSnapshot(null);
      setQueue([]);
      setUseDemo(false);
      setMsgKind("info");
      setMsg(`Session ${s.id} created. Upload your 5 files + business details, then investigate.`);
    } catch (err) {
      fail(`Could not reach the backend: ${(err as Error).message}`);
    }
  }

  function startNewSession() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setSession(null);
    setStatus(null);
    setSnapshot(null);
    setQueue([]);
    setMsg(null);
  }

  function switchToDemo() {
    setUseDemo(true);
    setMsg(null);
  }

  async function saveMeta() {
    if (!session) return;
    setMsg(null);
    try {
      await api.setMeta(session.id, meta);
      await refresh();
      setMsgKind("info");
      setMsg("Business details saved.");
    } catch (err) {
      fail(`Details failed: ${(err as Error).message}`);
    }
  }

  async function investigate(fast: boolean) {
    // Client-side guard: never fire an investigation we know will 400.
    if (!useDemo) {
      if (!session) {
        fail("Create a session and upload your files first — or switch on the demo dataset for an instant answer.");
        return;
      }
      if (status && !status.ready_for_investigation) {
        const missing = missingParts.join(", ") || "files";
        fail(
          `Not ready yet — still missing: ${missing}. Finish the checklist below, or switch to the demo dataset to see a full investigation now.`
        );
        return;
      }
    }
    setBusy(true);
    setRunMode(fast);
    setMsg(null);
    // The free-tier server can be slow; stop waiting before the request
    // is hopeless so the user gets words, not a hang.
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 280000);
    try {
      const opts = useDemo
        ? { data_dir: "data/demo", demo_mode: fast ? true : undefined }
        : { session_id: session!.id, demo_mode: fast ? true : undefined };
      const res = await api.investigate(question, opts, ctrl.signal);
      router.push(`/investigations/${res.id}`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        fail("Investigation timed out — the server may still be waking up. Try Instant review, which answers in seconds.");
      } else {
        const message = (err as Error).message;
        // If the server says the session is incomplete or expired, refresh
        // the checklist so the UI shows exactly what is missing.
        if (/incomplete|missing|expired|not found|Dataset/i.test(message)) {
          refresh();
        }
        fail(`Investigation failed: ${message}`);
      }
      setBusy(false);
      setRunMode(null);
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      {showOverlay && runMode !== null && <InvestigatingOverlay fast={runMode} />}

      {/* ── Hero: deep pine engineering panel over blueprint grid ─── */}
      <section className="aurora blueprint relative overflow-hidden rounded-3xl border border-white/15 shadow-pop">
        <div className="relative p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              <LiveDot on={backendOk !== false} />
              {backendOk === null ? "Checking backend…" : backendOk ? "Backend online" : "Backend unreachable — :8000?"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulseGlow rounded-full bg-gold-100" />
              Muse Spark · Meta Model API
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              TradeGuard verified
            </span>
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="animate-rise">
              <h1 className="max-w-xl font-display text-[34px] font-bold leading-[1.06] tracking-tight text-white sm:text-5xl">
                Sales are up. <span className="text-gold-100">Cash is gone.</span> Find the leak before Friday payroll.
              </h1>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/75">
                ProfitPilot investigates like a CFO: recomputes receivables, margins, stock, and
                forecast from your own records, shows the evidence behind every claim, and drafts
                the one action that frees cash fastest. Nothing sends without your approval.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href="#dataset" className={`${btnLight} !min-h-[44px] !py-2.5`}>
                  Start with demo data
                </a>
                <a href="#ask" className={`${btnOutlineLight} !min-h-[44px] !py-2.5`}>
                  Ask the demo question
                </a>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-2.5 lg:grid-cols-1 xl:grid-cols-3">
              {PROOF_STATS.map((s, i) => (
                <div
                  key={s.label}
                  className="glass-dark animate-rise rounded-2xl border border-white/15 p-3 shadow-glow sm:p-4"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <dd className="font-display text-lg font-bold leading-tight text-white tabular-nums sm:text-2xl">
                    {s.value}
                  </dd>
                  <dt className="mt-1 text-[11px] leading-snug text-white/65 sm:text-xs">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Pipeline strip: model → tools → verifier → action */}
          <ol className="mt-6 grid grid-cols-2 gap-2 text-[12px] font-semibold text-white/80 sm:grid-cols-4 sm:text-[13px]">
            {["Muse reasons", "10 finance tools run", "TradeGuard verifies", "You approve"].map((t, i) => (
              <li key={t} className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/8 px-3 py-2.5 backdrop-blur">
                <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 font-display text-[12px] font-bold text-white">
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {msg && (
        <div
          role="alert"
          className={`rounded-2xl border px-4 py-3.5 text-sm font-medium shadow-card backdrop-blur ${
            msgKind === "info"
              ? "border-pine-700/25 bg-pine-50/90 text-pine-900"
              : "border-clay/25 bg-red-50/90 text-clay"
          }`}
        >
          <p className="leading-relaxed">{msg}</p>
          {/failed|missing|expired|not found|Dataset|Not ready/i.test(msg) && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {!useDemo && (
                <button
                  type="button"
                  onClick={switchToDemo}
                  className="inline-flex min-h-[44px] items-center rounded-lg bg-pine-800 px-4 py-2 text-sm font-bold text-white transition hover:bg-pine-900 active:scale-[0.98]"
                >
                  Use demo dataset instead
                </button>
              )}
              {session && !useDemo && (
                <button
                  type="button"
                  onClick={() => refresh()}
                  disabled={refreshing}
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-ink/15 bg-white px-4 py-2 text-sm font-semibold transition hover:border-pine-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {refreshing ? "Refreshing…" : "Refresh checklist"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-semibold text-ink/60 hover:text-ink"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-5 sm:gap-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div className="space-y-5 sm:space-y-7">
          <Card className="glass p-4 shadow-pop sm:p-6" >
            <div id="dataset" className="scroll-mt-24">
              <Step n="01" title="Dataset" hint="Start with the built-in demo, or bring your own records." />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={useDemo}
              onClick={() => { setUseDemo(!useDemo); setMsg(null); }}
              className="mt-3 flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/70 px-4 py-2.5 text-left shadow-card transition hover:border-pine-700/40 active:scale-[0.99]"
            >
              <span>
                <span className="block text-sm font-bold">Use the demo dataset</span>
                <span className="block text-xs text-ink/60">Accra Foods, fictional — works instantly, survives free-tier restarts</span>
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

            {useDemo && (
              <p className="mt-3 rounded-xl border border-pine-700/20 bg-pine-50/80 px-3.5 py-2.5 text-[13px] leading-relaxed text-pine-900">
                Demo mode runs the full pipeline — 10 finance tools + TradeGuard verification — on
                bundled data. Skip uploads and ask below.
              </p>
            )}

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
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-pine-800 px-5 py-2.5 text-sm font-bold text-white shadow-card transition hover:bg-pine-900 active:scale-[0.98]"
                >
                  Create session
                </button>
              </div>
            )}

            {session && !useDemo && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Pill tone={status?.ready_for_investigation ? "ok" : "warn"}>
                    {status?.ready_for_investigation ? "Ready for investigation" : "Setup in progress"}
                  </Pill>
                  <span className="text-ink/60">
                    Session <span className="font-mono font-semibold text-ink">{session.id}</span>
                  </span>
                  <span className="ml-auto flex gap-1">
                    <button
                      type="button"
                      onClick={() => refresh()}
                      disabled={refreshing}
                      className="inline-flex min-h-[44px] items-center px-2 font-semibold text-pine-800 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                    <button
                      type="button"
                      onClick={startNewSession}
                      className="inline-flex min-h-[44px] items-center px-2 font-semibold text-ink/55 underline-offset-2 hover:text-ink hover:underline"
                    >
                      New session
                    </button>
                  </span>
                </div>

                {missingParts.length > 0 && status && (
                  <p className="rounded-xl border border-gold-700/25 bg-gold-100/50 px-3.5 py-2.5 text-[13px] leading-relaxed text-gold-800">
                    Still needed: <strong>{missingParts.join(", ")}</strong>. The investigate buttons
                    unlock when the checklist is complete.
                  </p>
                )}

                <KindStatus status={status} />
                <FileDrop sessionId={session.id} onUploaded={refresh} />
                <details
                  className="rounded-2xl border border-ink/10 bg-white/70 p-4 text-sm shadow-card"
                  {...(!status?.meta_present ? { open: true } : {})}
                >
                  <summary className="flex cursor-pointer select-none items-center justify-between gap-2 font-semibold">
                    Business details (currency, dates, opening cash)
                    <svg viewBox="0 0 16 16" aria-hidden="true" className="chev h-4 w-4 shrink-0 text-pine-800">
                      <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.entries(meta).map(([k, v]) => (
                      <label key={k} className="flex min-w-[140px] flex-1 flex-col text-xs font-medium text-ink/60">
                        {k}
                        <input
                          value={v}
                          onChange={(e) => setMeta({ ...meta, [k]: e.target.value })}
                          inputMode={k === "opening_cash" ? "decimal" : undefined}
                          className="mt-1 min-h-[44px] rounded-xl border border-ink/15 bg-white px-2.5 py-2 text-base text-ink"
                        />
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={saveMeta}
                      className="min-h-[44px] self-end rounded-xl border border-ink/15 bg-white px-4 py-2 font-semibold shadow-card transition hover:border-pine-700 active:scale-[0.98]"
                    >
                      Save details
                    </button>
                  </div>
                </details>

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
                      <p className="mt-2.5 rounded-xl border border-pine-700/20 bg-pine-50/80 px-3.5 py-2.5 text-sm text-pine-900">
                        Top chase: <strong>{queue[0].customer}</strong> —{" "}
                        <Money amount={queue[0].balance} currency={snapshot.currency} className="font-bold" /> ({queue[0].reason})
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card className="glass p-4 shadow-pop sm:p-6">
            <div id="ask" className="scroll-mt-24">
              <Step n="02" title="Ask in your own words" hint="Type or speak the question you would ask an accountant." />
            </div>
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
                    className={`min-h-[44px] rounded-full border px-4 py-2 text-left text-[13px] font-medium shadow-card transition active:scale-[0.98] ${
                      question === q
                        ? "border-pine-700 bg-pine-800 text-white"
                        : "border-ink/15 bg-white/80 text-ink/75 hover:border-pine-700/50"
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
            className="aurora relative overflow-hidden rounded-3xl border border-white/15 p-5 text-white shadow-pop sm:p-7"
          >
            <div aria-hidden="true" className="blueprint pointer-events-none absolute inset-0" />
            <div className="relative">
              <h2 className="flex items-baseline gap-2.5 text-lg font-bold tracking-tight">
                <span className="font-display text-xl text-pine-200" aria-hidden="true">03</span>
                Get a verified answer
              </h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-white/75">
                Instant review uses the deterministic engine (seconds, always available). Full
                investigation uses the Muse model (about a minute, needs the API key on the backend).
              </p>
              {needsSessionSetup && (
                <p className="mt-3 rounded-xl border border-gold-100/30 bg-gold-100/15 px-3.5 py-2.5 text-[13px] leading-relaxed text-gold-100 backdrop-blur">
                  {session
                    ? <>Complete the dataset checklist above to unlock investigations on your files — or <button type="button" onClick={switchToDemo} className="font-bold underline underline-offset-2">run the demo now</button>.</>
                    : <>Create a session and upload files above — or <button type="button" onClick={switchToDemo} className="font-bold underline underline-offset-2">run the demo now</button>.</>}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => investigate(true)}
                  disabled={busy || question.trim().length === 0 || !canInvestigate}
                  title={!canInvestigate ? "Finish the dataset checklist or switch to demo" : undefined}
                  className={`${btnLight} flex-1`}
                >
                  {busy && runMode ? "Working…" : "Instant review (seconds)"}
                </button>
                <button
                  type="button"
                  onClick={() => investigate(false)}
                  disabled={busy || question.trim().length === 0 || !canInvestigate}
                  title={!canInvestigate ? "Finish the dataset checklist or switch to demo" : undefined}
                  className={`${btnOutlineLight} flex-1`}
                >
                  {busy && !runMode ? "Working…" : "Full AI investigation (~1 min)"}
                </button>
              </div>
              {!canInvestigate && !useDemo && (
                <p className="mt-2 text-xs text-white/60">
                  Buttons unlock when all 5 files + business details are saved (see checklist above).
                </p>
              )}
            </div>
          </section>
        </div>

        {/* ── Side rail: trust + how it works ─────────────────────────── */}
        <aside className="space-y-5 sm:space-y-6 lg:sticky lg:top-20">
          <Card className="overflow-hidden p-0 shadow-pop">
            <div className="ring-conic h-1.5" aria-hidden="true" />
            <div className="p-4 sm:p-5">
              <h2 className="text-base font-bold tracking-tight">Why owners trust it</h2>
              <ul className="mt-2 space-y-2.5 text-sm leading-relaxed text-ink/75">
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine-800 text-[11px] font-bold text-white">✓</span>
                  Money is computed in Decimal code, never by the model from memory.
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine-800 text-[11px] font-bold text-white">✓</span>
                  A wrong number fails loudly as <span className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-xs font-bold text-clay">contradicted</span> instead of shipping.
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine-800 text-[11px] font-bold text-white">✓</span>
                  Actions above the verified ceiling are rejected before drafting.
                </li>
                <li className="flex gap-2.5">
                  <span aria-hidden="true" className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pine-800 text-[11px] font-bold text-white">✓</span>
                  <span>Past investigations stay in <Link href="/history" className="font-semibold text-pine-800 underline-offset-2 hover:underline">History</Link> with their evidence.</span>
                </li>
              </ul>
              <p className="mt-3 border-t border-ink/10 pt-3 text-sm">
                <Link href="/pricing" className="font-bold text-pine-800 underline-offset-2 hover:underline">
                  See pricing — from GH₵0 to try, GH₵450/mo to run the business on it →
                </Link>
              </p>
            </div>
          </Card>

          <Card className="p-4 shadow-pop sm:p-5">
            <h2 className="text-base font-bold tracking-tight">How it works</h2>
            <ol className="mt-2 divide-y divide-ink/10 text-sm leading-relaxed">
              <li className="flex gap-3 py-2.5">
                <span className="font-display font-bold text-pine-700" aria-hidden="true">1</span>
                <span><strong>Bring your records.</strong> <span className="text-ink/70">Five files (CSV, TSV, JSON, Excel) or the demo. Bad rows flagged, never faked.</span></span>
              </li>
              <li className="flex gap-3 py-2.5">
                <span className="font-display font-bold text-pine-700" aria-hidden="true">2</span>
                <span><strong>Ask plainly.</strong> <span className="text-ink/70">Type or speak the question you would ask an accountant.</span></span>
              </li>
              <li className="flex gap-3 py-2.5">
                <span className="font-display font-bold text-pine-700" aria-hidden="true">3</span>
                <span><strong>Get proof, not vibes.</strong> <span className="text-ink/70">Every figure recomputed from source rows and graded verified / unverified / contradicted.</span></span>
              </li>
              <li className="flex gap-3 py-2.5">
                <span className="font-display font-bold text-pine-700" aria-hidden="true">4</span>
                <span><strong>Approve the next move.</strong> <span className="text-ink/70">Reminders and holds drafted for you — WhatsApp-ready, audit-logged.</span></span>
              </li>
            </ol>
          </Card>

          <Card className="border-pine-700/20 bg-pine-950 p-4 text-white shadow-pop sm:p-5">
            <h2 className="text-sm font-bold uppercase tracking-widest text-pine-200">Built for the hackathon</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              <strong className="text-white">Build for Your World:</strong> an AI CFO for African
              distributors, reasoning with <strong className="text-white">Muse Spark</strong> via the
              Meta Model API — every claim re-verified by deterministic TradeGuard code.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1">Muse Spark 1.3</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1">Meta Model API</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1">Muse Code</span>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
