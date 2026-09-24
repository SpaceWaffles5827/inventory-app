"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ChevronDown, DollarSign, Download, Loader2, Package, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageContainer, PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, StatsSkeleton } from "@/components/common/states"
import { MovementChart } from "@/components/reports/movement-chart"
import { CategoryBreakdown } from "@/components/reports/category-breakdown"
import { TopMovers, formatChange } from "@/components/reports/top-movers"
import { LowStockList } from "@/components/reports/low-stock-list"
import { PERIODS, normalizeReport, type LowStockRow, type PeriodValue, type ReportData } from "@/components/reports/report-data"
import { dateStamp, downloadCsv, slugify, type CsvValue } from "@/components/reports/csv"
import { getAnalyticsApi } from "@/lib/api/analytics.api"
import { getDashboardSummaryApi } from "@/lib/api/transactions.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

interface SummaryCounts {
  low: number | null
  out: number | null
  items: LowStockRow[]
}

export default function ReportsPage() {
  const { workspaceId, workspace } = useWorkspace()

  const [period, setPeriod] = useState<PeriodValue>("6months")
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const [summary, setSummary] = useState<SummaryCounts | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const periodMeta = PERIODS.find((p) => p.value === period) ?? PERIODS[2]

  const loadReport = useCallback(
    async (range: PeriodValue) => {
      const id = ++requestId.current
      try {
        const res = await getAnalyticsApi(workspaceId, range)
        if (id !== requestId.current) return // a newer period was picked meanwhile
        setReport(normalizeReport(res.data))
        setError(null)
      } catch (err) {
        if (id !== requestId.current) return
        setError(getErrorMessage(err, "Couldn't load reports"))
      } finally {
        if (id === requestId.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [workspaceId]
  )

  // Low-stock list + counts are "right now" numbers, independent of the period
  const loadSummary = useCallback(async () => {
    try {
      const res = await getDashboardSummaryApi(workspaceId)
      const d = res.data
      setSummary({
        low: d?.lowStockCount ?? null,
        out: d?.outOfStockCount ?? null,
        items: (d?.lowStockItems ?? []).map((e) => ({
          id: e.id,
          name: e.name,
          sku: e.itemNumber || null,
          unit: e.unit,
          onHand: e.onHand,
          reorderPoint: e.reorderPoint,
        })),
      })
      setSummaryError(null)
    } catch (err) {
      setSummaryError(getErrorMessage(err, "Couldn't load low-stock items"))
    } finally {
      setSummaryLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    loadReport(period)
  }, [loadReport, period])

  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  const changePeriod = (value: string) => {
    if (value === period) return
    setRefreshing(true)
    setPeriod(value as PeriodValue)
  }

  const retryReport = () => {
    if (report) setRefreshing(true)
    else setLoading(true)
    setError(null)
    loadReport(period)
  }

  const retrySummary = () => {
    setSummaryLoading(true)
    setSummaryError(null)
    loadSummary()
  }

  // ----- derived numbers -----
  const lowStockItems = report?.lowStockItems ?? summary?.items ?? null
  const lowCount = report?.lowStock ?? summary?.low ?? null
  const outCount = report?.outOfStock ?? summary?.out ?? null
  const attention = lowCount !== null || outCount !== null ? (lowCount ?? 0) + (outCount ?? 0) : null

  const valueChange = useMemo(() => {
    const trend = report?.valueTrend
    if (!trend || trend.length < 2) return null
    const first = trend[0]
    const last = trend[trend.length - 1]
    if (first.value <= 0) return null
    return { pct: ((last.value - first.value) / first.value) * 100, since: first.fullLabel }
  }, [report])

  const isEmptyWorkspace =
    report !== null &&
    report.totalItems === 0 &&
    (report.totals === null || (report.totals.in === 0 && report.totals.out === 0))

  // ----- CSV exports -----
  const exportCsv = (name: string, headers: string[], rows: CsvValue[][]) => {
    if (downloadCsv(`${slugify(workspace?.name)}-${name}-${period}-${dateStamp()}.csv`, headers, rows)) {
      toast.success(`Exported ${formatNumber(rows.length)} ${rows.length === 1 ? "row" : "rows"}`)
    } else {
      toast.error("Nothing to export yet")
    }
  }

  const exports = [
    {
      key: "top-movers",
      label: "Top movers",
      disabled: !report?.movers.length,
      run: () =>
        exportCsv(
          "top-movers",
          ["Rank", "Item", "Item number", "Units moved", "Transactions", "Change vs previous period (%)"],
          (report?.movers ?? []).map((m, i) => [
            i + 1,
            m.name,
            m.sku,
            m.units,
            m.movements,
            m.changePct ?? (m.isNew ? "new" : null),
          ])
        ),
    },
    {
      key: "low-stock",
      label: "Low stock",
      disabled: !lowStockItems?.length,
      run: () =>
        exportCsv(
          "low-stock",
          ["Item", "Item number", "On hand", "Unit", "Reorder point", "Status"],
          (lowStockItems ?? []).map((item) => [
            item.name,
            item.sku,
            item.onHand,
            item.unit,
            item.reorderPoint,
            item.onHand <= 0 ? "Out of stock" : "Low stock",
          ])
        ),
    },
    {
      key: "movement",
      label: "Stock movement",
      disabled: !report?.movement?.length,
      run: () =>
        exportCsv(
          "stock-movement",
          ["Period", "Units in", "Units out", "Net", "Transferred"],
          (report?.movement ?? []).map((p) => [p.fullLabel, p.in, p.out, p.net, p.transfers])
        ),
    },
    {
      key: "categories",
      label: "Category breakdown",
      disabled: !report?.categories.length,
      run: () =>
        exportCsv(
          "categories",
          ["Category", "Items", "Units on hand", "Inventory value"],
          (report?.categories ?? []).map((c) => [c.name, c.items, c.units, c.value])
        ),
    },
  ]

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Reports"
        description={workspace ? `Stock movement and inventory value for ${workspace.name}` : "Stock movement and inventory value"}
        actions={
          <>
            <Select value={period} onValueChange={changePeriod} disabled={loading}>
              <SelectTrigger className="h-9 w-[170px]" aria-label="Reporting period" data-testid="report-period">
                <div className="flex min-w-0 items-center gap-2">
                  {refreshing && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={loading || !report} data-testid="report-export">
                  <Download /> Export <ChevronDown className="opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Download CSV</DropdownMenuLabel>
                {exports.map((e) => (
                  <DropdownMenuItem key={e.key} disabled={e.disabled} onSelect={e.run}>
                    {e.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {loading ? (
        <div className="space-y-6" aria-busy>
          <StatsSkeleton />
          <div className="grid gap-6 xl:grid-cols-5">
            <Skeleton className="h-96 rounded-xl xl:col-span-3" />
            <Skeleton className="h-96 rounded-xl xl:col-span-2" />
          </div>
        </div>
      ) : !report ? (
        <ErrorState title="Couldn't load reports" message={error ?? undefined} onRetry={retryReport} />
      ) : isEmptyWorkspace ? (
        <EmptyState
          icon={Package}
          title="No inventory to report on yet"
          description="Reports fill in as soon as you add items and start receiving or shipping stock."
          action={
            <Button asChild>
              <Link href="/dashboard/items">
                <Plus /> Add items
              </Link>
            </Button>
          }
        />
      ) : (
        <div
          className={cn("space-y-6 transition-opacity", refreshing && "pointer-events-none opacity-60")}
          aria-busy={refreshing}
        >
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
            >
              <span>
                <span className="font-medium text-destructive">Couldn&apos;t refresh the report.</span>{" "}
                <span className="text-muted-foreground">{error} Showing the last loaded data.</span>
              </span>
              <Button variant="outline" size="sm" onClick={retryReport}>
                Try again
              </Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard
              label="Inventory value"
              value={report.totalValue !== null ? formatCurrencyCompact(report.totalValue) : "—"}
              icon={DollarSign}
              tone="primary"
              hint={
                valueChange
                  ? `${formatChange(valueChange.pct)} since ${valueChange.since}`
                  : report.totalValue !== null
                    ? `${formatCurrency(report.totalValue)} at cost`
                    : "Not available"
              }
              data-testid="stat-inventory-value"
            />
            <StatCard
              label="Stock in"
              value={report.totals ? formatNumber(report.totals.in) : "—"}
              icon={ArrowDownToLine}
              hint={report.totals ? `Units received · ${periodMeta.short}` : "Not available"}
              data-testid="stat-stock-in"
            />
            <StatCard
              label="Stock out"
              value={report.totals ? formatNumber(report.totals.out) : "—"}
              icon={ArrowUpFromLine}
              hint={
                report.totals
                  ? report.turnover !== null
                    ? `Turnover ${formatNumber(report.turnover)}× · ${periodMeta.short}`
                    : `Units shipped · ${periodMeta.short}`
                  : "Not available"
              }
              data-testid="stat-stock-out"
            />
            <StatCard
              label="Needs attention"
              value={attention !== null ? formatNumber(attention) : "—"}
              icon={AlertTriangle}
              tone={outCount ? "danger" : attention ? "warning" : "default"}
              hint={
                attention !== null
                  ? `${formatNumber(lowCount ?? 0)} low · ${formatNumber(outCount ?? 0)} out of stock`
                  : "Not available"
              }
              href="/dashboard/items"
              data-testid="stat-needs-attention"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <MovementChart
              className="xl:col-span-3"
              movement={report.movement}
              totals={report.totals}
              periodLabel={periodMeta.label}
              granularity={report.granularity}
            />
            <CategoryBreakdown className="xl:col-span-2" categories={report.categories} />
          </div>

          <div className="grid gap-6 xl:grid-cols-5">
            <TopMovers
              className="xl:col-span-3"
              movers={report.movers}
              showChange={report.moversHaveChange}
              periodShort={periodMeta.short}
            />
            <LowStockList
              className="xl:col-span-2"
              items={lowStockItems}
              total={attention}
              loading={!report.lowStockItems && summaryLoading}
              error={!report.lowStockItems ? summaryError : null}
              onRetry={retrySummary}
            />
          </div>
        </div>
      )}
    </PageContainer>
  )
}
