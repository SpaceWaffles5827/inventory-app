"use client"

import Link from "next/link"
import { PackageSearch } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { ItemImage } from "@/components/imageItem"
import { ItemActionsMenu, type ItemRowActions } from "@/components/items/item-actions-menu"
import { getItemStatus, itemHref, type InventoryItem } from "@/components/items/item-utils"
import { formatNumber } from "@/lib/format"
import { getStockStatus, type StatusVariant } from "@/lib/stock"
import { cn } from "@/lib/utils"

interface ItemMobileViewProps extends ItemRowActions {
  items: InventoryItem[]
}

// Same palette as the status badges (lib/stock variants), shown as a dot to save width on phones
const DOT_CLASS: Record<StatusVariant, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  info: "bg-info",
  muted: "bg-muted-foreground",
}

/** Compact phone rows: tap the row to open the item, "…" for actions */
export function ItemMobileView({ items, onAdjustmentClick, onTransferClick, onDeleteClick }: ItemMobileViewProps) {
  if (items.length === 0) {
    return <EmptyState icon={PackageSearch} title="No items to show" />
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {items.map((item) => {
        const status = getStockStatus(getItemStatus(item))
        return (
          <li
            key={item.id}
            className="relative flex items-center gap-3 py-2.5 pl-3 pr-1.5 transition-colors active:bg-muted has-[a:focus-visible]:bg-muted/60"
            data-testid={`item-card-${item.id}`}
          >
            <ItemImage itemId={item.id} alt="" className="size-11 rounded-lg border" sizes="44px" />

            <div className="min-w-0 flex-1">
              <Link
                href={itemHref(item.id)}
                className="block truncate text-sm font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
              >
                {item.name}
              </Link>
              <p className="truncate font-mono text-xs text-muted-foreground">{item.itemNumber}</p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-sm tabular-nums">
                <span className="font-semibold" data-testid="item-stock-value">
                  {formatNumber(item.onHand)}
                </span>
                {item.unit && <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>}
              </p>
              <p className="flex h-4 items-center justify-end gap-1.5 text-[11px] text-muted-foreground" title={status.label}>
                <span aria-hidden className={cn("size-2 rounded-full", DOT_CLASS[status.variant])} />
                <span className="sr-only sm:not-sr-only">{status.label}</span>
              </p>
            </div>

            <div className="relative z-10">
              <ItemActionsMenu
                item={item}
                className="size-10"
                onAdjustmentClick={onAdjustmentClick}
                onTransferClick={onTransferClick}
                onDeleteClick={onDeleteClick}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
