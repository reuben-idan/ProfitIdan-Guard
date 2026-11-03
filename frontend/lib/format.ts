const SYMBOLS: Record<string, string> = { GHS: "GH₵", USD: "$", EUR: "€", GBP: "£", NGN: "₦" };

export function symbolFor(currency: string | undefined): string {
  if (!currency) return "";
  return SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

export function formatMoney(amount: string | number | null | undefined, currency = "GHS"): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  const grouped = new Intl.NumberFormat("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  const sign = n < 0 ? "-" : "";
  return `${sign}${symbolFor(currency)}${grouped}`;
}

export function timeAgo(iso: string | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function severityRank(severity: string | undefined): number {
  return SEVERITY_RANK[(severity ?? "").toLowerCase()] ?? 4;
}
