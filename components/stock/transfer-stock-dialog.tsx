"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ArrowRightLeft, MapPin, PackageX, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { AddLocationDialog } from "@/components/addLocationDialog"
import { getWorkspaceStructureApi, type LocationTemplate } from "@/lib/api/locations.api"
import { formatQuantity } from "@/lib/format"
import { useWorkspace } from "@/lib/workspace-context"
import { LocationPicker } from "./location-picker"
import { LotPicker, lotCandidates } from "./lot-picker"
import { QuantityStepper } from "./quantity-stepper"
import { ReasonField } from "./reason-field"
import { transferStockApi } from "@/lib/api/items.api"
import { ItemSummary, QuantityChange, ReviewPanel, type ReviewRow } from "./stock-summary"
import {
  EMPTY_REASON,
  describeStockError,
  itemQuantityAt,
  locationOptionsFrom,
  lotQuantityAt,
  notifyStockChanged,
  type LocationOption,
  type ReasonValue,
  type StockItemRef,
  type StockLocation,
} from "./stock-utils"
import { StockDialog, WizardEmpty, WizardFrame, WizardLoadError, WizardLoading, type WizardStep } from "./stock-wizard"
import { useNow, useStockItem } from "./use-stock-item"

type TransferStep = "source" | "lot" | "destination" | "quantity"

const TITLE = "Transfer stock"

export interface TransferStockResult {
  itemId: string
  fromLocationId: string
  toLocationId: string
  lotId: string | null
  quantity: number
}

export interface TransferStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Item to move. Only `id` is required — current stock is loaded when the dialog opens. */
  item: StockItemRef | null
  /** All workspace locations, if the caller already has them (fetched otherwise) */
  locations?: StockLocation[]
  /** Pre-select the source (skips that step when it has stock) */
  fromLocationId?: string | null
  /** Pre-select the destination */
  toLocationId?: string | null
  /** Pre-select a lot (lot-tracked items) */
  lotId?: string | null
  onSuccess?: (result: TransferStockResult) => void
}

/** Move stock between locations: from → lot (lot-tracked) → to → quantity + note with a live review */
export function TransferStockDialog({ open, onOpenChange, item, ...rest }: TransferStockDialogProps) {
  const [lastItem, setLastItem] = useState(item)
  if (item && item !== lastItem) setLastItem(item)
  const shown = item ?? lastItem

  return (
    <StockDialog open={open && !!shown} onOpenChange={onOpenChange}>
      {(controls) => shown && <TransferStockFlow key={shown.id} itemRef={shown} controls={controls} {...rest} />}
    </StockDialog>
  )
}

interface FlowProps extends Omit<TransferStockDialogProps, "open" | "onOpenChange" | "item"> {
  itemRef: StockItemRef
  controls: { setBusy: (busy: boolean) => void; close: () => void }
}

