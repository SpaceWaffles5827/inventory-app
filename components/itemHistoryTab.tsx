"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, History } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ListSkeleton } from "@/components/common/states"
import { SectionHeader } from "@/components/common/page"
import { Pagination, usePagination } from "@/components/common/pagination"
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
  const listRef = useRef<HTMLDivElement>(null)

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

  // Embedded transactions only carry a lotId — fill in lot numbers we already know
  const rows = useMemo(
    () => (state?.rows ?? []).map((tx) => (tx.lot || !lotNumbers.size ? tx : withLot(tx, item, lotNumbers))),
    [state, item, lotNumbers]
  )

  // Fetched cursor pages accumulate; one PAGE_SIZE slice is shown. Without a cursor
  // (the embedded-transactions fallback) this is plain client-side paging.
  const pager = usePagination(rows, PAGE_SIZE, item.id)

  const goToPage = async (next: number) => {
    const cursor = state?.nextCursor
    if (next > Math.ceil(rows.length / PAGE_SIZE)) {
      // Past the last loaded page — fetch the next cursor page first
      if (!cursor || loadingMore) return
      setLoadingMore(true)
      try {
        const res = await getTransactionsApi({ workspaceId, itemId: item.id, limit: PAGE_SIZE, cursor })
        setState((s) =>
          s ? { ...s, rows: [...s.rows, ...res.data.transactions], nextCursor: res.data.nextCursor ?? null } : s
        )
        if (res.data.transactions.length === 0) return
      } catch (err) {
        toast.error(getErrorMessage(err, "Couldn't load more history"))
        return
      } finally {
        setLoadingMore(false)
      }
    }
    pager.setPage(next)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    listRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  }

  return (
    <div ref={listRef} className="scroll-mt-20 lg:scroll-mt-8 overflow-hidden rounded-xl border bg-card">
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
          <TransactionList transactions={pager.pageRows} unit={item.unit} showLot={item.lotTracking} showBalance />
          <Pagination
            className="border-t px-4 py-3"
            page={pager.page}
            pageSize={PAGE_SIZE}
            total={pager.total}
            onPageChange={goToPage}
            noun="movements"
            hasMore={!!state.nextCursor}
            loading={loadingMore}
          />
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
