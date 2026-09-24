"use client"

import { useMemo, useState } from "react"
import { FolderTree } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/format"
import { ReportCard, Segmented } from "./report-card"
import type { CategoryRow } from "./report-data"

type Metric = "value" | "units" | "items"

const METRIC_LABEL: Record<Metric, string> = { value: "Value", units: "Units", items: "Items" }
const MAX_ROWS = 7

function formatMetric(metric: Metric, n: number) {
  if (metric !== "value") return formatNumber(n)
  // Whole dollars below the compact threshold so "$9,000" sits comfortably next to "$18K"
  return n >= 10_000 ? formatCurrencyCompact(n) : formatCurrency(Math.round(n)).replace(/\.00$/, "")
}

/** Horizontal bar list: one series, so one colour (chart-1); every value is also printed as text. */
export function CategoryBreakdown({ categories, className }: { categories: CategoryRow[]; className?: string }) {
  const available = useMemo(
    () => (["value", "units", "items"] as Metric[]).filter((m) => categories.some((c) => (c[m] ?? 0) > 0)),
    [categories]
  )
  const [picked, setPicked] = useState<Metric>("value")
  const metric: Metric | undefined = available.includes(picked) ? picked : available[0]

  const rows = useMemo(() => {
    if (!metric) return []
    const sorted = categories
      .map((c) => ({ name: c.name, amount: Math.max(0, c[metric] ?? 0) }))
      .filter((c) => c.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    if (sorted.length <= MAX_ROWS) return sorted
    const head = sorted.slice(0, MAX_ROWS - 1)
    const rest = sorted.slice(MAX_ROWS - 1)
    return [
      ...head,
      { name: `Other (${rest.length} categories)`, amount: rest.reduce((sum, c) => sum + c.amount, 0) },
    ]
  }, [categories, metric])

  const total = rows.reduce((sum, r) => sum + r.amount, 0)
  const max = rows.reduce((m, r) => Math.max(m, r.amount), 0)

  const title = metric === "value" ? "Inventory value by category" : metric === "units" ? "Units by category" : "Items by category"
  const description =
    metric === "value" ? "Current on-hand stock at cost" : metric === "units" ? "Current units on hand" : "Number of items (SKUs)"

  return (
    <ReportCard
      className={className}
      title={title}
      description={description}
      data-testid="report-categories"
      actions={
        metric && available.length > 1 ? (
          <Segmented
            label="Category metric"
            value={metric}
            onChange={setPicked}
            options={available.map((m) => ({ value: m, label: METRIC_LABEL[m] }))}
          />
        ) : undefined
      }
    >
      {rows.length === 0 || !metric ? (
        <EmptyState
          bare
          icon={FolderTree}
          title="Nothing to break down yet"
          description="Add items with categories and stock to see how your inventory is split."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Total <span className="font-semibold text-foreground">{formatMetric(metric, total)}</span>
          </p>
          <ul className="space-y-3">
            {rows.map((row, i) => {
              const share = total > 0 ? row.amount / total : 0
              return (
                <li key={`${row.name}-${i}`} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate" title={row.name}>
                      {row.name}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium">{formatMetric(metric, row.amount)}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {share < 0.01 ? "<1" : Math.round(share * 100)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${max > 0 ? Math.max(2, (row.amount / max) * 100) : 0}%`, background: "var(--chart-1)" }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </ReportCard>
  )
}