function TransferStockFlow({
  itemRef,
  controls,
  locations,
  fromLocationId = null,
  toLocationId = null,
  lotId: presetLotId = null,
  onSuccess,
}: FlowProps) {
  const { workspaceId } = useWorkspace()
  const data = useStockItem({ itemId: itemRef.id, locations })
  const now = useNow()

  const [sourceChoice, setSourceChoice] = useState<string | null>(null)
  const [lotChoice, setLotChoice] = useState<string | null>(null)
  const [destChoice, setDestChoice] = useState<string | null>(null)
  const [quantity, setQuantity] = useState<number | null>(null)
  const [note, setNote] = useState<ReasonValue>(EMPTY_REASON)
  const [stepChoice, setStepChoice] = useState<TransferStep | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdLocations, setCreatedLocations] = useState<StockLocation[]>([])
  const [addLocationOpen, setAddLocationOpen] = useState(false)
  const [structure, setStructure] = useState<LocationTemplate | null | undefined>(undefined)

  if (data.loading) {
    return <WizardLoading title={TITLE} icon={ArrowRightLeft} onCancel={controls.close} testId="transfer-stock-dialog-loading" />
  }
  if (!data.item) {
    return (
      <WizardLoadError
        title={TITLE}
        icon={ArrowRightLeft}
        message={data.error ?? "This item couldn't be found."}
        onRetry={data.reload}
        onCancel={controls.close}
      />
    )
  }

  const item = data.item
  const unit = item.unit
  const lotTracked = item.lotTracking

  // ---- Source --------------------------------------------------------------
  const sources: LocationOption[] = item.locations
    .filter((l) => l.quantity > 0)
    .map((l) => ({
      id: l.locationId,
      code: l.location.code,
      description: l.location.description,
      onHand: l.quantity,
      assigned: true,
    }))
    .sort((a, b) => b.onHand - a.onHand || a.code.localeCompare(b.code))
  const presetSourceValid = !!fromLocationId && sources.some((s) => s.id === fromLocationId)
  const sourceId =
    sourceChoice ?? (presetSourceValid ? fromLocationId : sources.length === 1 ? sources[0].id : null)
  const source = sources.find((s) => s.id === sourceId) ?? null
  const sourceCode = source?.code ?? "—"
  const showSourceStep = !presetSourceValid && sources.length !== 1

  // ---- Lot -----------------------------------------------------------------
  const lotsAtSource = lotTracked ? lotCandidates(data.lots, sourceId, true) : []
  const presetLotValid = !!presetLotId && lotsAtSource.some((l) => l.id === presetLotId)
  const lotId = lotTracked
    ? (lotChoice ?? (presetLotValid ? presetLotId : lotsAtSource.length === 1 ? lotsAtSource[0].id : null))
    : null
  const lot = lotId ? (data.lots.find((l) => l.id === lotId) ?? null) : null
  const showLotStep = lotTracked && !presetLotValid && lotsAtSource.length !== 1

  // ---- Destination ---------------------------------------------------------
  const allLocations: StockLocation[] = [
    ...data.locations,
    ...createdLocations.filter((c) => !data.locations.some((l) => l.id === c.id)),
  ]
  const destinations = locationOptionsFrom(allLocations, item)
    .filter((o) => o.id !== sourceId)
  const presetDestValid = !!toLocationId && destinations.some((d) => d.id === toLocationId)
  const destId =
    destChoice && destinations.some((d) => d.id === destChoice)
      ? destChoice
      : presetDestValid
        ? toLocationId
        : destinations.length === 1
          ? destinations[0].id
          : null
  const destination = destinations.find((d) => d.id === destId) ?? null
  const destCode = destination?.code ?? "—"
  const showDestStep = !presetDestValid && destinations.length !== 1

  // ---- Steps ---------------------------------------------------------------
  const steps: WizardStep[] = [
    ...(showSourceStep ? [{ id: "source", label: "From" }] : []),
    ...(showLotStep ? [{ id: "lot", label: "Lot" }] : []),
    ...(showDestStep ? [{ id: "destination", label: "To" }] : []),
    { id: "quantity", label: "Quantity" },
  ]
  const noStock = sources.length === 0
  const step: TransferStep = noStock
    ? "source"
    : stepChoice && steps.some((s) => s.id === stepChoice)
      ? stepChoice
      : (steps[0].id as TransferStep)
  const stepIndex = Math.max(0, steps.findIndex((s) => s.id === step))
  const nextStep = steps[stepIndex + 1]?.id as TransferStep | undefined

  // ---- Quantity ------------------------------------------------------------
  const available = lotTracked ? lotQuantityAt(lot, sourceId) : itemQuantityAt(item, sourceId)
  // Review shows what each location holds of the item overall (all lots), like the location pages do
  const sourceBefore = itemQuantityAt(item, sourceId)
  const destBefore = itemQuantityAt(item, destId)
  const qty = quantity ?? 0
  const quantityProblem = qty > available ? `Only ${formatQuantity(available, unit)} available at ${sourceCode}.` : null
  const ready = !!sourceId && (!lotTracked || !!lotId) && !!destId && destId !== sourceId
  const canSubmit = ready && qty > 0 && !quantityProblem

  // ---- Actions -------------------------------------------------------------
  const goTo = (target: TransferStep) => {
    setError(null)
    setStepChoice(target)
  }
  const goBack = () => {
    if (stepIndex <= 0) controls.close()
    else goTo(steps[stepIndex - 1].id as TransferStep)
  }
  const chooseSource = (id: string) => {
    if (id !== sourceId) {
      setLotChoice(null)
      if (destChoice === id) setDestChoice(null)
    }
    setSourceChoice(id)
    setError(null)
  }
  const openAddLocation = () => {
    setAddLocationOpen(true)
    if (structure === undefined && workspaceId) {
      getWorkspaceStructureApi(workspaceId)
        .then((res) => setStructure(res.data?.structure ?? null))
        .catch(() => setStructure(null))
    }
  }

  const submit = async () => {
    if (!canSubmit || !sourceId || !destId) return
    setSubmitting(true)
    controls.setBusy(true)
    setError(null)
    try {
      const noteText = note.note.trim()
      await transferStockApi(item.id, {
        quantity: qty,
        fromLocationId: sourceId,
        toLocationId: destId,
        lotId: lotId ?? undefined,
        reason: noteText ? `Transfer ${sourceCode} → ${destCode}: ${noteText}` : undefined,
      })
      toast.success("Stock transferred successfully", {
        description: `${formatQuantity(qty, unit)} of ${item.name} moved ${sourceCode} → ${destCode}${
          lot ? ` · lot ${lot.lotNumber}` : ""
        }`,
      })
      notifyStockChanged({ itemId: item.id, locationIds: [sourceId, destId] })
      onSuccess?.({ itemId: item.id, fromLocationId: sourceId, toLocationId: destId, lotId, quantity: qty })
      controls.close()
    } catch (err) {
      const problem = describeStockError(err, "Couldn't transfer stock")
      setError(problem.message)
      if (problem.stale) data.reload()
    } finally {
      setSubmitting(false)
      controls.setBusy(false)
    }
  }

  // ---- Render --------------------------------------------------------------
  const frame = {
    title: TITLE,
    icon: ArrowRightLeft,
    steps,
    currentStep: step,
    top: <ItemSummary id={item.id} name={item.name} itemNumber={item.itemNumber} onHand={item.onHand} unit={unit} />,
    error,
    busy: submitting,
    onBack: goBack,
    backLabel: stepIndex <= 0 ? "Cancel" : "Back",
  }

  if (step === "source") {
    return (
      <WizardFrame
        {...frame}
        testId="transfer-stock-dialog-source"
        description="Where is the stock now?"
        onSubmit={() => nextStep && goTo(nextStep)}
        submitLabel="Next"
        submitDisabled={!source || noStock}
        submitTestId="transfer-stock-next-button"
      >
        {noStock ? (
          <WizardEmpty icon={PackageX} title="Nothing to transfer">
            <p>{item.name} has no stock in any location yet.</p>
          </WizardEmpty>
        ) : (
          <LocationPicker
            label="Transfer from"
            options={sources}
            value={sourceId}
            onChange={chooseSource}
            onConfirm={(id) => {
              chooseSource(id)
              if (nextStep) goTo(nextStep)
            }}
            unit={unit}
            testIdPrefix="transfer-source-option"
          />
        )}
      </WizardFrame>
    )
  }

  if (step === "lot") {
    return (
      <WizardFrame
        {...frame}
        testId="transfer-stock-dialog-lot"
        description={
          <>
            Which lot are you moving from <span className="font-mono font-medium text-foreground">{sourceCode}</span>?
          </>
        }
        onSubmit={() => nextStep && goTo(nextStep)}
        submitLabel="Next"
        submitDisabled={!lotId}
        submitTestId="transfer-stock-next-button"
      >
        <LotPicker
          lots={data.lots}
          locationId={sourceId}
          value={lotId}
          onChange={(id) => {
            setLotChoice(id)
            setError(null)
          }}
          onConfirm={(id) => {
            setLotChoice(id)
            if (nextStep) goTo(nextStep)
          }}
          unit={unit}
          testIdPrefix="transfer-lot-option"
          onlyWithStock
          now={now}
          emptyMessage={`No lots have stock at ${sourceCode}.`}
        />
      </WizardFrame>
    )
  }

  if (step === "destination") {
    return (
      <>
        <WizardFrame
          {...frame}
          testId="transfer-stock-dialog-destination"
          description={
            <>
              Moving from <span className="font-mono font-medium text-foreground">{sourceCode}</span>
              {lot && (
                <>
                  {" "}
                  · lot <span className="font-mono font-medium text-foreground">{lot.lotNumber}</span>
                </>
              )}
              . Where to?
            </>
          }
          onSubmit={() => nextStep && goTo(nextStep)}
          submitLabel="Next"
          submitDisabled={!destination}
          submitTestId="transfer-stock-next-button"
        >
          <LocationPicker
            label="Transfer to"
            options={destinations}
            value={destId}
            onChange={(id) => {
              setDestChoice(id)
              setError(null)
            }}
            onConfirm={(id) => {
              setDestChoice(id)
              if (nextStep) goTo(nextStep)
            }}
            unit={unit}
            testIdPrefix="transfer-destination-option"
            searchTestId="transfer-destination-search-input"
            emptyState={
              <WizardEmpty icon={MapPin} title="No other locations">
                <p>Create another location to move stock into.</p>
                <Button type="button" className="mt-4" onClick={openAddLocation}>
                  <Plus /> New location
                </Button>
              </WizardEmpty>
            }
          />
          {destinations.length > 0 && (
            <Button type="button" variant="ghost" className="h-11 w-full text-primary" onClick={openAddLocation}>
              <Plus /> New location
            </Button>
          )}
        </WizardFrame>
        <AddLocationDialog
          open={addLocationOpen}
          onOpenChange={setAddLocationOpen}
          workspaceId={workspaceId}
          defaultStructure={structure ?? null}
          onStructureUpdate={setStructure}
          existingCodes={allLocations.map((l) => l.code)}
          onSuccess={(created) => {
            setCreatedLocations((prev) => [...prev, created])
            setDestChoice(created.id)
            setAddLocationOpen(false)
          }}
        />
      </>
    )
  }

  // Quantity step
  const reviewRows: ReviewRow[] = [
    ...(lot ? [{ label: "Lot", value: <span className="font-mono font-medium">{lot.lotNumber}</span> }] : []),
    {
      label: `From ${sourceCode}`,
      value: <QuantityChange before={sourceBefore} after={sourceBefore - qty} unit={unit} />,
    },
    {
      label: `To ${destCode}`,
      value: <QuantityChange before={destBefore} after={destBefore + qty} unit={unit} />,
    },
    ...(note.note.trim() ? [{ label: "Note", value: note.note.trim() }] : []),
  ]

  return (
    <WizardFrame
      {...frame}
      testId="transfer-stock-dialog-quantity"
      description={
        <>
          <span className="font-mono font-medium text-foreground">{sourceCode}</span> →{" "}
          <span className="font-mono font-medium text-foreground">{destCode}</span>
          {lot && (
            <>
              {" "}
              · lot <span className="font-mono font-medium text-foreground">{lot.lotNumber}</span>
            </>
          )}
        </>
      }
      onSubmit={submit}
      submitLabel={qty > 0 ? `Transfer ${formatQuantity(qty, unit)}` : "Transfer"}
      submitDisabled={!canSubmit}
      submitTestId="transfer-stock-submit-button"
    >
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="transfer-quantity" className="text-sm">
            Quantity to move
          </Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            Available: {formatQuantity(available, unit)}
          </span>
        </div>
        <QuantityStepper
          id="transfer-quantity"
          value={quantity}
          onChange={(v) => {
            setQuantity(v)
            setError(null)
          }}
          min={0}
          max={available}
          unit={unit}
          invalid={!!quantityProblem}
          inputTestId="transfer-stock-quantity-input"
          aria-describedby="transfer-quantity-help"
        />
        <div id="transfer-quantity-help" className="min-h-5 text-sm">
          {quantityProblem ? (
            <p className="text-destructive">{quantityProblem}</p>
          ) : available > 0 ? (
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => setQuantity(available)}
            >
              Move all {formatQuantity(available, unit)}
            </button>
          ) : null}
        </div>
      </div>

      <ReasonField
        value={note}
        onChange={setNote}
        presets={[]}
        label="Note"
        notePlaceholder="Why is it moving? (optional)"
        noteTestId="transfer-stock-note-input"
        id="transfer-note"
      />

      {qty > 0 && !quantityProblem && <ReviewPanel rows={reviewRows} />}
    </WizardFrame>
  )
}
