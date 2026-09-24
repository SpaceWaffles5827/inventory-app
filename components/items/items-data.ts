// Data helpers for the inventory screens that go beyond the plain lib/api wrappers.
import { apiRequest } from "@/lib/api/client"
import type { ItemWithRelations } from "@/lib/api/items.api"
import type { LotWithRelations } from "@/lib/api/lots.api"
import type { InventoryItem } from "./item-utils"

type ItemsPage = { data?: { items?: ItemWithRelations[]; nextCursor?: string | null } }

const PAGE_LIMIT = 1000
/** Safety net against a runaway cursor loop (20k items) */
const MAX_PAGES = 20

/** Every item in the workspace. GET /api/items is cursor-paginated (1000 per page). */
export async function fetchAllItems(workspaceId: string): Promise<InventoryItem[]> {
  const items: InventoryItem[] = []
  let cursor: string | undefined
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await apiRequest<ItemsPage>("/api/items", {
      query: { workspaceId, limit: PAGE_LIMIT, cursor },
      errorMessage: "Failed to fetch items",
    })
    items.push(...(res.data?.items ?? []))
    const next = res.data?.nextCursor
    if (!next) break
    cursor = next
  }
  return items
}

/** Lot numbers the backend uses internally */
export const SYSTEM_LOT_NUMBER = "SYSTEM"
export const EXISTING_STOCK_LOT_NUMBER = "EXISTING-STOCK"

/** The hidden SYSTEM lot holds untracked stock and is never shown in lot UIs */
export function isHiddenLot(lot: Pick<LotWithRelations, "lotNumber">): boolean {
  return lot.lotNumber === SYSTEM_LOT_NUMBER
}

/** Display name for a lot ("EXISTING-STOCK" → "Pre-existing stock") */
export function lotDisplayName(lotNumber: string): string {
  return lotNumber === EXISTING_STOCK_LOT_NUMBER ? "Pre-existing stock" : lotNumber
}
