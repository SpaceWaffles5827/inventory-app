"use client"

import { AdjustStockDialog, type AdjustStockResult } from "@/components/stock/adjust-stock-dialog"
import type { StockDirection, StockItemRef } from "@/components/stock/stock-utils"

export interface StockAdjustmentWizardProps {
  /** Item to adjust. Any object with an `id` works — current stock is loaded when the wizard opens. */
  item: StockItemRef | null
  open: boolean
  onClose: () => void
  onSuccess?: (result: AdjustStockResult) => void
  /** Pre-select this location and skip the location step */
  defaultLocationId?: string
  /** Start on "Stock in" (default) or "Stock out" */
  defaultDirection?: StockDirection
  /** Pre-select a lot (lot-tracked items) */
  defaultLotId?: string
}

/** Add / remove stock for one item. Thin wrapper around the shared AdjustStockDialog. */
export function StockAdjustmentWizard({
  item,
  open,
  onClose,
  onSuccess,
  defaultLocationId,
  defaultDirection,
  defaultLotId,
}: StockAdjustmentWizardProps) {
  return (
    <AdjustStockDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      item={item}
      locationId={defaultLocationId}
      lotId={defaultLotId}
      defaultDirection={defaultDirection}
      onSuccess={onSuccess}
    />
  )
}
