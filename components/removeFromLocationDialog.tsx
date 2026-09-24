"use client"

import { RemoveStockDialog } from "@/components/stock/remove-stock-dialog"
import type { StockItemRef } from "@/components/stock/stock-utils"

interface RemoveFromLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The item row from the location page — only `id` is required */
  item: (StockItemRef & { quantity?: number | null }) | null
  locationCode: string
  locationId: string
  onSuccess: () => void
}

/** Remove all of an item's stock from one location. Thin wrapper around the shared RemoveStockDialog. */
export function RemoveFromLocationDialog({
  open,
  onOpenChange,
  item,
  locationCode,
  locationId,
  onSuccess,
}: RemoveFromLocationDialogProps) {
  return (
    <RemoveStockDialog
      open={open}
      onOpenChange={onOpenChange}
      item={item}
      locationId={locationId}
      locationCode={locationCode}
      onSuccess={onSuccess}
    />
  )
}
