"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type ChartsPayload, type RunwayPoint } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import {
  CHART,
  ChartFrame,
  compactMoney,
  niceBounds,
  scaleLinear,
  shortDate,
} from "./chartkit";

/* Live insight charts: every series comes from the backend (same Decimal
 * figures as the tools), renders as SVG, and downloads as SVG/PNG/CSV.
 * Chart order follows the user's question so the most relevant story leads. */

type Source = { kind: "session" | "investigation"; id: string };
type ChartKey = "runway" | "collections" | "leaks" | "margins" | "revenue";

const HORIZONS = [7, 14, 30] as const;

function orderFor(question?: string): ChartKey[] {
  const base: ChartKey[] = ["runway", "collections", "leaks", "margins", "revenue"];
  if (!question) return base;
  const t = question.toLowerCase();
  const first: ChartKey = /margin|product|price|cost|profitab/.test(t)
    ? "margins"
    : /stock|inventory|dead/.test(t)
      ? "leaks"
      : /chas|collect|customer|who|owe|receiv/.test(t)
        ? "collections"
        : /sales|revenue|growth/.test(t)
          ? "revenue"
          : "runway";
  return [first, ...base.filter((k) => k !== first)];
}

function num(v: string | number | null): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* -- cash runway forecast ------------------------------------------------ */

