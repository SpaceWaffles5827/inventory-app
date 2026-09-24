"use client"

import { useEffect, useState, type ReactNode } from "react"
import Image from "next/image"
import { ArrowRight, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getItemImagesApi } from "@/lib/api/itemImages.api"
import { formatNumber, formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

interface ThumbState {
  itemId: string
  url: string | null
}

/** Square thumbnail from the item's primary image, with a neutral placeholder */
export function ItemThumb({ itemId, alt, className }: { itemId: string; alt: string; className?: string }) {
  const [state, setState] = useState<ThumbState | null>(null)
  const [broken, setBroken] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getItemImagesApi(itemId)
      .then((res) => {
        const images = (res.data?.images ?? []) as { id: string; isPrimary: boolean }[]
        const image = images.find((img) => img.isPrimary) ?? images[0]
        if (!cancelled) setState({ itemId, url: image ? `/api/items/images/image/${image.id}` : null })
      })
      .catch(() => {
        if (!cancelled) setState({ itemId, url: null })
      })
    return () => {
      cancelled = true
    }
  }, [itemId])

  const current = state?.itemId === itemId ? state : null
  const url = current?.url && current.url !== broken ? current.url : null

  return (
    <div
      className={cn(
        "relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
        !current && "animate-pulse",
        className
      )}
    >
      {url ? (
        <Image src={url} alt={alt} fill unoptimized sizes="96px" className="object-cover" onError={() => setBroken(url)} />
      ) : (
        current && <Package className="size-5 text-muted-foreground" aria-hidden />
      )}
    </div>
  )
}

/** Compact "which item is this about" header used at the top of every stock flow */
export function ItemSummary({
  id,
  name,
  itemNumber,
  onHand,
  unit,
  className,
  children,
}: {
  id: string
  name?: string | null
  itemNumber?: string | null
  onHand?: number | null
  unit?: string | null
  className?: string
  children?: ReactNode
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", className)}>
      <ItemThumb itemId={id} alt={name ?? "Item"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name ?? "Loading…"}</p>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {itemNumber && <span className="truncate font-mono">{itemNumber}</span>}
          {itemNumber && typeof onHand === "number" && <span aria-hidden>·</span>}
          {typeof onHand === "number" && (
            <span className="shrink-0 tabular-nums">{formatQuantity(onHand, unit)} on hand</span>
          )}
        </p>
      </div>
      {children}
    </div>
  )
}

/** "10 → 15  +5" */
export function QuantityChange({
  before,
  after,
  unit,
  className,
}: {
  before: number
  after: number
  unit?: string | null
  className?: string
}) {
  const delta = after - before
  return (
    <span className={cn("inline-flex flex-wrap items-center justify-end gap-1.5 tabular-nums", className)}>
      <span className="text-muted-foreground">{formatNumber(before)}</span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="to" />
      <span className={cn("font-semibold", after < 0 && "text-destructive")}>{formatQuantity(after, unit)}</span>
      {delta !== 0 && (
        <Badge variant={delta > 0 ? "success" : "danger"} className="tabular-nums">
          {delta > 0 ? "+" : "−"}
          {formatNumber(Math.abs(delta))}
        </Badge>
      )}
    </span>
  )
}

export interface ReviewRow {
  label: string
  value: ReactNode
}

/** Review of what's about to happen, shown right above the confirm button */
export function ReviewPanel({ rows, className }: { rows: ReviewRow[]; className?: string }) {
  return (
    <section
      aria-label="Review"
      className={cn("rounded-xl border bg-muted/40 p-3.5", className)}
      data-testid="stock-review-panel"
    >
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Review</h3>
      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
            <dd className="min-w-0 text-right break-words">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
