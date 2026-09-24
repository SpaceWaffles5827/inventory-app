"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { ScanModal } from "@/components/scanModal"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { useWorkspace } from "@/lib/workspace-context"

interface ScanContextValue {
  openScanner: () => void
}

const ScanContext = createContext<ScanContextValue | null>(null)

/** Owns the global scan modal so the sidebar, mobile tab bar and pages can all open it. */
export function ScanProvider({ children }: { children: React.ReactNode }) {
  const { workspaceId } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<ItemWithRelations[]>([])

  // Items are only needed while scanning, so fetch them when the modal opens.
  useEffect(() => {
    if (!open || !workspaceId) return
    let cancelled = false
    getItemsApi(workspaceId)
      .then((res) => {
        if (!cancelled) setItems(res.data?.items ?? [])
      })
      .catch(() => {
        // ScanModal falls back to server lookups; a failed prefetch isn't fatal
      })
    return () => {
      cancelled = true
    }
  }, [open, workspaceId])

  const openScanner = useCallback(() => setOpen(true), [])
  const value = useMemo(() => ({ openScanner }), [openScanner])

  return (
    <ScanContext.Provider value={value}>
      {children}
      <ScanModal open={open} onOpenChange={setOpen} allItems={items} currentWorkspaceId={workspaceId} />
    </ScanContext.Provider>
  )
}

export function useScanner() {
  const ctx = useContext(ScanContext)
  if (!ctx) throw new Error("useScanner must be used inside <ScanProvider>")
  return ctx
}
