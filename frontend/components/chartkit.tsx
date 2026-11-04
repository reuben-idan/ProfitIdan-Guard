"use client";

import type { ReactNode, RefObject } from "react";
import { formatMoney, symbolFor } from "@/lib/format";

/* Dependency-free SVG chart kit: scales, axes helpers, and downloads.
 * Chart elements carry inline presentation attributes (not CSS classes) so
 * exported SVG/PNG files render identically outside the app. */

export const CHART = {
  ink: "#10231b",
  pine: "#1c6a4c",
  pineDark: "#0e4a34",
  clay: "#b3261e",
  gold: "#9a6206",
  goldSoft: "#f8ecd2",
  grid: "#10231b",
  font: '"Avenir Next", "Segoe UI", system-ui, sans-serif',
} as const;

/** Compact axis label: GH₵27k, GH₵1.2m, -GH₵14k. */
export function compactMoney(amount: string | number, currency = "GHS"): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const sym = symbolFor(currency);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const trim = (v: string) => v.replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
  if (abs >= 1_000_000) return `${sign}${sym}${trim((abs / 1_000_000).toFixed(1))}m`;
  if (abs >= 1_000) return `${sign}${sym}${trim((abs / 1_000).toFixed(1))}k`;
  return formatMoney(n.toFixed(2), currency);
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Nice axis bounds spanning [min, max] with ~tickCount gridlines. */
export function niceBounds(min: number, max: number, tickCount = 4): { lo: number; hi: number; ticks: number[] } {
  if (min === max) {
    const pad = Math.abs(min) || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / tickCount;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e8) / 1e8);
  return { lo, hi, ticks };
}

export function scaleLinear(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  const d = domainMax - domainMin || 1;
  return (v: number) => rangeMin + ((v - domainMin) / d) * (rangeMax - rangeMin);
}

/* -- downloads ---------------------------------------------------------- */

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function serializeSvg(svg: SVGSVGElement, title: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `text{font-family:${CHART.font};}`;
  clone.insertBefore(style, clone.firstChild);
  const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "title");
  titleEl.textContent = title;
  clone.insertBefore(titleEl, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

export function downloadSvg(svg: SVGSVGElement | null, basename: string, title: string) {
  if (!svg) return;
  downloadBlob(new Blob([serializeSvg(svg, title)], { type: "image/svg+xml" }), `${basename}.svg`);
}

export function downloadPng(svg: SVGSVGElement | null, basename: string, title: string) {
  if (!svg) return;
  const markup = serializeSvg(svg, title);
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    const scale = 2;
    const w = Number(svg.viewBox.baseVal.width) || svg.clientWidth || 640;
    const h = Number(svg.viewBox.baseVal.height) || svg.clientHeight || 320;
    const canvas = document.createElement("canvas");
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => blob && downloadBlob(blob, `${basename}.png`), "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

export function downloadCsv(rows: (string | number | null)[][], basename: string) {
  const escape = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = rows.map((r) => r.map(escape).join(",")).join("\n") + "\n";
  downloadBlob(new Blob([text], { type: "text/csv" }), `${basename}.csv`);
}

/* -- frame ---------------------------------------------------------------- */

export function ChartFrame({
  title,
  caption,
  svgRef,
  csv,
  basename,
  children,
  labelledBy,
}: {
  title: string;
  caption: string;
  svgRef: RefObject<SVGSVGElement | null>;
  csv: (string | number | null)[][];
  basename: string;
  children: ReactNode;
  labelledBy: string;
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-ink/10 bg-white shadow-card">
      <figcaption className="border-b border-ink/10 px-4 pb-2.5 pt-3.5">
        <p className="text-sm font-bold tracking-tight">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink/60">{caption}</p>
        <span id={labelledBy} className="sr-only">
          {title}. {caption}
        </span>
      </figcaption>
      <div className="px-2 pt-2 sm:px-3" role="img" aria-labelledby={labelledBy}>
        {children}
      </div>
      <div className="no-print flex flex-wrap items-center gap-1.5 px-4 pb-3.5 pt-1">
        <span className="mr-1 text-xs font-semibold text-ink/45">Download:</span>
        {(
          [
            ["SVG", () => svgRef.current && downloadSvg(svgRef.current, basename, title)],
            ["PNG", () => svgRef.current && downloadPng(svgRef.current, basename, title)],
            ["CSV", () => downloadCsv(csv, basename)],
          ] as const
        ).map(([label, fn]) => (
          <button
            key={label}
            type="button"
            onClick={fn}
            className="inline-flex min-h-[36px] items-center rounded-lg border border-ink/15 px-3 text-xs font-bold text-ink/70 transition hover:border-pine-700 hover:text-pine-900 active:scale-[0.97]"
          >
            {label}
          </button>
        ))}
      </div>
    </figure>
  );
}
