"use client"

import { useMemo } from "react"
import { AdjustStockDialog } from "@/components/stock/adjust-stock-dialog"
import type { StockDirection } from "@/components/stock/stock-utils"
import type { LotWithRelations } from "@/lib/api/lots.api"

interface StockLocationAdjustmentDialogProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  locationId: string | null
  /** @deprecated ignored — the dialog loads current stock itself */
  currentQuantity?: number
  /** @deprecated ignored — read from the item */
  lotTracking?: boolean
  /** @deprecated ignored — lots are loaded fresh when the dialog opens */
  lots?: LotWithRelations[]
  onSuccess: () => void
  /** Pre-select a lot (lot-tracked items) */
  lotId?: string | null
  /** Start on "Stock in" (default) or "Stock out" */
  defaultDirection?: StockDirection
}

/** Adjust an item's stock at one fixed location (item detail → Locations tab). */
export function StockLocationAdjustmentDialog(props: StockLocationAdjustmentDialogProps) {
  const { isOpen, onClose, itemId, locationId, onSuccess, lotId, defaultDirection } = props
  const item = useMemo(() => (itemId ? { id: itemId } : null), [itemId])

  return (
    <AdjustStockDialog
      open={isOpen && !!locationId}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      item={item}
      locationId={locationId}
      lotId={lotId}
      defaultDirection={defaultDirection}
      onSuccess={() => onSuccess()}
    />
  )
}