function RunwayChart({
  points,
  currency,
  horizon,
  crossingDay,
  crossingDate,
}: {
  points: RunwayPoint[];
  currency: string;
  horizon: number;
  crossingDay: number | null;
  crossingDate: string | null;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const defaultSel = crossingDay ?? points.length - 1;
  const [sel, setSel] = useState(defaultSel);
  const [showOn, setShowOn] = useState(true);
  const [showSlip, setShowSlip] = useState(true);

  // New horizon, new story anchor: re-select the crossing (or final) day.
  useEffect(() => {
    setSel(crossingDay ?? points.length - 1);
  }, [points, crossingDay, horizon]);

  const W = 640;
  const H = 300;
  const M = { l: 58, r: 16, t: 16, b: 32 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;

  const values = points.flatMap((p) => [
    ...(showOn ? [num(p.on_time)] : []),
    ...(showSlip ? [num(p.slip)] : []),
  ]);
  const { lo, hi, ticks } = useMemo(
    () => niceBounds(Math.min(0, ...values), Math.max(0, ...values)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, showOn, showSlip]
  );
  const x = (day: number) => M.l + (day / Math.max(horizon, 1)) * iw;
  const y = scaleLinear(lo, hi, M.t + ih, M.t);

  const path = (key: "on_time" | "slip") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.day).toFixed(1)},${y(num(p[key])).toFixed(1)}`).join(" ");

  const tickIdx = useMemo(() => {
    const n = Math.min(5, points.length);
    return Array.from({ length: n }, (_, i) => Math.round((i * (points.length - 1)) / (n - 1)));
  }, [points]);

  function pick(clientX: number, rect: DOMRect): number {
    const px = ((clientX - rect.left) / rect.width) * W;
    const day = Math.round(((px - M.l) / iw) * horizon);
    return Math.min(points.length - 1, Math.max(0, day));
  }

  const end = points[points.length - 1];
  const caption =
    crossingDay !== null && crossingDate
      ? `Slip scenario crosses zero on ${shortDate(crossingDate)} (day ${crossingDay} of ${horizon}). Collect before then.`
      : `Cash stays positive through ${shortDate(end.date)} in both scenarios.`;
  const csv: (string | number | null)[][] = [
    ["day", "date", "on_time", "slip", "collected_cum", "paid_cum"],
    ...points.map((p) => [p.day, p.date, p.on_time, p.slip, p.collected_cum, p.paid_cum]),
  ];
  const selPoint = points[Math.min(sel, points.length - 1)];

  const toggle = (which: "on" | "slip") => {
    if (which === "on" && !showOn) setShowOn(true);
    else if (which === "slip" && !showSlip) setShowSlip(true);
    else if (showOn && showSlip) (which === "on" ? setShowOn : setShowSlip)(false);
  };

  return (
    <ChartFrame
      title="Cash runway forecast"
      caption={caption}
      svgRef={svgRef}
      csv={csv}
      basename={`profitpilot-runway-${horizon}d`}
      labelledBy="chart-runway-desc"
    >
      <div className="flex flex-wrap gap-1.5 px-2 pb-1 sm:px-3">
        {(
          [
            ["on", "Collect on time", showOn, CHART.pine],
            ["slip", "Collections slip", showSlip, CHART.clay],
          ] as const
        ).map(([key, label, on, color]) => (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(key)}
            className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition active:scale-[0.97] ${
              on ? "border-ink/20 bg-white text-ink" : "border-ink/10 bg-ink/5 text-ink/45"
            }`}
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: on ? color : "#c9d2cd" }}
            />
            {label}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-manipulation"
        onMouseMove={(e) => setSel(pick(e.clientX, e.currentTarget.getBoundingClientRect()))}
        onMouseLeave={() => setSel(defaultSel)}
        onClick={(e) => setSel(pick(e.clientX, e.currentTarget.getBoundingClientRect()))}
      >
        <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} y1={y(t)} x2={W - M.r} y2={y(t)} stroke={CHART.grid} strokeOpacity={t === 0 ? 0.45 : 0.12} strokeDasharray={t === 0 ? "5 3" : undefined} strokeWidth="1" />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={CHART.ink} opacity="0.65">
              {compactMoney(t, currency)}
            </text>
          </g>
        ))}
        {tickIdx.map((i) => (
          <text key={points[i].day} x={x(points[i].day)} y={H - 8} textAnchor="middle" fontSize="11" fill={CHART.ink} opacity="0.65">
            {shortDate(points[i].date)}
          </text>
        ))}
        {crossingDay !== null && showSlip && (
          <g>
            <line x1={x(crossingDay)} y1={M.t} x2={x(crossingDay)} y2={M.t + ih} stroke={CHART.clay} strokeOpacity="0.35" strokeDasharray="4 3" strokeWidth="1.5" />
            <circle cx={x(crossingDay)} cy={y(num(points[crossingDay].slip))} r="5" fill={CHART.clay} stroke="#ffffff" strokeWidth="2" />
          </g>
        )}
        {showSlip && <path d={path("slip")} fill="none" stroke={CHART.clay} strokeWidth="2.5" strokeLinejoin="round" />}
        {showOn && <path d={path("on_time")} fill="none" stroke={CHART.pine} strokeWidth="2.5" strokeLinejoin="round" />}
        <line x1={x(selPoint.day)} y1={M.t} x2={x(selPoint.day)} y2={M.t + ih} stroke={CHART.ink} strokeOpacity="0.25" strokeWidth="1" />
        {showSlip && <circle cx={x(selPoint.day)} cy={y(num(selPoint.slip))} r="4.5" fill={CHART.clay} stroke="#ffffff" strokeWidth="2" />}
        {showOn && <circle cx={x(selPoint.day)} cy={y(num(selPoint.on_time))} r="4.5" fill={CHART.pine} stroke="#ffffff" strokeWidth="2" />}
        {showOn && (
          <text x={x(end.day) - 4} y={y(num(end.on_time)) - 8} textAnchor="end" fontSize="12" fontWeight="700" fill={CHART.pineDark}>
            {compactMoney(end.on_time, currency)}
          </text>
        )}
        {showSlip && (
          <text x={x(end.day) - 4} y={y(num(end.slip)) + 16} textAnchor="end" fontSize="12" fontWeight="700" fill={CHART.clay}>
            {compactMoney(end.slip, currency)}
          </text>
        )}
      </svg>
      <p className="px-4 pb-1 text-[13px] leading-snug text-ink/70 sm:px-5" aria-live="polite">
        <strong className="text-ink">{shortDate(selPoint.date)}</strong> (day {selPoint.day} of {horizon}):
        on-time <strong className="tabular-nums">{formatMoney(selPoint.on_time, currency)}</strong>
        {" · "}slip <strong className="tabular-nums">{formatMoney(selPoint.slip, currency)}</strong>
        {" · "}paid so far {formatMoney(selPoint.paid_cum, currency)}
      </p>
    </ChartFrame>
  );
}

