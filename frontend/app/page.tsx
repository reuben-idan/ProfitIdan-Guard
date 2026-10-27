"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type SessionStatus } from "@/lib/api";
import DataUpload from "@/components/DataUpload";

const DEMO_QUESTION =
  "Sales are up but I'm running out of cash. Find the problem and tell me what to do first.";

export default function Home() {
  const router = useRouter();
  const [sessionName, setSessionName] = useState("October review");
  const [session, setSession] = useState<{ id: string; path: string } | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);
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
    setStatus(await api.sessionStatus(session.id));
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

  async function investigate() {
    setBusy(true);
    setMsg(null);
    try {
      const data_dir = useDemo || !session ? "data/demo" : session.path;
      const res = await api.investigate(question, data_dir);
      router.push(`/investigations/${res.id}`);
    } catch (err) {
      const text = (err as Error).message;
      setMsg(
        text.includes("503")
          ? "The backend has no MODEL_API_KEY. Add it to .env and restart the API."
          : `Investigation failed: ${text}`
      );
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">Investigate a cash problem</h1>
        <p className="mt-1 text-sm text-slate-700">
          Assemble a dataset, ask a question, and the agent investigates with verifiable tools.
        </p>
      </section>

      {msg && <p className="rounded-md bg-amber-100 p-3 text-sm text-amber-900">{msg}</p>}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold">1. Dataset</h2>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useDemo} onChange={(e) => setUseDemo(e.target.checked)} />
          Use the built-in demo dataset (Accra Foods Distributors, fictional)
        </label>
        {!useDemo && !session && (
          <div className="mt-2 flex gap-2">
            <input
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <button
              onClick={createSession}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm text-white hover:bg-emerald-800"
            >
              Create session
            </button>
          </div>
        )}
        {session && (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              Session <span className="font-mono font-semibold">{session.id}</span>
              <button onClick={refresh} className="ml-3 text-emerald-700 underline-offset-2 hover:underline">
                Refresh status
              </button>
            </p>
            <DataUpload sessionId={session.id} onUploaded={refresh} />
            <div className="flex flex-wrap gap-2">
              {Object.entries(meta).map(([k, v]) => (
                <label key={k} className="flex flex-col text-xs text-slate-600">
                  {k}
                  <input
                    value={v}
                    onChange={(e) => setMeta({ ...meta, [k]: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900"
                  />
                </label>
              ))}
              <button
                onClick={saveMeta}
                className="self-end rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
              >
                Save meta
              </button>
            </div>
            {status && (
              <p>
                Ready: <strong>{status.ready_for_investigation ? "yes" : "not yet"}</strong>
                {" · "}Meta: {status.meta_present ? "set" : "missing"}
              </p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="font-semibold">2. Question</h2>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-slate-300 p-2 text-sm"
        />
        <button
          onClick={investigate}
          disabled={busy || question.trim().length === 0}
          className="mt-2 rounded-md bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-800 disabled:opacity-40"
        >
          {busy ? "Investigating (this takes a minute)…" : "Investigate"}
        </button>
      </section>
    </div>
  );
}
