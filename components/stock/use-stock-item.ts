"use client"

import { useCallback, useEffect, useState } from "react"
import { getItemByIdApi } from "@/lib/api/items.api"
import { getLotsByItemApi } from "@/lib/api/lots.api"
import { getLocationsApi } from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { toStockItem, type StockItem, type StockLocation, type StockLot } from "./stock-utils"

/** A timestamp fixed for the life of the component (for expiry warnings, without impure renders) */
export function useNow(): number {
  const [now] = useState(() => Date.now())
  return now
}

interface UseStockItemOptions {
  itemId: string
  /** Workspace locations the caller already has. Fetched when omitted or empty. */
  locations?: StockLocation[]
  /** Set false when the flow doesn't need the workspace's location list */
  withLocations?: boolean
}

interface LoadedState {
  item: StockItem | null
  lots: StockLot[]
  fetchedLocations: StockLocation[]
  error: string | null
  /** Which `version` this data belongs to; -1 until the first response */
  version: number
}

export interface StockItemData {
  item: StockItem | null
  lots: StockLot[]
  locations: StockLocation[]
  /** True until the first load finishes */
  loading: boolean
  /** True while a reload() is in flight (existing data stays on screen) */
  refreshing: boolean
  error: string | null
  reload: () => void
}

/**
 * Fresh item + lots (+ workspace locations) for a stock flow. Always refetches on mount so
 * availability reflects the server, not a stale list row.
 */
export function useStockItem({ itemId, locations, withLocations = true }: UseStockItemOptions): StockItemData {
  const { workspaceId } = useWorkspace()
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<LoadedState>({
    item: null,
    lots: [],
    fetchedLocations: [],
    error: null,
    version: -1,
  })

  const hasCallerLocations = !!locations && locations.length > 0
  const needLocations = withLocations && !hasCallerLocations && !!workspaceId

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getItemByIdApi(itemId),
      getLotsByItemApi(itemId).catch(() => null),
      needLocations ? getLocationsApi(workspaceId) : Promise.resolve(null),
    ])
      .then(([itemRes, lotsRes, locationsRes]) => {
        if (cancelled) return
        const raw = itemRes.data?.item
        if (!raw) throw new Error("This item no longer exists")
        const item = toStockItem(raw)
        setState((prev) => ({
          item,
          lots: item.lotTracking ? (lotsRes?.data?.lots ?? []) : [],
          fetchedLocations: locationsRes?.data?.locations ?? prev.fetchedLocations,
          error: null,
          version,
        }))
      })
      .catch((err) => {
        if (cancelled) return
        setState((prev) => ({ ...prev, error: getErrorMessage(err, "Couldn't load this item"), version }))
      })
    return () => {
      cancelled = true
    }
  }, [itemId, workspaceId, needLocations, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])

  return {
    item: state.item,
    lots: state.lots,
    locations: hasCallerLocations ? locations! : state.fetchedLocations,
    loading: state.version === -1,
    refreshing: state.version !== -1 && state.version !== version,
    error: state.error,
    reload,
  }
}
