"use client"

import { useEffect, useMemo, useState } from "react"
import { getLocationsApi } from "@/lib/api/locations.api"

/**
 * Upper-cased set of the workspace's location codes, for instant "code already exists" checks.
 * Uses `provided` when the caller already has the list; otherwise fetches it once in the background.
 * Returns null until known — the server still enforces uniqueness either way.
 */
export function useLocationCodes(workspaceId: string, provided?: string[]): Set<string> | null {
  const [fetched, setFetched] = useState<string[] | null>(null)

  useEffect(() => {
    if (provided || !workspaceId) return
    let cancelled = false
    getLocationsApi(workspaceId)
      .then((res) => {
        if (!cancelled) setFetched((res.data?.locations ?? []).map((l) => l.code))
      })
      .catch(() => {
        // Non-fatal: the server rejects duplicates and we surface that message instead
      })
    return () => {
      cancelled = true
    }
  }, [provided, workspaceId])

  const list = provided ?? fetched
  return useMemo(() => (list ? new Set(list.map((code) => code.toUpperCase())) : null), [list])
}
