"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Clamp a page number after the underlying list shrinks (filters, deletes) */
export function clampPage(page: number, total: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return Math.min(Math.max(1, page), pages)
}

/**
 * Client-side paging over an already-loaded list. The page snaps back to 1
 * whenever `resetKey` changes (new search / filter / sort) and is clamped when
 * the list shrinks (deletes), so callers never render an empty page.
 */
export function usePagination<T>(rows: T[], pageSize: number, resetKey = "") {
  const [state, setState] = useState({ resetKey, page: 1 })
  const requested = state.resetKey === resetKey ? state.page : 1
  const page = clampPage(requested, rows.length, pageSize)
  return {
    page,
    pageSize,
    total: rows.length,
    pageRows: rows.length > pageSize ? rows.slice((page - 1) * pageSize, page * pageSize) : rows,
    setPage: (next: number) => setState({ resetKey, page: next }),
  }
}

/**
 * "Showing 11–20 of 42" + previous / next. Renders nothing when everything fits on one page.
 * For cursor-paged lists pass `hasMore` while the server has further rows; `total` is then
 * the number loaded so far and "next" stays enabled on the last loaded page.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  noun = "results",
  hasMore = false,
  loading = false,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  noun?: string
  hasMore?: boolean
  loading?: boolean
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize && !hasMore) return null
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-between gap-3 text-sm text-muted-foreground", className)}
    >
      <p className="tabular-nums">
        <span className="font-medium text-foreground">
          {formatNumber(start)}–{formatNumber(end)}
        </span>{" "}
        of {formatNumber(total)}
        {hasMore ? "+" : ""} {noun}
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden tabular-nums sm:inline">
          Page {page}
          {hasMore ? "" : ` of ${pages}`}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-10 sm:size-9"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1 || loading}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-10 sm:size-9"
          onClick={() => onPageChange(page + 1)}
          disabled={(page >= pages && !hasMore) || loading}
          aria-label="Next page"
        >
          {loading ? <Loader2 className="animate-spin" /> : <ChevronRight />}
        </Button>
      </div>
    </nav>
  )
}
