import type { Item, Location } from "@prisma/client"
import type { ItemWithRelations } from "@/lib/api/items.api"
import type { LocationStructure, LocationWithCount } from "@/lib/api/locations.api"

/** GET /api/locations also returns units stored per location (summed from lot locations) */
export type LocationListEntry = LocationWithCount & { totalUnits?: number }

/** One item row returned by GET /api/locations/:id (flattened ItemLocation + item fields) */
export interface LocationItemRow {
  id: string
  itemNumber: string
  name: string
  status: Item["status"]
  unit: string | null
  quantity: number
  minStock: number
  maxStock: number
  notes: string | null
}

/** Shape of GET /api/locations/:id */
export type LocationDetail = Location & {
  _count: { items: number }
  totalUnits?: number
  items: LocationItemRow[]
}

/** Fields the edit dialog / label generator need — satisfied by both list and detail shapes */
export type EditableLocation = Pick<Location, "id" | "code" | "barcode" | "description" | "capacity" | "structure">

/** A location plus derived numbers for the list page */
export interface LocationRow {
  location: LocationListEntry
  structure: LocationStructure
  /** Units stored here; null when the server didn't report it */
  units: number | null
  /** Items assigned to this location */
  items: number
  /** units / capacity; null when unknown */
  utilisation: number | null
  inUse: boolean
}

export function toLocationRow(location: LocationListEntry, structure: LocationStructure): LocationRow {
  const units = typeof location.totalUnits === "number" ? location.totalUnits : null
  const items = location._count?.items ?? 0
  return {
    location,
    structure,
    units,
    items,
    utilisation: units !== null && location.capacity > 0 ? units / location.capacity : null,
    inUse: units !== null ? units > 0 : items > 0,
  }
}

/** The create endpoint returns a location without `_count`; normalise it for list state */
export function toLocationWithCount(location: Location & { _count?: { items: number } }): LocationWithCount {
  const { _count, ...rest } = location
  const { items: _items, ...base } = rest as Location & { items?: unknown }
  return { ...base, _count: { items: _count?.items ?? 0 } }
}

/** Value of stock per item id from the items list: qty at `locationId` × cost */
export function stockValueAt(items: ItemWithRelations[], locationId: string): number {
  let value = 0
  for (const item of items) {
    const row = item.locations?.find((l) => l.locationId === locationId)
    if (row) value += (row.quantity ?? 0) * (item.cost ?? 0)
  }
  return value
}

/** Tone for a utilisation ratio */
export function utilisationTone(ratio: number | null): "default" | "warning" | "danger" {
  if (ratio === null) return "default"
  if (ratio > 1) return "danger"
  if (ratio >= 0.9) return "warning"
  return "default"
}
