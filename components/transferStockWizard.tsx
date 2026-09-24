"use client"

import { TransferStockDialog, type TransferStockResult } from "@/components/stock/transfer-stock-dialog"
import type { StockItemRef, StockLocation } from "@/components/stock/stock-utils"

interface TransferStockWizardProps {
  /** Item to move. Any object with an `id` works — current stock is loaded when the wizard opens. */
  item: StockItemRef | null
  open: boolean
  onClose: () => void
  onSuccess?: (result: TransferStockResult) => void
  /** All workspace locations (fetched by the wizard when empty) */
  locations?: StockLocation[]
  /** Pre-select the source location */
  defaultFromLocationId?: string
  /** Pre-select the destination location */
  defaultToLocationId?: string
  /** Pre-select a lot (lot-tracked items) */
  defaultLotId?: string
}

/** Move stock between locations. Thin wrapper around the shared TransferStockDialog. */
export function TransferStockWizard({
  item,
  open,
  onClose,
  onSuccess,
  locations,
  defaultFromLocationId,
  defaultToLocationId,
  defaultLotId,
}: TransferStockWizardProps) {
  return (
    <TransferStockDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      item={item}
      locations={locations}
      fromLocationId={defaultFromLocationId}
      toLocationId={defaultToLocationId}
      lotId={defaultLotId}
      onSuccess={onSuccess}
    />
  )
}
