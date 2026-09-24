"use client"

import Link from "next/link"
import { PackageSearch } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { StockStatusBadge } from "@/components/common/status-badge"
import { ItemImage } from "@/components/imageItem"
import { AdjustStockButton, ItemActionsMenu, type ItemRowActions } from "@/components/items/item-actions-menu"
import { getItemStatus, getItemValue, itemHref, type InventoryItem } from "@/components/items/item-utils"
import { formatCurrency, formatNumber } from "@/lib/format"

interface ItemGridViewProps extends ItemRowActions {
  items: InventoryItem[]
}

/** Card grid with large thumbnails. The whole card links to the item; action buttons sit above the link. */
export function ItemGridView({ items, onAdjustmentClick, onTransferClick, onDeleteClick }: ItemGridViewProps) {
  if (items.length === 0) {
    return <EmptyState icon={PackageSearch} title="No items to show" />
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4 2xl:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-colors hover:border-primary/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
          data-testid={`item-card-${item.id}`}
        >
          <ItemImage
            itemId={item.id}
            alt=""
            className="aspect-[4/3] w-full border-b"
            sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
          />
          <div className="flex flex-1 flex-col gap-3 p-3 sm:p-4">
            <div className="min-w-0 space-y-1">
              <Link
                href={itemHref(item.id)}
                className="line-clamp-2 font-medium leading-snug after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                title={item.name}
              >
                {item.name}
              </Link>
              <p className="truncate font-mono text-xs text-muted-foreground">{item.itemNumber}</p>
            </div>
            <StockStatusBadge status={getItemStatus(item)} />
            <div className="mt-auto flex items-end justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">On hand</p>
                <p className="tabular-nums">
                  <span className="text-lg font-semibold" data-testid="item-stock-value">
                    {formatNumber(item.onHand)}
                  </span>
                  {item.unit && <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>}
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="truncate text-sm font-medium tabular-nums">{formatCurrency(getItemValue(item))}</p>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-1 border-t pt-3">
              {onAdjustmentClick && <AdjustStockButton item={item} onClick={onAdjustmentClick} showLabel className="flex-1" />}
              <ItemActionsMenu
                item={item}
                onAdjustmentClick={onAdjustmentClick}
                onTransferClick={onTransferClick}
                onDeleteClick={onDeleteClick}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
