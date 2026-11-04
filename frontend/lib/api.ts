const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  }).catch((err: unknown) => {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new Error(
      "Could not reach the backend — it may be waking up or unreachable. Wait a moment and retry."
    );
  });
  if (!res.ok) {
    const text = await res.text();
    let message = `${res.status}: ${text.slice(0, 200)}`;
    try {
      const body = JSON.parse(text) as { detail?: unknown };
      if (typeof body?.detail === "string" && body.detail) message = body.detail;
    } catch {
      // Not JSON — keep the raw status + body.
    }
    throw new Error(message);
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
  dataset_ref?: string;
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

export interface RunwayPoint {
  day: number;
  date: string;
  on_time: string;
  slip: string;
  collected_cum: string;
  paid_cum: string;
}

export interface ChartsPayload {
  as_of: string;
  horizon_days: number;
  currency: string;
  runway: {
    points: RunwayPoint[];
    starting_cash: string;
    on_time_zero_crossing_day: number | null;
    on_time_zero_crossing_date: string | null;
    slip_zero_crossing_day: number | null;
    slip_zero_crossing_date: string | null;
  };
  revenue_trend: {
    months: { month: string; revenue: string; sales_count: number; growth_pct: string | null }[];
  };
  margins: {
    month: string;
    threshold: string;
    products: {
      product_id: string;
      revenue: string;
      gross_profit: string;
      margin_pct: string;
      below_threshold: boolean;
    }[];
    totals: {
      revenue: string;
      cogs: string;
      gross_profit: string;
      blended_margin_pct: string;
    } | null;
    note?: string;
  };
  collections: { queue: CollectionItem[]; queue_total: string; watch_count: number };
  leaks: { label: string; amount: string }[];
  inventory: {
    products: {
      product_id: string;
      stock_value: string;
      status: string;
      days_of_cover: number | null;
    }[];
    total_stock_value: string;
  };
  exposure: {
    customers: {
      customer: string;
      outstanding: string;
      share_pct: string;
      risk: string;
      max_days_overdue: number;
    }[];
    total_outstanding: string;
  };
  assumptions: string[];
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
  uploadFile: (
    sessionId: string,
    filename: string,
    kind: string,
    content: string,
    contentBase64?: string
  ) =>
    post<{ status: string; rows_accepted: number; issues: string[] }>(
      `/sessions/${sessionId}/files`,
      { filename, kind, content, content_base64: contentBase64 ?? null }
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
  investigate: (
    question: string,
    opts?: { data_dir?: string; session_id?: string; demo_mode?: boolean },
    signal?: AbortSignal
  ) =>
    request<{ id: string; status: string; demo_mode: boolean; result: InvestigationResult; verdicts: Verdict[] }>(
      "/investigations",
      {
        method: "POST",
        body: JSON.stringify({
          question,
          data_dir: opts?.data_dir,
          session_id: opts?.session_id,
          demo_mode: opts?.demo_mode,
        }),
        signal,
      }
    ),
  getInvestigation: (id: string) => get<InvestigationRecord>(`/investigations/${id}`),
  sessionCharts: (sessionId: string, horizonDays = 14) =>
    get<{ id: string; charts: ChartsPayload }>(
      `/sessions/${sessionId}/charts?horizon_days=${horizonDays}`
    ),
  investigationCharts: (id: string, horizonDays = 14) =>
    get<{ id: string; charts: ChartsPayload }>(
      `/investigations/${id}/charts?horizon_days=${horizonDays}`
    ),
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
