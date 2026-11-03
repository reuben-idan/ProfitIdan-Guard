"use client";

import { useState } from "react";
import { api, whatsappLink, type SessionStatus } from "@/lib/api";

export const DATASET_KINDS = ["invoices", "supplier_bills", "bank", "sales", "inventory"] as const;

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
        const ok = file?.present && (file.issues?.length ?? 0) === 0;
        const warn = file?.present && (file.issues?.length ?? 0) > 0;
        return (
          <li
            key={kind}
            className={`flex items-start justify-between gap-2 rounded-md border p-2.5 text-sm ${
              ok ? "border-emerald-200 bg-emerald-50" : warn ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <span>
              <span className="font-mono text-xs font-semibold">{kind}</span>
              <span className="block text-xs text-slate-600">{KIND_HELP[kind]}</span>
              {file?.present ? (
                <span className="block text-xs text-slate-600">
                  {file.rows_accepted} rows{warn ? ` · ${file.issues?.length} issue(s)` : ""}
                </span>
              ) : (
                <span className="block text-xs text-slate-500">Not uploaded yet</span>
              )}
            </span>
            <span aria-hidden="true" className="text-base">{ok ? "✓" : warn ? "!" : "○"}</span>
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
      const content = await file.text();
      const res = await api.uploadFile(sessionId, file.name, kind, content);
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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium">
          <span className="sr-only">Dataset type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="min-h-[44px] rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            {DATASET_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={downloadTemplate}
          className="min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100"
        >
          Get CSV template
        </button>
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed p-4 text-center text-sm ${
          dragOver ? "border-emerald-600 bg-emerald-50" : "border-slate-300 bg-slate-50 hover:bg-slate-100"
        }`}
      >
        <span className="font-medium">{busy ? "Uploading…" : `Drop your ${kind}.csv here, or tap to choose`}</span>
        <span className="text-xs text-slate-500">Validated instantly — bad rows are flagged, never silently dropped.</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={busy}
          onChange={(e) => handleFile(e.target.files?.[0])}
          className="sr-only"
        />
      </label>
      {report && <p role="status" className="text-sm text-slate-700">{report}</p>}
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
        className="inline-block min-h-[44px] rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-900"
      >
        Share on WhatsApp
      </a>
      <button
        type="button"
        onClick={copy}
        className="min-h-[44px] rounded-md border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-100"
      >
        {copied ? "Copied" : "Copy summary"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="min-h-[44px] rounded-md border border-slate-300 px-4 py-2.5 text-sm hover:bg-slate-100"
      >
        Print / PDF
      </button>
    </div>
  );
}
