"use client"

import Link from "next/link"
import { ArrowRight, PackageCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/states"
import { StockStatusBadge } from "@/components/common/status-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatNumber, formatQuantity } from "@/lib/format"
import { ReportCard } from "./report-card"
import type { LowStockRow } from "./report-data"

export function LowStockList({
  items,
  total,
  loading,
  error,
  onRetry,
  className,
}: {
  items: LowStockRow[] | null
  /** Total number of items needing attention (the list may be truncated) */
  total?: number | null
  loading: boolean
  error: string | null
  onRetry: () => void
  className?: string
}) {
  return (
    <ReportCard
      className={className}
      title="Needs restocking"
      description="Items at or below their reorder point, right now"
      bodyClassName="px-0 sm:px-0"
      data-testid="report-low-stock"
      actions={
        <Button variant="ghost" size="sm" asChild className="h-9">
          <Link href="/dashboard/items">
            All items <ArrowRight />
          </Link>
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-3 px-4 sm:px-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="px-4 sm:px-5">
          <ErrorState title="Couldn't load low stock" message={error} onRetry={onRetry} className="py-8" />
        </div>
      ) : !items || items.length === 0 ? (
        <EmptyState
          bare
          icon={PackageCheck}
          title="Everything is stocked"
          description="No items are at or below their reorder point."
        />
      ) : (
        <ul className="divide-y border-t">
          {items.map((item) => {
            const out = item.onHand <= 0
            return (
              <li key={item.id}>
                <Link
                  href={`/dashboard/items/${item.id}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/50 sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.sku && <span className="font-mono">{item.sku}</span>}
                      {item.sku && item.reorderPoint !== null && <span aria-hidden> · </span>}
                      {item.reorderPoint !== null && <span>Reorder at {formatNumber(item.reorderPoint)}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular-nums">{formatQuantity(item.onHand, item.unit)}</span>
                    <StockStatusBadge status={out ? "OUT_OF_STOCK" : "LOW_STOCK"} />
                  </div>
                </Link>
              </li>
            )
          })}
          {typeof total === "number" && total > items.length && (
            <li className="px-4 py-3 text-xs text-muted-foreground sm:px-5">
              Showing the {formatNumber(items.length)} most urgent of {formatNumber(total)} items.
            </li>
          )}
        </ul>
      )}
    </ReportCard>
  )
}
