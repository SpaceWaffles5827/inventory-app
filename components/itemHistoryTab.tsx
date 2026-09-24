"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, History, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ListSkeleton } from "@/components/common/states"
import { SectionHeader } from "@/components/common/page"
import { TransactionList } from "@/components/items/transaction-list"
import { toTransactionEntries, type InventoryItemDetails } from "@/components/items/item-utils"
import { getTransactionsApi, type TransactionEntry } from "@/lib/api/transactions.api"
import type { LotWithRelations } from "@/lib/api/lots.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"

const PAGE_SIZE = 25

interface ItemHistoryTabProps {
  item: InventoryItemDetails
  /** Used to label lots when falling back to the item's embedded transactions */
  lots?: LotWithRelations[]
}

interface HistoryState {
  rows: TransactionEntry[]
  nextCursor: string | null
  /** false when only the item's embedded (latest 10) movements are available */
  complete: boolean
}

/** Stock movements for one item, newest first. Refetches whenever the item is reloaded. */
export function ItemHistoryTab({ item, lots = [] }: ItemHistoryTabProps) {
  const { workspaceId } = useWorkspace()
  const [state, setState] = useState<HistoryState | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const lotNumbers = useMemo(() => new Map(lots.map((l) => [l.id, l.lotNumber])), [lots])

  useEffect(() => {
    let cancelled = false
    getTransactionsApi({ workspaceId, itemId: item.id, limit: PAGE_SIZE })
      .then((res) => {
        if (!cancelled) {
          setState({ rows: res.data.transactions, nextCursor: res.data.nextCursor ?? null, complete: true })
        }
      })
      .catch(() => {
        // The activity endpoint isn't available — show the latest movements that come with the item
        if (!cancelled) setState({ rows: toTransactionEntries(item), nextCursor: null, complete: false })
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, item])

  const loadMore = async () => {
    if (!state?.nextCursor) return
    setLoadingMore(true)
    try {
      const res = await getTransactionsApi({ workspaceId, itemId: item.id, limit: PAGE_SIZE, cursor: state.nextCursor })
      setState((s) =>
        s ? { ...s, rows: [...s.rows, ...res.data.transactions], nextCursor: res.data.nextCursor ?? null } : s
      )
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't load more history"))
    } finally {
      setLoadingMore(false)
    }
  }

  // Embedded transactions only carry a lotId — fill in lot numbers we already know
  const rows = (state?.rows ?? []).map((tx) =>
    tx.lot || !lotNumbers.size ? tx : withLot(tx, item, lotNumbers)
  )

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <SectionHeader
        className="border-b px-4 py-3"
        title="Stock movements"
        description={
          state && !state.complete && rows.length > 0 ? "The most recent movements" : "Every adjustment and transfer, newest first"
        }
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/activity?itemId=${item.id}`}>
              Activity log <ArrowUpRight />
            </Link>
          </Button>
        }
      />
      {state === null ? (
        <ListSkeleton rows={4} className="rounded-none border-0" />
      ) : rows.length === 0 ? (
        <EmptyState bare icon={History} title="No movements yet" description="Adjustments, transfers and received lots will show up here." />
      ) : (
        <>
          <TransactionList transactions={rows} unit={item.unit} showLot={item.lotTracking} showBalance />
          {state.nextCursor && (
            <div className="border-t p-3 text-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="animate-spin" />}
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function withLot(tx: TransactionEntry, item: InventoryItemDetails, lotNumbers: Map<string, string>): TransactionEntry {
  const lotId = item.transactions?.find((t) => t.id === tx.id)?.lotId
  const lotNumber = lotId ? lotNumbers.get(lotId) : undefined
  return lotId && lotNumber ? { ...tx, lot: { id: lotId, lotNumber } } : tx
}
