"use client"

import type { MouseEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { PackageSearch } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/common/empty-state"
import { StockStatusBadge } from "@/components/common/status-badge"
import { ItemImage } from "@/components/imageItem"
import { AdjustStockButton, ItemActionsMenu, type ItemRowActions } from "@/components/items/item-actions-menu"
import {
  getItemStatus,
  getItemValue,
  itemHref,
  locationsSummary,
  stockedLocations,
  type InventoryItem,
} from "@/components/items/item-utils"
import { formatCurrency, formatNumber } from "@/lib/format"

interface ItemTableViewProps extends ItemRowActions {
  items: InventoryItem[]
}

/** Desktop inventory table. Rows open the item; actions live in the last column. */
export function ItemTableView({ items, onAdjustmentClick, onTransferClick, onDeleteClick }: ItemTableViewProps) {
  const router = useRouter()

  if (items.length === 0) {
    return <EmptyState icon={PackageSearch} title="No items to show" />
  }

  const openRow = (e: MouseEvent, id: string) => {
    const href = itemHref(id)
    if (e.metaKey || e.ctrlKey) window.open(href, "_blank", "noopener")
    else router.push(href)
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-14 pl-4">
              <span className="sr-only">Image</span>
            </TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="hidden lg:table-cell">Category</TableHead>
            <TableHead className="hidden xl:table-cell">Locations</TableHead>
            <TableHead className="text-right">On hand</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Value</TableHead>
            <TableHead className="w-24 pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const stocked = stockedLocations(item)
            return (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={(e) => openRow(e, item.id)}
                data-testid={`item-row-${item.id}`}
              >
                <TableCell className="py-2.5 pl-4">
                  <ItemImage itemId={item.id} alt="" className="size-10 rounded-lg border" sizes="40px" />
                </TableCell>
                <TableCell className="w-full max-w-0 py-2.5">
                  <Link
                    href={itemHref(item.id)}
                    className="block truncate font-medium hover:underline"
                    title={item.name}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.name}
                  </Link>
                  <p className="truncate font-mono text-xs text-muted-foreground">{item.itemNumber}</p>
                </TableCell>
                <TableCell className="hidden max-w-40 truncate text-muted-foreground lg:table-cell">
                  {item.category?.name ?? "—"}
                </TableCell>
                <TableCell
                  className="hidden font-mono text-xs text-muted-foreground xl:table-cell"
                  title={stocked.map((l) => `${l.location.code}: ${formatNumber(l.quantity)}`).join("\n") || undefined}
                >
                  {locationsSummary(item)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="font-semibold" data-testid="item-stock-value">
                    {formatNumber(item.onHand)}
                  </span>
                  {item.unit && <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>}
                </TableCell>
                <TableCell>
                  <StockStatusBadge status={getItemStatus(item)} />
                </TableCell>
                <TableCell className="hidden text-right tabular-nums lg:table-cell">
                  <div className="font-medium">{formatCurrency(getItemValue(item))}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(item.cost)} each</div>
                </TableCell>
                <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {onAdjustmentClick && <AdjustStockButton item={item} onClick={onAdjustmentClick} />}
                    <ItemActionsMenu
                      item={item}
                      onAdjustmentClick={onAdjustmentClick}
                      onTransferClick={onTransferClick}
                      onDeleteClick={onDeleteClick}
                    />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
