"use client";

import { useState } from "react";
import { api } from "@/lib/api";

const KINDS = ["invoices", "supplier_bills", "bank", "sales", "inventory"];

export default function DataUpload({
  sessionId,
  onUploaded,
}: {
  sessionId: string;
  onUploaded: () => void;
}) {
  const [kind, setKind] = useState("invoices");
  const [report, setReport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setReport(null);
    try {
      const content = await file.text();
      const res = await api.uploadFile(sessionId, file.name, kind, content);
      const issues =
        res.issues.length > 0 ? ` Issues: ${res.issues.join("; ")}` : " No issues.";
      setReport(`${res.status}: ${res.rows_accepted} rows accepted.${issues}`);
      onUploaded();
    } catch (err) {
      setReport(`Upload failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept=".csv"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="text-sm"
        />
      </div>
      {report && <p className="text-sm text-slate-700">{report}</p>}
    </div>
  );
}
