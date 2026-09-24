"use client"

import Link from "next/link"
import { ArrowRightLeft, Diff, Eye, MoreHorizontal, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { itemHref, type InventoryItem } from "./item-utils"

export interface ItemRowActions {
  onAdjustmentClick?: (item: InventoryItem) => void
  onTransferClick?: (item: InventoryItem) => void
  /** Omit to hide Delete (e.g. for non-admins) */
  onDeleteClick?: (item: InventoryItem) => void
}

interface ItemActionsMenuProps extends ItemRowActions {
  item: InventoryItem
  className?: string
}

/** "…" menu used by every inventory view: View, Adjust stock, Transfer, Delete */
export function ItemActionsMenu({ item, onAdjustmentClick, onTransferClick, onDeleteClick, className }: ItemActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-9 text-muted-foreground hover:text-foreground", className)}
          aria-label={`Actions for ${item.name}`}
          data-testid="item-actions-button"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      {/* Menu content is portaled, but React events still bubble to the row — stop them so rows don't navigate */}
      <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem asChild>
          <Link href={itemHref(item.id)}>
            <Eye /> View details
          </Link>
        </DropdownMenuItem>
        {onAdjustmentClick && (
          <DropdownMenuItem onSelect={() => onAdjustmentClick(item)} data-testid="item-adjust-button">
            <Diff /> Adjust stock
          </DropdownMenuItem>
        )}
        {onTransferClick && (
          <DropdownMenuItem onSelect={() => onTransferClick(item)} data-testid="item-transfer-button">
            <ArrowRightLeft /> Transfer
          </DropdownMenuItem>
        )}
        {onDeleteClick && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => onDeleteClick(item)} data-testid="item-delete-button">
              <Trash2 /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Inline quick-adjust button shown next to the menu on desktop rows/cards */
export function AdjustStockButton({
  item,
  onClick,
  className,
  showLabel = false,
}: {
  item: InventoryItem
  onClick: (item: InventoryItem) => void
  className?: string
  showLabel?: boolean
}) {
  return (
    <Button
      variant="outline"
      size={showLabel ? "sm" : "icon"}
      className={cn(!showLabel && "size-9", className)}
      onClick={(e) => {
        e.stopPropagation()
        onClick(item)
      }}
      aria-label={`Adjust stock for ${item.name}`}
      title="Adjust stock"
      data-testid="item-adjust-button"
    >
      <Diff />
      {showLabel && "Adjust"}
    </Button>
  )
}
