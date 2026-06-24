/** Client-safe formatting helpers for the Jobs Dashboard pages. */

// Color-coded status pills so the list is scannable at a glance. Known RMS
// statuses get intentional colors; anything custom gets a stable hashed color.
const STATUS_COLORS: Record<string, string> = {
  "pending sales": "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  "pre-production": "bg-purple-50 text-purple-700 ring-1 ring-purple-100",
  "work in progress": "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  "completed without paperwork": "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
  "waiting for final closure": "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  "invoice pending": "bg-yellow-50 text-yellow-700 ring-1 ring-yellow-100",
  "accounts receivable": "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  closed: "bg-gray-100 text-gray-500 ring-1 ring-gray-200",
};

const STATUS_PALETTE = [
  "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  "bg-purple-50 text-purple-700 ring-1 ring-purple-100",
  "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
  "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100",
  "bg-lime-50 text-lime-700 ring-1 ring-lime-100",
];

export function statusBadgeClass(status: string | null | undefined): string {
  if (!status) return "bg-gray-50 text-gray-400 ring-1 ring-gray-100";
  const key = status.trim().toLowerCase();
  if (STATUS_COLORS[key]) return STATUS_COLORS[key];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return STATUS_PALETTE[h % STATUS_PALETTE.length];
}

export function fmtCurrency(n: number | null | undefined, compact = false): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "2026-06" → "Jun 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** ISO date (YYYY-MM-DD) for an <input type="date">, or "" */
export function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** The next `count` calendar months as { key: "YYYY-MM", label } starting now. */
export function upcomingMonths(count = 6): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: monthLabel(key) });
  }
  return out;
}
