const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

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
  severity?: "critical" | "high" | "medium" | "low" | string;
  cash_impact?: string;
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

export interface InvestigationStep {
  tool: string;
  args: Record<string, unknown>;
  status: string;
  evidence_ids: string[];
}

export interface RecommendedAction {
  type?: string;
  target?: string;
  amount?: string;
  reason?: string;
  expected_impact?: string;
  timeframe_days?: number;
}

export interface InvestigationResult {
  question: string;
  steps: InvestigationStep[];
  findings: Finding[];
  recommended_actions: RecommendedAction[];
  narrative: string;
  completed: boolean;
}

export interface InvestigationRecord {
  id: string;
  question: string;
  status: string;
  demo_mode?: boolean;
  result: InvestigationResult;
  verdicts: Verdict[];
}

export interface InvestigationSummary {
  id: string;
  question: string;
  status: string;
  created_at: string;
}

export interface SessionStatus {
  id: string;
  name: string;
  path: string;
  files: Record<string, { present: boolean; rows_accepted?: number; issues?: string[] }>;
  meta_present: boolean;
  ready_for_investigation: boolean;
}

export interface SnapshotKpis {
  as_of: string;
  month: string;
  currency: string;
  cash_on_hand: string;
  revenue_month: string | null;
  revenue_growth_pct: string | null;
  collection_rate_pct: string | null;
  collected_in_month: string;
  overdue_total: string;
  due_soon_total: string;
  payables_due: string;
  forecast_on_time: string;
  forecast_slip: string;
  total_stock_value: string;
  dead_stock_value: string;
  slow_stock_value: string;
  blended_margin_pct: string | null;
  worst_margin_product: string | null;
  worst_margin_pct: string | null;
  leaks_ranked: { label: string; amount: string }[];
}

export interface CollectionItem {
  invoice_id: string;
  customer: string;
  due_date: string;
  days_overdue: number;
  balance: string;
  priority_score: string;
  suggested_type: string;
  expected_impact: string;
  reason: string;
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
  health: () => get<{ status: string }>("/health"),
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
  sessionSnapshot: (sessionId: string) =>
    get<{ id: string; snapshot: SnapshotKpis; collections: { queue: CollectionItem[] } }>(
      `/sessions/${sessionId}/snapshot`
    ),
  template: (kind: string) =>
    get<{ kind: string; filename: string; content: string }>(`/uploads/templates/${kind}`),
  investigate: (question: string, data_dir?: string, demo_mode?: boolean) =>
    post<{ id: string; status: string; demo_mode: boolean; result: InvestigationResult; verdicts: Verdict[] }>(
      "/investigations",
      { question, data_dir, demo_mode }
    ),
  getInvestigation: (id: string) => get<InvestigationRecord>(`/investigations/${id}`),
  listInvestigations: () => get<{ investigations: InvestigationSummary[] }>("/investigations"),
  draftAction: (draft: {
    type: string;
    target: string;
    amount: string;
    finding_ref?: string;
    verified_amount: string;
    currency?: string;
  }) => post<{ id: string; status: string; draft_text: string; whatsapp_text?: string }>("/actions", draft),
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

export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
