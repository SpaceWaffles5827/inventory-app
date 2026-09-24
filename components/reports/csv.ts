// Tiny client-side CSV builder + download helper (no dependencies).

export type CsvValue = string | number | boolean | null | undefined

function escapeCell(value: CsvValue): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  if (typeof value === "boolean") return value ? "true" : "false"
  let text = value
  // Neutralise spreadsheet formula injection for user-supplied text
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n")
}

/** Builds a CSV and triggers a browser download. Returns false when there is nothing to export. */
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): boolean {
  if (typeof window === "undefined" || rows.length === 0) return false
  // BOM so Excel opens UTF-8 names correctly
  const blob = new Blob(["﻿", toCsv(headers, rows)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/** "acme-warehouse" from "Acme Warehouse!" — for file names */
export function slugify(value: string | null | undefined, fallback = "workspace"): string {
  const slug = (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
  return slug || fallback
}

/** 2026-09-24 — stable, sortable date stamp for file names */
export function dateStamp(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
