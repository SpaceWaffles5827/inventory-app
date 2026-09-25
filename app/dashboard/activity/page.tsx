"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Download, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer, PageHeader } from "@/components/common/page"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton } from "@/components/common/states"
import { Pagination, usePagination } from "@/components/common/pagination"
import { TransactionRow } from "@/components/activity/transaction-row"
import { useWorkspace } from "@/lib/workspace-context"
import { getTransactionsApi, type TransactionEntry, type TransactionType } from "@/lib/api/transactions.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatDate } from "@/lib/format"

type TypeFilter = "ALL" | TransactionType
type RangeFilter = "7" | "30" | "90" | "all"

const PAGE_SIZE = 50

function rangeStart(range: RangeFilter): string | undefined {
  if (range === "all") return undefined
  const d = new Date()
  d.setDate(d.getDate() - Number(range))
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" })
}

function csvCell(value: unknown) {
  const s = value === null || value === undefined ? "" : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default function ActivityPage() {
  // useSearchParams needs a Suspense boundary so the route can still be prerendered
  return (
    <Suspense fallback={<PageContainer><ListSkeleton rows={8} /></PageContainer>}>
      <ActivityView />
    </Suspense>
  )
}

function ActivityView() {
  const { workspaceId } = useWorkspace()
  const searchParams = useSearchParams()
  const itemId = searchParams.get("itemId") ?? undefined
  const locationId = searchParams.get("locationId") ?? undefined

  const [type, setType] = useState<TypeFilter>("ALL")
  const [range, setRange] = useState<RangeFilter>("30")
  const [rows, setRows] = useState<TransactionEntry[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const fetchPage = useCallback(
    (after?: string) =>
      getTransactionsApi({
        workspaceId,
        itemId,
        locationId,
        type: type === "ALL" ? undefined : type,
        from: rangeStart(range),
        limit: PAGE_SIZE,
        cursor: after,
      }),
    [workspaceId, itemId, locationId, type, range]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchPage()
      setRows(res.data.transactions)
      setCursor(res.data.nextCursor ?? null)
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load activity"))
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    load()
  }, [load])

  // Rows accumulate across fetched cursor pages; the view shows one PAGE_SIZE slice.
  // A filter change refetches from scratch, so the page snaps back to 1.
  const pager = usePagination(rows, PAGE_SIZE, [workspaceId, itemId, locationId, type, range].join("|"))

  const goToPage = async (next: number) => {
    if (next > Math.ceil(rows.length / PAGE_SIZE)) {
      // Past the last loaded page — fetch the next cursor page first
      if (!cursor || loadingMore) return
      setLoadingMore(true)
      try {
        const res = await fetchPage(cursor)
        setRows((prev) => [...prev, ...res.data.transactions])
        setCursor(res.data.nextCursor ?? null)
        if (res.data.transactions.length === 0) return
      } catch (err) {
        setError(getErrorMessage(err, "Couldn't load more activity"))
        return
      } finally {
        setLoadingMore(false)
      }
    }
    pager.setPage(next)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    listRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  }

  const groups = useMemo(() => {
    const out: { key: string; label: string; rows: TransactionEntry[] }[] = []
    for (const tx of pager.pageRows) {
      const key = dayKey(tx.createdAt)
      const last = out[out.length - 1]
      if (last && last.key === key) last.rows.push(tx)
      else out.push({ key, label: dayLabel(tx.createdAt), rows: [tx] })
    }
    return out
  }, [pager.pageRows])

  const exportCsv = () => {
    const header = ["Date", "Type", "Item", "Item number", "Quantity", "Unit", "Lot", "From", "To", "Reason", "User"]
    const lines = rows.map((tx) =>
      [
        tx.createdAt,
        tx.type,
        tx.item?.name,
        tx.item?.itemNumber,
        tx.quantity,
        tx.item?.unit,
        tx.lot?.lotNumber === "SYSTEM" ? "" : tx.lot?.lotNumber,
        tx.fromLocation?.code,
        tx.toLocation?.code,
        tx.reason,
        tx.user?.name,
      ]
        .map(csvCell)
        .join(",")
    )
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `stock-activity-${formatDate(new Date()).replace(/[ ,]+/g, "-")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = itemId || locationId

  return (
    <PageContainer>
      <PageHeader
        title="Activity"
        description={
          filtered
            ? "Stock movements filtered to a single item or location."
            : "Every stock movement in this workspace — receipts, removals and transfers."
        }
        back={filtered ? { href: "/dashboard/activity", label: "All activity" } : undefined}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={type} onValueChange={(v) => setType(v as TypeFilter)}>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="INPUT">In</TabsTrigger>
            <TabsTrigger value="OUTPUT">Out</TabsTrigger>
            <TabsTrigger value="TRANSFER">Transfers</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={range} onValueChange={(v) => setRange(v as RangeFilter)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && rows.length === 0 ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <ListSkeleton rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="No activity in this period"
          description="Try a longer time range or a different movement type."
        />
      ) : (
        <div ref={listRef} className="scroll-mt-20 lg:scroll-mt-8 space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <div className="divide-y overflow-hidden rounded-xl border bg-card">
                {group.rows.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            </section>
          ))}
          <Pagination
            page={pager.page}
            pageSize={PAGE_SIZE}
            total={pager.total}
            onPageChange={goToPage}
            noun="movements"
            hasMore={!!cursor}
            loading={loadingMore}
          />
        </div>
      )}
    </PageContainer>
  )
}
