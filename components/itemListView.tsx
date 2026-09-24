"use client"

import Link from "next/link"
import { MapPin, PackageSearch } from "lucide-react"
import { EmptyState } from "@/components/common/empty-state"
import { StockStatusBadge } from "@/components/common/status-badge"
import { ItemImage } from "@/components/imageItem"
import { AdjustStockButton, ItemActionsMenu, type ItemRowActions } from "@/components/items/item-actions-menu"
import {
  getItemStatus,
  getItemValue,
  itemHref,
  locationsSummary,
  type InventoryItem,
} from "@/components/items/item-utils"
import { formatCurrency, formatNumber } from "@/lib/format"

interface ItemListViewProps extends ItemRowActions {
  items: InventoryItem[]
}

/** Roomy list rows: larger thumbnail, category + locations, stock and value */
export function ItemListView({ items, onAdjustmentClick, onTransferClick, onDeleteClick }: ItemListViewProps) {
  if (items.length === 0) {
    return <EmptyState icon={PackageSearch} title="No items to show" />
  }

  return (
    <ul className="divide-y overflow-hidden rounded-xl border bg-card">
      {items.map((item) => (
        <li
          key={item.id}
          className="relative flex items-center gap-4 p-3 transition-colors hover:bg-muted/50 has-[a:focus-visible]:bg-muted/50 sm:p-4"
          data-testid={`item-card-${item.id}`}
        >
          <ItemImage itemId={item.id} alt="" className="size-16 rounded-lg border" sizes="64px" />

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex min-w-0 items-center gap-2">
              <Link
                href={itemHref(item.id)}
                className="truncate font-medium after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                title={item.name}
              >
                {item.name}
              </Link>
              <StockStatusBadge status={getItemStatus(item)} className="hidden lg:inline-flex" />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono">{item.itemNumber}</span>
              {item.category && <span className="truncate">{item.category.name}</span>}
              <span className="inline-flex items-center gap-1 font-mono">
                <MapPin aria-hidden className="size-3" />
                {locationsSummary(item)}
              </span>
            </div>
          </div>

          <div className="w-24 shrink-0 text-right tabular-nums">
            <p>
              <span className="text-lg font-semibold" data-testid="item-stock-value">
                {formatNumber(item.onHand)}
              </span>
              {item.unit && <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>}
            </p>
            <p className="text-xs text-muted-foreground">on hand</p>
          </div>

          <div className="hidden w-28 shrink-0 text-right tabular-nums xl:block">
            <p className="text-sm font-medium">{formatCurrency(getItemValue(item))}</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(item.cost)} each</p>
          </div>

          <StockStatusBadge status={getItemStatus(item)} className="lg:hidden" />

          <div className="relative z-10 flex shrink-0 items-center gap-1">
            {onAdjustmentClick && <AdjustStockButton item={item} onClick={onAdjustmentClick} />}
            <ItemActionsMenu
              item={item}
              onAdjustmentClick={onAdjustmentClick}
              onTransferClick={onTransferClick}
              onDeleteClick={onDeleteClick}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
