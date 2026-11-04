"use client";

import { useState } from "react";
import { api, whatsappLink, type SessionStatus } from "@/lib/api";
import { btnOutline, btnPrimary } from "./ui";

export const DATASET_KINDS = ["invoices", "supplier_bills", "bank", "sales", "inventory"] as const;

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const KIND_HELP: Record<string, string> = {
  invoices: "Customer invoices with amounts paid",
  supplier_bills: "Supplier bills with amounts paid",
  bank: "Bank movements with references",
  sales: "Sales lines with quantities and prices",
  inventory: "Stock on hand with unit costs",
};

export function KindStatus({ status }: { status: SessionStatus | null }) {
  if (!status) return null;
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {DATASET_KINDS.map((kind) => {
        const file = status.files[kind];
        const issues = file?.issues?.length ?? 0;
        const ok = file?.present && issues === 0;
        const warn = file?.present && issues > 0;
        return (
          <li
            key={kind}
            className={`flex items-start justify-between gap-2 rounded-xl border p-3 text-sm ${
              ok
                ? "border-pine-700/25 bg-pine-50"
                : warn
                  ? "border-gold-700/30 bg-gold-100/40"
                  : "border-ink/10 bg-white"
            }`}
          >
            <span>
              <span className="font-mono text-[13px] font-semibold">{kind}</span>
              <span className="block text-xs text-ink/60">{KIND_HELP[kind]}</span>
              {file?.present ? (
                <span className="mt-0.5 block text-xs font-medium text-ink/75">
                  {file.rows_accepted} rows{warn ? ` · ${issues} issue${issues === 1 ? "" : "s"}` : ""}
                </span>
              ) : (
                <span className="mt-0.5 block text-xs text-ink/45">Not uploaded yet</span>
              )}
            </span>
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                ok ? "bg-pine-700 text-white" : warn ? "bg-gold-700 text-white" : "bg-ink/10 text-ink/50"
              }`}
            >
              {ok ? "✓" : warn ? "!" : "·"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function FileDrop({
  sessionId,
  onUploaded,
}: {
  sessionId: string;
  onUploaded: () => void;
}) {
  const [kind, setKind] = useState<string>("invoices");
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    setReport(null);
    try {
      const isWorkbook = /\.xlsx$/i.test(file.name);
      const content = isWorkbook ? "" : await file.text();
      const contentBase64 = isWorkbook ? bufferToBase64(await file.arrayBuffer()) : undefined;
      const res = await api.uploadFile(sessionId, file.name, kind, content, contentBase64);
      const issues = res.issues.length > 0 ? ` Issues: ${res.issues.slice(0, 3).join("; ")}` : " No issues.";
      setReport(`${res.status}: ${res.rows_accepted} rows accepted.${issues}`);
      onUploaded();
    } catch (err) {
      setReport(`Upload failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    try {
      const t = await api.template(kind);
      const blob = new Blob([t.content], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = t.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setReport(`Template failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium">
          <span className="sr-only">Dataset type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="min-h-[44px] rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm font-medium"
          >
            {DATASET_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={downloadTemplate} className={btnOutline}>
          Get CSV template
        </button>
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        className={`flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed p-4 text-center transition ${
          dragOver ? "border-pine-700 bg-pine-50" : "border-ink/20 bg-mist/60 hover:border-pine-700/50 hover:bg-pine-50/50"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6 text-pine-700" aria-hidden="true">
          <path
            d="M12 3a1 1 0 0 1 1 1v7.6l2.3-2.3a1 1 0 0 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L11 11.6V4a1 1 0 0 1 1-1ZM4 15a1 1 0 0 1 1 1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1v-2Z"
            fill="currentColor"
          />
        </svg>
        <span className="text-sm font-semibold">{busy ? "Uploading…" : `Drop your ${kind} file here, or tap to choose`}</span>
        <span className="text-xs text-ink/55">CSV, TSV, JSON, or Excel (.xlsx) — validated instantly, bad rows flagged, never silently dropped.</span>
        <input
          type="file"
          accept=".csv,.tsv,.tab,.json,.xlsx,text/csv,text/tab-separated-values,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="sr-only"
        />
      </label>
      {report && <p role="status" className="rounded-lg bg-mist px-3 py-2 text-sm">{report}</p>}
    </div>
  );
}

export function ShareActions({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="no-print flex flex-wrap gap-2">
      <a
        href={whatsappLink(`${title}\n${text}`)}
        target="_blank"
        rel="noreferrer"
        className={btnPrimary}
      >
        Share on WhatsApp
      </a>
      <button type="button" onClick={copy} className={btnOutline}>
        {copied ? "Copied ✓" : "Copy summary"}
      </button>
      <button type="button" onClick={() => window.print()} className={btnOutline}>
        Print / PDF
      </button>
    </div>
  );
}
