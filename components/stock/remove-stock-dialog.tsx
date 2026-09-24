"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PackageCheck, PackageMinus } from "lucide-react"
import { adjustStockApi } from "@/lib/api/items.api"
import { adjustLotQuantityApi } from "@/lib/api/lots.api"
import { formatQuantity } from "@/lib/format"
import { lotCandidates } from "./lot-picker"
import { ReasonField } from "./reason-field"
import { ItemSummary, QuantityChange, ReviewPanel, type ReviewRow } from "./stock-summary"
import {
  EMPTY_REASON,
  describeStockError,
  itemQuantityAt,
  lotQuantityAt,
  notifyStockChanged,
  reasonText,
  type ReasonValue,
  type StockItemRef,
} from "./stock-utils"
import { StockDialog, WizardEmpty, WizardFrame, WizardLoadError, WizardLoading } from "./stock-wizard"
import { useStockItem } from "./use-stock-item"

const TITLE = "Remove from location"

export interface RemoveStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: StockItemRef | null
  locationId: string
  locationCode: string
  onSuccess?: () => void
}

/** Take all of an item's stock out of one location (every lot, for lot-tracked items) */
export function RemoveStockDialog({ open, onOpenChange, item, ...rest }: RemoveStockDialogProps) {
  const [lastItem, setLastItem] = useState(item)
  if (item && item !== lastItem) setLastItem(item)
  const shown = item ?? lastItem

  return (
    <StockDialog open={open && !!shown} onOpenChange={onOpenChange}>
      {(controls) => shown && <RemoveStockFlow key={shown.id} itemRef={shown} controls={controls} {...rest} />}
    </StockDialog>
  )
}

interface FlowProps extends Omit<RemoveStockDialogProps, "open" | "onOpenChange" | "item"> {
  itemRef: StockItemRef
  controls: { setBusy: (busy: boolean) => void; close: () => void }
}

function RemoveStockFlow({ itemRef, controls, locationId, locationCode, onSuccess }: FlowProps) {
  const data = useStockItem({ itemId: itemRef.id, withLocations: false })
  const [reason, setReason] = useState<ReasonValue>(EMPTY_REASON)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (data.loading) {
    return <WizardLoading title={TITLE} icon={PackageMinus} onCancel={controls.close} />
  }
  if (!data.item) {
    return (
      <WizardLoadError
        title={TITLE}
        icon={PackageMinus}
        message={data.error ?? "This item couldn't be found."}
        onRetry={data.reload}
        onCancel={controls.close}
      />
    )
  }

  const item = data.item
  const unit = item.unit
  const lotsHere = item.lotTracking ? lotCandidates(data.lots, locationId, true) : []
  // Lot-tracked stock is removed lot by lot, so only what sits in lots can be taken out here.
  const here = item.lotTracking
    ? lotsHere.reduce((sum, lot) => sum + lotQuantityAt(lot, locationId), 0)
    : itemQuantityAt(item, locationId)
  const code = locationCode || item.locations.find((l) => l.locationId === locationId)?.location.code || "this location"

  const submit = async () => {
    if (here <= 0) return
    setSubmitting(true)
    controls.setBusy(true)
    setError(null)
    const reasonString = reasonText(reason, `Removed from location ${code}`)
    let removedLots = 0
    try {
      if (item.lotTracking) {
        for (const lot of lotsHere) {
          const quantity = lotQuantityAt(lot, locationId)
          if (quantity <= 0) continue
          await adjustLotQuantityApi(lot.id, { type: "OUTPUT", quantity, reason: reasonString, locationId })
          removedLots += 1
        }
      } else {
        await adjustStockApi(item.id, { type: "OUTPUT", quantity: here, reason: reasonString, locationId })
      }
      toast.success("Item removed from location", {
        description: `−${formatQuantity(here, unit)} of ${item.name} at ${code} · ${formatQuantity(
          item.onHand - here,
          unit
        )} left on hand`,
      })
      notifyStockChanged({ itemId: item.id, locationIds: [locationId] })
      onSuccess?.()
      controls.close()
    } catch (err) {
      const problem = describeStockError(err, "Couldn't remove the stock")
      setError(
        removedLots > 0
          ? `Removed ${removedLots} of ${lotsHere.length} lots, then: ${problem.message}`
          : problem.message
      )
      if (problem.stale || removedLots > 0) data.reload()
    } finally {
      setSubmitting(false)
      controls.setBusy(false)
    }
  }

  const rows: ReviewRow[] = [
    { label: `At ${code}`, value: <QuantityChange before={here} after={0} unit={unit} /> },
    ...lotsHere.map((lot) => ({
      label: `Lot ${lot.lotNumber}`,
      value: <span className="tabular-nums">−{formatQuantity(lotQuantityAt(lot, locationId), unit)}</span>,
    })),
    { label: "Item total", value: <QuantityChange before={item.onHand} after={item.onHand - here} unit={unit} /> },
    { label: "Reason", value: reasonText(reason, `Removed from location ${code}`) },
  ]

  return (
    <WizardFrame
      testId="remove-from-location-dialog"
      title={TITLE}
      icon={PackageMinus}
      description={
        <>
          Sets the quantity at <span className="font-mono font-medium text-foreground">{code}</span> to 0 and records
          it as stock out.
        </>
      }
      top={<ItemSummary id={item.id} name={item.name} itemNumber={item.itemNumber} onHand={item.onHand} unit={unit} />}
      error={error}
      busy={submitting}
      onBack={controls.close}
      backLabel="Cancel"
      onSubmit={submit}
      submitLabel={here > 0 ? `Remove ${formatQuantity(here, unit)}` : "Remove"}
      submitDisabled={here <= 0}
      submitVariant="destructive"
      submitTestId="remove-from-location-confirm"
    >
      {here <= 0 ? (
        <WizardEmpty icon={PackageCheck} title="Nothing to remove">
          <p>
            There&apos;s no stock of this item at <span className="font-mono">{code}</span>.
          </p>
        </WizardEmpty>
      ) : (
        <>
          <ReasonField value={reason} onChange={setReason} direction="out" noteTestId="remove-from-location-note" />
          <ReviewPanel rows={rows} />
        </>
      )}
    </WizardFrame>
  )
}
