// Shared display formatters. Use these instead of ad-hoc toFixed()/toLocaleString() calls.

const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})
const numberFormatter = new Intl.NumberFormat("en-US")
const compactNumberFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/** $1,234.56 */
export function formatCurrency(value: number | string | null | undefined): string {
  return currencyFormatter.format(toNumber(value))
}

/** $1.2K / $3.4M — only compacts at 10k and above so small values stay exact */
export function formatCurrencyCompact(value: number | string | null | undefined): string {
  const n = toNumber(value)
  return Math.abs(n) >= 10_000 ? compactCurrencyFormatter.format(n) : currencyFormatter.format(n)
}

/** 12,345 */
export function formatNumber(value: number | string | null | undefined): string {
  return numberFormatter.format(toNumber(value))
}

/** 12.3K — only compacts at 10k and above */
export function formatNumberCompact(value: number | string | null | undefined): string {
  const n = toNumber(value)
  return Math.abs(n) >= 10_000 ? compactNumberFormatter.format(n) : numberFormatter.format(n)
}

/** "12 pcs" / "1 box" — unit is optional */
export function formatQuantity(value: number | string | null | undefined, unit?: string | null): string {
  const n = formatNumber(value)
  return unit ? `${n} ${unit}` : n
}

/** Sep 24, 2026 */
export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

/** Sep 24, 2026, 3:04 PM */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
]

/** "3 hours ago", "yesterday", "just now" */
export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  const seconds = Math.round((d.getTime() - Date.now()) / 1000)
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  }
  return "just now"
}

/** "JD" from "Jane Doe" */
export function getInitials(name?: string | null, fallback = "?"): string {
  if (!name) return fallback
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return fallback
  const first = parts[0][0] ?? ""
  const last = parts.length > 1 ? parts[parts.length - 1][0] : ""
  return (first + last).toUpperCase() || fallback
}
