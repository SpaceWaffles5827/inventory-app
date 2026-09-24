// Pure helpers + shared types for the stock-operation flows (adjust, transfer, remove, scan).
import type { ItemWithDetails, ItemWithRelations } from "@/lib/api/items.api"
import type { LotWithRelations } from "@/lib/api/lots.api"
import type { LocationWithCount } from "@/lib/api/locations.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"

export type StockDirection = "in" | "out"

export type ItemLocationLink = ItemWithRelations["locations"][number]

/** Everything the stock flows need from an item. Satisfied by ItemWithRelations and ItemWithDetails. */
export type StockItem = Pick<
  ItemWithRelations,
  "id" | "name" | "itemNumber" | "unit" | "lotTracking" | "status" | "barcode"
> & {
  onHand: number
  locations: ItemLocationLink[]
  reorderPoint?: number | null
}

/**
 * Callers sometimes only have a partial item (e.g. a row from a location's item list).
 * The flows always refetch the full item by id, so only `id` is required.
 */
export type StockItemRef = { id: string } & Partial<Omit<StockItem, "id">>

export type StockLot = LotWithRelations
export type StockLocation = LocationWithCount

export function toStockItem(item: ItemWithRelations | ItemWithDetails): StockItem {
  return item as StockItem
}

/** Slug used by data-testids built from codes / lot numbers (the e2e tests rely on this exact format) */
export function testIdSlug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "-")
}

/** Units of `item` stored at `locationId` (all lots combined) */
export function itemQuantityAt(item: Pick<StockItem, "locations"> | null | undefined, locationId: string | null): number {
  if (!item || !locationId) return 0
  return item.locations?.find((l) => l.locationId === locationId)?.quantity ?? 0
}

/** Units of `lot` stored at `locationId` */
export function lotQuantityAt(lot: Pick<StockLot, "locations"> | null | undefined, locationId: string | null): number {
  if (!lot || !locationId) return 0
  return lot.locations?.find((l) => l.locationId === locationId)?.quantity ?? 0
}

function time(value: string | Date | null | undefined): number | null {
  if (!value) return null
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? null : t
}

/** First-expired-first-out: expiring lots first, then oldest received */
export function sortLotsFefo<T extends Pick<StockLot, "expirationDate" | "receivedDate">>(lots: T[]): T[] {
  return [...lots].sort((a, b) => {
    const ea = time(a.expirationDate)
    const eb = time(b.expirationDate)
    if (ea !== null && eb !== null && ea !== eb) return ea - eb
    if (ea !== null && eb === null) return -1
    if (ea === null && eb !== null) return 1
    return (time(a.receivedDate) ?? 0) - (time(b.receivedDate) ?? 0)
  })
}

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days from `now` until `date` (negative when in the past) */
export function daysBetween(now: number, date: string | Date | null | undefined): number | null {
  const t = time(date)
  if (t === null) return null
  return Math.ceil((t - now) / DAY_MS)
}

// ---------------------------------------------------------------------------
// Reasons
// ---------------------------------------------------------------------------

export interface ReasonPreset {
  id: string
  label: string
  directions: StockDirection[]
}

export const REASON_PRESETS: ReasonPreset[] = [
  { id: "received", label: "Received", directions: ["in"] },
  { id: "returned", label: "Returned", directions: ["in"] },
  { id: "sold", label: "Sold", directions: ["out"] },
  { id: "damaged", label: "Damaged", directions: ["out"] },
  { id: "cycle-count", label: "Cycle count correction", directions: ["in", "out"] },
]

export interface ReasonValue {
  presetId: string | null
  note: string
}

export const EMPTY_REASON: ReasonValue = { presetId: null, note: "" }

export function presetsFor(direction: StockDirection): ReasonPreset[] {
  return REASON_PRESETS.filter((p) => p.directions.includes(direction))
}

/** Drop a preset that doesn't apply to the new direction (e.g. "Sold" after switching to stock in) */
export function reasonForDirection(reason: ReasonValue, direction: StockDirection): ReasonValue {
  if (!reason.presetId) return reason
  const preset = REASON_PRESETS.find((p) => p.id === reason.presetId)
  return preset && preset.directions.includes(direction) ? reason : { ...reason, presetId: null }
}

/** "Damaged — dropped from pallet", "Received", the note alone, or the fallback */
export function reasonText(reason: ReasonValue, fallback: string): string {
  const preset = REASON_PRESETS.find((p) => p.id === reason.presetId)?.label
  const note = reason.note.trim()
  if (preset && note) return `${preset} — ${note}`
  return preset || note || fallback
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface StockError {
  message: string
  /** The server says our numbers are out of date (409 / insufficient stock) — refetch availability */
  stale: boolean
  /** Units the server says are actually available, when it tells us (409 insufficient stock) */
  available: number | null
}

/**
 * Turn a failed stock call into an inline message. The backend answers 409 with
 * `{ message, data: { available, requested } }` when stock is insufficient (someone else moved it)
 * and 400 with `errors[]` for invalid input.
 */
export function describeStockError(err: unknown, fallback: string): StockError {
  const raw = getErrorMessage(err, fallback).trim()
  const message = /[.!?]$/.test(raw) ? raw : `${raw}.`
  if (err instanceof ApiError) {
    const body = (err.data ?? {}) as { data?: { available?: unknown } }
    const available = typeof body.data?.available === "number" ? body.data.available : null
    if (err.status === 409) {
      const insufficient = available !== null || /insufficient|available/i.test(message)
      return {
        message: insufficient ? `${message} Stock changed since this opened — the numbers have been refreshed.` : message,
        stale: true,
        available,
      }
    }
    if (err.status === 400 && /insufficient|available|cannot remove/i.test(message)) {
      return { message, stale: true, available }
    }
    return { message, stale: false, available }
  }
  return { message, stale: false, available: null }
}

// ---------------------------------------------------------------------------
// Cross-page notification
// ---------------------------------------------------------------------------

export const STOCK_CHANGED_EVENT = "stockflow:stock-changed"

export interface StockChangedDetail {
  itemId: string
  locationIds: string[]
}

/**
 * Fired on window after any successful stock change made through these flows, so views that
 * aren't the caller (e.g. the page behind the global scanner) can refresh:
 *   window.addEventListener(STOCK_CHANGED_EVENT, reload)
 */
export function notifyStockChanged(detail: StockChangedDetail) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<StockChangedDetail>(STOCK_CHANGED_EVENT, { detail }))
}

export function locationOptionsFrom(
  locations: Pick<StockLocation, "id" | "code" | "description">[],
  item: Pick<StockItem, "locations"> | null
): LocationOption[] {
  return locations.map((loc) => ({
    id: loc.id,
    code: loc.code,
    description: loc.description,
    onHand: itemQuantityAt(item, loc.id),
    assigned: !!item?.locations?.some((l) => l.locationId === loc.id),
  }))
}

export interface LocationOption {
  id: string
  code: string
  description?: string | null
  /** Units of the current item/lot here */
  onHand: number
  /** The item has an ItemLocation row here (its "home" locations), even if empty */
  assigned?: boolean
}
