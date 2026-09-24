// Shared types + pure helpers for the inventory screens (list, item detail, lot detail).
import type { ItemWithDetails, ItemWithRelations } from "@/lib/api/items.api"
import type { TransactionEntry } from "@/lib/api/transactions.api"
import { deriveStockStatus, type StockStatus } from "@/lib/stock"

/**
 * `reorderPoint` is being added to Item on the backend. Typed as optional here so the
 * client compiles both before and after the Prisma client includes it.
 */
export type ReorderPointFields = { reorderPoint?: number | null }

export type InventoryItem = ItemWithRelations & ReorderPointFields
export type InventoryItemDetails = ItemWithDetails & ReorderPointFields
export type ItemTransaction = ItemWithDetails["transactions"][number]
export type ItemLocationLink = ItemWithRelations["locations"][number]

export const DEFAULT_REORDER_POINT = 10

export function getReorderPoint(item: ReorderPointFields): number {
  return typeof item.reorderPoint === "number" ? item.reorderPoint : DEFAULT_REORDER_POINT
}

/** Status derived from on-hand vs. reorder point, so the badge always agrees with the number next to it */
export function getItemStatus(item: { onHand: number } & ReorderPointFields): StockStatus {
  return deriveStockStatus(item.onHand, getReorderPoint(item))
}

export function getItemValue(item: { onHand: number; cost: number }): number {
  return item.onHand * item.cost
}

export function itemHref(id: string): string {
  return `/dashboard/items/${id}`
}

/** Locations that actually hold stock, largest first */
export function stockedLocations(item: { locations?: ItemLocationLink[] | null }): ItemLocationLink[] {
  return (item.locations ?? [])
    .filter((l) => (l.quantity ?? 0) > 0)
    .sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0))
}

/** "A-01-02", "A-01-02 +2" or "—" */
export function locationsSummary(item: { locations?: ItemLocationLink[] | null }): string {
  const stocked = stockedLocations(item)
  if (stocked.length === 0) return "—"
  const first = stocked[0].location?.code ?? "—"
  return stocked.length > 1 ? `${first} +${stocked.length - 1}` : first
}

/**
 * Update query params in place (no navigation, no history entry). Next.js keeps `useSearchParams`
 * in sync with `history.replaceState`. `null`, "" and "all" remove the param.
 */
export function replaceSearchParams(patch: Record<string, string | null>): void {
  const params = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "" || value === "all") params.delete(key)
    else params.set(key, value)
  }
  const qs = params.toString()
  window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
}

/** Same slug the e2e tests use for data-testids built from codes / lot numbers */
export function testIdSlug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-")
}

// Lot dates (received / manufactured / expires) are calendar dates stored as UTC midnight, so they are
// read and formatted in UTC — otherwise "Oct 1" shows as "Sep 30" for anyone west of Greenwich.

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Oct 1, 2026" for a date-only field */
export function formatDateOnly(value: string | Date | null | undefined): string {
  const d = parseDate(value)
  if (!d) return "—"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

/** yyyy-mm-dd of a date-only field, for <input type="date"> */
export function toDateInputValue(value: string | Date | null | undefined): string {
  const d = parseDate(value)
  return d ? d.toISOString().slice(0, 10) : ""
}

/** Today's local date as yyyy-mm-dd */
export function todayInputValue(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Whole days from today until a date-only value (negative when in the past). Null when no date. */
export function daysUntil(date: string | Date | null | undefined): number | null {
  const d = parseDate(date)
  if (!d) return null
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((target - today) / 86_400_000)
}

export type ExpiryTone = "danger" | "warning" | "default"

/** Expiry label + tone: expired → danger, within 30 days → warning */
export function getExpiry(date: string | Date | null | undefined): { days: number; tone: ExpiryTone; label: string } | null {
  const days = daysUntil(date)
  if (days === null) return null
  if (days < 0) return { days, tone: "danger", label: days === -1 ? "Expired yesterday" : `Expired ${-days} days ago` }
  if (days === 0) return { days, tone: "danger", label: "Expires today" }
  if (days <= 30) return { days, tone: "warning", label: days === 1 ? "Expires tomorrow" : `Expires in ${days} days` }
  return { days, tone: "default", label: `Expires in ${days} days` }
}

/** Map an item's embedded transactions (GET /api/items/:id) onto the activity-log shape */
export function toTransactionEntries(
  item: Pick<ItemWithDetails, "id" | "name" | "itemNumber" | "unit"> & { transactions?: ItemTransaction[] | null }
): TransactionEntry[] {
  return (item.transactions ?? []).map((tx) => ({
    id: tx.id,
    type: tx.type,
    quantity: tx.quantity,
    reason: tx.reason,
    previousStock: tx.previousStock,
    newStock: tx.newStock,
    createdAt: new Date(tx.createdAt).toISOString(),
    item: { id: item.id, name: item.name, itemNumber: item.itemNumber, unit: item.unit },
    lot: null,
    fromLocation: tx.fromLocationId && tx.fromLocation ? { id: tx.fromLocationId, code: tx.fromLocation.code } : null,
    toLocation: tx.toLocationId && tx.toLocation ? { id: tx.toLocationId, code: tx.toLocation.code } : null,
    user: tx.user ? { id: tx.user.id, name: tx.user.name ?? tx.user.email } : null,
  }))
}

type CsvValue = string | number | boolean | null | undefined

function csvCell(value: CsvValue): string {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Build a CSV file in the browser and trigger a download */
export function downloadCsv(filename: string, header: string[], rows: CsvValue[][]): void {
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")
  // BOM so Excel opens UTF-8 (e.g. "−" or accented names) correctly
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