/* -- horizontal bars (collections + leaks share the renderer) ------------- */

function HBarChart({
  id,
  title,
  caption,
  basename,
  rows,
  currency,
  money,
}: {
  id: string;
  title: string;
  caption: string;
  basename: string;
  rows: { label: string; sub: string; value: number; display: string; color: string }[];
  currency: string;
  money: boolean;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rowH = 52;
  const W = 640;
  const H = rows.length * rowH + 12;
  const labelW = 168;
  const valueW = 92;
  const bw = W - labelW - valueW - 16;
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  const csv: (string | number | null)[][] = [
    ["label", "detail", "value"],
    ...rows.map((r) => [r.label, r.sub, money ? r.display : String(r.value)]),
  ];
  void currency;
  return (
    <ChartFrame title={title} caption={caption} svgRef={svgRef} csv={csv} basename={basename} labelledBy={id}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
        {rows.map((r, i) => {
          const y = 6 + i * rowH;
          const w = Math.max(3, (Math.abs(r.value) / max) * bw);
          return (
            <g key={r.label}>
              <text x={labelW - 10} y={y + 20} textAnchor="end" fontSize="13" fontWeight="700" fill={CHART.ink}>
                {r.label.length > 22 ? `${r.label.slice(0, 21)}…` : r.label}
              </text>
              <text x={labelW - 10} y={y + 36} textAnchor="end" fontSize="11" fill={CHART.ink} opacity="0.6">
                {r.sub.length > 28 ? `${r.sub.slice(0, 27)}…` : r.sub}
              </text>
              <rect x={labelW} y={y + 6} width={bw} height="22" rx="6" fill={CHART.ink} opacity="0.07" />
              <rect x={labelW} y={y + 6} width={w} height="22" rx="6" fill={r.color} />
              <text x={labelW + w + 8} y={y + 22} fontSize="12" fontWeight="700" fill={CHART.ink} className="tabular-nums">
                {r.display}
              </text>
            </g>
          );
        })}
      </svg>
    </ChartFrame>
  );
}

/* -- vertical bars (margins + revenue share the renderer) ----------------- */

function VBarChart({
  id,
  title,
  caption,
  basename,
  bars,
  threshold,
  thresholdLabel,
  csv,
}: {
  id: string;
  title: string;
  caption: string;
  basename: string;
  bars: { label: string; value: number; display: string; color: string; note?: string }[];
  threshold?: number;
  thresholdLabel?: string;
  csv: (string | number | null)[][];
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const W = 640;
  const H = 264;
  const M = { l: 52, r: 12, t: 30, b: 44 };
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const span = [...bars.map((b) => b.value), 0, ...(threshold !== undefined ? [threshold] : [])];
  const { lo, hi, ticks } = useMemo(
    () => niceBounds(Math.min(...span), Math.max(...span)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bars, threshold]
  );
  const y = scaleLinear(lo, hi, M.t + ih, M.t);
  const slot = iw / Math.max(bars.length, 1);
  const bw = Math.min(64, slot * 0.56);
  const zeroY = y(Math.min(0, hi) >= lo ? 0 : lo);
  return (
    <ChartFrame title={title} caption={caption} svgRef={svgRef} csv={csv} basename={basename} labelledBy={id}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
        <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} y1={y(t)} x2={W - M.r} y2={y(t)} stroke={CHART.grid} strokeOpacity="0.12" strokeWidth="1" />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill={CHART.ink} opacity="0.65">
              {t}
            </text>
          </g>
        ))}
        {threshold !== undefined && threshold >= lo && threshold <= hi && (
          <g>
            <line x1={M.l} y1={y(threshold)} x2={W - M.r} y2={y(threshold)} stroke={CHART.gold} strokeWidth="1.5" strokeDasharray="6 3" />
            <text x={W - M.r} y={y(threshold) - 6} textAnchor="end" fontSize="11" fontWeight="700" fill={CHART.gold}>
              {thresholdLabel ?? `alert ${threshold}`}
            </text>
          </g>
        )}
        {bars.map((b, i) => {
          const cx = M.l + slot * i + slot / 2;
          const top = y(Math.max(b.value, 0));
          const bottom = y(Math.min(b.value, 0));
          const active = sel === i;
          return (
            <g
              key={b.label}
              onMouseEnter={() => setSel(i)}
              onMouseLeave={() => setSel(null)}
              onClick={() => setSel(active ? null : i)}
              opacity={sel === null || active ? 1 : 0.45}
            >
              <rect x={cx - slot / 2} y={M.t} width={slot} height={ih} fill="transparent" />
              <rect x={cx - bw / 2} y={Math.min(top, bottom)} width={bw} height={Math.max(2, Math.abs(bottom - top))} rx="5" fill={b.color} />
              <text x={cx} y={Math.min(top, bottom) - 6} textAnchor="middle" fontSize="12" fontWeight="700" fill={CHART.ink}>
                {b.display}
              </text>
              <text x={cx} y={zeroY + 18} textAnchor="middle" fontSize="11" fontWeight={active ? 700 : 400} fill={CHART.ink} opacity={b.value >= 0 ? 0.7 : 1}>
                {b.label.length > 12 ? `${b.label.slice(0, 11)}…` : b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="min-h-[20px] px-4 pb-1 text-[13px] text-ink/70 sm:px-5" aria-live="polite">
        {sel !== null && bars[sel]?.note ? bars[sel].note : "Hover or tap a bar for detail."}
      </p>
    </ChartFrame>
  );
}

/* -- decision brief: the story the charts tell ---------------------------- */

function DecisionBrief({ charts }: { charts: ChartsPayload }) {
  const { currency } = charts;
  const end = charts.runway.points[charts.runway.points.length - 1];
  const slipEnd = num(end.slip);
  const crossDate = charts.runway.slip_zero_crossing_date;
  const top = charts.collections.queue[0];
  const margins = charts.margins.products;
  const worst = margins.filter((m) => m.below_threshold).sort((a, b) => num(a.margin_pct) - num(b.margin_pct))[0];
  const dead = charts.inventory.products.filter((p) => p.status === "dead_stock");
  const deadTotal = dead.reduce((s, p) => s + num(p.stock_value), 0);
  const bigExposure = charts.exposure.customers.find((c) => num(c.share_pct) >= 30);

  const bullets: { tone: "bad" | "warn" | "good"; text: string }[] = [];
  if (crossDate && slipEnd < 0) {
    bullets.push({
      tone: "bad",
      text: `Cash goes negative on ${shortDate(crossDate)} if collections slip — ending ${formatMoney(end.slip, currency)}. The window to act is ${charts.runway.slip_zero_crossing_day} days.`,
    });
  } else {
    bullets.push({
      tone: "good",
      text: `Cash stays positive through ${shortDate(end.date)} even if collections slip (ends ${formatMoney(end.slip, currency)}).`,
    });
  }
  if (top) {
    const cover = slipEnd < 0 ? Math.min(100, Math.round((num(top.balance) / Math.abs(slipEnd)) * 100)) : null;
    bullets.push({
      tone: "warn",
      text:
        `Chase ${top.customer} first: ${top.invoice_id} at ${formatMoney(top.balance, currency)}, ${top.days_overdue} days overdue.` +
        (cover !== null ? ` Covers ${cover}% of the slip gap alone.` : ""),
    });
  }
  if (worst) {
    bullets.push({
      tone: "warn",
      text: `${worst.product_id} margin is ${worst.margin_pct}% (blended ${charts.margins.totals?.blended_margin_pct ?? "?"}%) — reprice, renegotiate cost, or pause it.`,
    });
  } else if (deadTotal > 0) {
    bullets.push({
      tone: "warn",
      text: `${formatMoney(deadTotal.toFixed(2), currency)} is trapped in dead stock — clear it before reordering anything.`,
    });
  } else if (bigExposure) {
    bullets.push({
      tone: "warn",
      text: `${bigExposure.customer} owes ${formatMoney(bigExposure.outstanding, currency)} (${bigExposure.share_pct}% of all outstanding) — concentration risk.`,
    });
  }
  if (charts.collections.watch_count > 0) {
    bullets.push({
      tone: "good",
      text: `${charts.collections.watch_count} more invoice(s) fall due inside ${charts.horizon_days} days — confirm the dates now, chase only if they slip.`,
    });
  }

  const dot = { bad: "bg-clay", warn: "bg-gold-700", good: "bg-pine-600" } as const;
  return (
    <div className="rounded-xl border border-pine-700/25 bg-pine-950 p-4 text-white shadow-card sm:p-5">
      <h3 className="text-sm font-bold uppercase tracking-widest text-pine-200">Decision brief</h3>
      <ul className="mt-2.5 space-y-2.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-white/90">
            <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot[b.tone]}`} />
            {b.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -- container -------------------------------------------------------------- */

export default function InsightCharts({ source, question }: { source: Source; question?: string }) {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(14);
  const [charts, setCharts] = useState<ChartsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUpdating(true);
    setError(null);
    const fetchCharts =
      source.kind === "session"
        ? api.sessionCharts(source.id, horizon)
        : api.investigationCharts(source.id, horizon);
    fetchCharts
      .then((res) => {
        if (!cancelled) {
          setCharts(res.charts);
          setInitialLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError((err as Error).message);
          setInitialLoading(false);
        }
      })
      .finally(() => {
        if (!cancelled) setUpdating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source.kind, source.id, horizon]);

  const order = useMemo(() => orderFor(question), [question]);

  if (initialLoading) return <LoadingSkeleton lines={4} />;
  if (error || !charts) {
    return (
      <div className="rounded-xl border border-ink/10 bg-white px-4 py-3.5 text-sm text-ink/65 shadow-card">
        Charts unavailable: {error ?? "no data"}. The figures above are unaffected.
      </div>
    );
  }

  const c = charts.currency;
  const byKey: Record<ChartKey, ReactNode> = {
    runway: (
      <RunwayChart
        key="runway"
        points={charts.runway.points}
        currency={c}
        horizon={charts.horizon_days}
        crossingDay={charts.runway.slip_zero_crossing_day}
        crossingDate={charts.runway.slip_zero_crossing_date}
      />
    ),
    collections: charts.collections.queue.length > 0 ? (
      <HBarChart
        key="collections"
        id="chart-collections-desc"
        title="Collection queue — chase in this order"
        caption={`Ranked by cash impact (balance × urgency). Queued: ${formatMoney(charts.collections.queue_total, c)}.`}
        basename={`profitpilot-collections-${charts.horizon_days}d`}
        currency={c}
        money
        rows={charts.collections.queue.slice(0, 5).map((q, i) => ({
          label: q.customer,
          sub: `${q.invoice_id} · ${q.days_overdue}d overdue`,
          value: num(q.balance),
          display: compactMoney(q.balance, c),
          color: i === 0 ? CHART.clay : CHART.pine,
        }))}
      />
    ) : null,
    leaks: (
      <HBarChart
        key="leaks"
        id="chart-leaks-desc"
        title="Where the cash is stuck"
        caption="Ranked by size — collect receivables first, then free the stock."
        basename={`profitpilot-leaks-${charts.horizon_days}d`}
        currency={c}
        money
        rows={charts.leaks.map((l, i) => ({
          label: l.label,
          sub: i === 0 ? "biggest leak" : "also trapped",
          value: num(l.amount),
          display: compactMoney(l.amount, c),
          color: [CHART.clay, CHART.gold, CHART.pine][Math.min(i, 2)],
        }))}
      />
    ),
    margins:
      charts.margins.products.length > 0 ? (
        <VBarChart
          key="margins"
          id="chart-margins-desc"
          title={`Product margins — ${charts.margins.month}`}
          caption={`Blended ${charts.margins.totals?.blended_margin_pct ?? "?"}%. Red bars earn under ${charts.margins.threshold}%.`}
          basename={`profitpilot-margins-${charts.margins.month}`}
          threshold={num(charts.margins.threshold)}
          thresholdLabel={`alert under ${charts.margins.threshold}%`}
          bars={charts.margins.products.map((p) => ({
            label: p.product_id,
            value: num(p.margin_pct),
            display: `${p.margin_pct}%`,
            color: p.below_threshold ? CHART.clay : CHART.pine,
            note: `${p.product_id}: revenue ${formatMoney(p.revenue, c)}, gross ${formatMoney(p.gross_profit, c)}, margin ${p.margin_pct}%.`,
          }))}
          csv={[
            ["product", "revenue", "gross_profit", "margin_pct"],
            ...charts.margins.products.map((p) => [p.product_id, p.revenue, p.gross_profit, p.margin_pct]),
          ]}
        />
      ) : null,
    revenue:
      charts.revenue_trend.months.length > 0 ? (
        <VBarChart
          key="revenue"
          id="chart-revenue-desc"
          title="Revenue trend"
          caption={
            charts.revenue_trend.months.length > 1
              ? `Latest: ${formatMoney(charts.revenue_trend.months[charts.revenue_trend.months.length - 1].revenue, c)} (${charts.revenue_trend.months[charts.revenue_trend.months.length - 1].growth_pct ?? "?"}% vs prior month).`
              : "One month of sales on file — the trend grows as months accumulate."
          }
          basename="profitpilot-revenue-trend"
          bars={charts.revenue_trend.months.map((m) => ({
            label: m.month.slice(2),
            value: num(m.revenue),
            display: compactMoney(m.revenue, c),
            color: CHART.pine,
            note: `${m.month}: ${formatMoney(m.revenue, c)} across ${m.sales_count} sales${m.growth_pct !== null ? `, ${m.growth_pct}% vs prior month` : ""}.`,
          }))}
          csv={[
            ["month", "revenue", "sales_count", "growth_pct"],
            ...charts.revenue_trend.months.map((m) => [m.month, m.revenue, m.sales_count, m.growth_pct]),
          ]}
        />
      ) : null,
  };

  return (
    <section aria-label="Insight charts" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight">Insight charts</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pine-100 px-2.5 py-1 text-xs font-semibold text-pine-900">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${updating ? "animate-pulse bg-gold-700" : "bg-pine-600"}`} />
          {updating ? "Updating…" : "Live from your records"}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-full border border-ink/15 bg-white p-1 shadow-card" role="group" aria-label="Forecast horizon">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHorizon(h)}
              aria-pressed={horizon === h}
              disabled={updating}
              className={`min-h-[36px] rounded-full px-3.5 text-[13px] font-bold transition active:scale-[0.97] disabled:opacity-50 ${
                horizon === h ? "bg-pine-800 text-white" : "text-ink/60 hover:text-ink"
              }`}
            >
              {h}d
            </button>
          ))}
        </div>
      </div>
      <DecisionBrief charts={charts} />
      <div className="space-y-3">{order.map((k) => byKey[k])}</div>
      <p className="text-xs leading-relaxed text-ink/50">
        Forecasts assume in-window receivables arrive on time (or not at all in the slip case) and
        payables are paid when due. No payroll, rent, or new sales included — see assumptions in the data.
      </p>
    </section>
  );
}
