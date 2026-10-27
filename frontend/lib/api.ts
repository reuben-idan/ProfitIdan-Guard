const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

const post = <T,>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });
const get = <T,>(path: string): Promise<T> => request<T>(path);

export interface Finding {
  title?: string;
  claim?: string;
  evidence_ids?: string[];
  currency?: string;
  amount_checks?: { label?: string; expected?: string; tool?: string; path?: string }[];
}

export interface VerdictCheck {
  check: string;
  passed: boolean;
  detail: string;
}

export interface Verdict {
  title: string;
  status: "verified" | "unverified" | "contradicted";
  checks: VerdictCheck[];
}

export interface SessionStatus {
  id: string;
  name: string;
  path: string;
  files: Record<string, { present: boolean; rows_accepted?: number; issues?: string[] }>;
  meta_present: boolean;
  ready_for_investigation: boolean;
}

export interface Action {
  id: string;
  type: string;
  target: string;
  amount: string;
  draft_text: string;
  finding_ref: string;
  status: string;
  approved_by: string;
  created_at: string;
}

export const api = {
  createSession: (name: string) =>
    post<{ id: string; name: string; path: string }>("/sessions", { name }),
  uploadFile: (sessionId: string, filename: string, kind: string, content: string) =>
    post<{ status: string; rows_accepted: number; issues: string[] }>(
      `/sessions/${sessionId}/files`,
      { filename, kind, content }
    ),
  setMeta: (sessionId: string, meta: Record<string, string>) =>
    post<{ status: string; path: string }>(`/sessions/${sessionId}/meta`, meta),
  sessionStatus: (sessionId: string) => get<SessionStatus>(`/sessions/${sessionId}`),
  investigate: (question: string, data_dir?: string) =>
    post<{ id: string; status: string; result: Record<string, never>; verdicts: Verdict[] }>(
      "/investigations",
      { question, data_dir }
    ),
  getInvestigation: (id: string) =>
    get<{ id: string; question: string; result: Record<string, never>; verdicts: Verdict[]; status: string }>(
      `/investigations/${id}`
    ),
  draftAction: (draft: { type: string; target: string; amount: string; finding_ref?: string; verified_amount: string }) =>
    post<{ id: string; status: string; draft_text: string }>("/actions", draft),
  approveAction: (id: string, approved_by: string) =>
    post<Action>(`/actions/${id}/approve`, { approved_by }),
  rejectAction: (id: string, approved_by: string) =>
    post<Action>(`/actions/${id}/reject`, { approved_by }),
  executeAction: (id: string) =>
    post<Action & { simulation_note?: string }>(`/actions/${id}/execute`, {}),
  listActions: () => get<{ actions: Action[] }>("/actions"),
  auditTrail: (id: string) =>
    get<{ action_id: string; trail: { event: string; actor: string; created_at: string; detail: string }[] }>(
      `/actions/${id}/audit`
    ),
};
