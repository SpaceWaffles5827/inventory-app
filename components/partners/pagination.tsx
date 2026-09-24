"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Clamp a page number after the underlying list shrinks (filters, deletes) */
export function clampPage(page: number, total: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return Math.min(Math.max(1, page), pages)
}

/** "Showing 11–20 of 42" + previous / next. Renders nothing when everything fits on one page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  noun = "results",
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  noun?: string
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total <= pageSize) return null
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
        of {formatNumber(total)} {noun}
      </p>
      <div className="flex items-center gap-2">
        <span className="hidden tabular-nums sm:inline">
          Page {page} of {pages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="size-10 sm:size-9"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-10 sm:size-9"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
