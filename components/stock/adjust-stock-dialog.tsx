"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Boxes, MapPin, PackageMinus, Plus, SlidersHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AddLocationDialog } from "@/components/addLocationDialog"
import { adjustStockApi } from "@/lib/api/items.api"
import { adjustLotQuantityApi, createLotApi } from "@/lib/api/lots.api"
import { getWorkspaceStructureApi, type LocationTemplate } from "@/lib/api/locations.api"
import { formatDate, formatQuantity } from "@/lib/format"
import { useWorkspace } from "@/lib/workspace-context"
import { DirectionToggle } from "./direction-toggle"
import { LocationPicker } from "./location-picker"
import { EMPTY_NEW_LOT, LotPicker, NEW_LOT, lotCandidates, type NewLotDraft } from "./lot-picker"
import { QuantityStepper } from "./quantity-stepper"
import { ReasonField } from "./reason-field"
import { ItemSummary, QuantityChange, ReviewPanel, type ReviewRow } from "./stock-summary"
import {
  EMPTY_REASON,
  describeStockError,
  itemQuantityAt,
  locationOptionsFrom,
  lotQuantityAt,
  notifyStockChanged,
  reasonForDirection,
  reasonText,
  type ReasonValue,
  type StockDirection,
  type StockItemRef,
  type StockLocation,
} from "./stock-utils"
import { StockDialog, WizardEmpty, WizardFrame, WizardLoadError, WizardLoading, type WizardStep } from "./stock-wizard"
import { useNow, useStockItem } from "./use-stock-item"

type AdjustStep = "location" | "lot" | "quantity"

const RESERVED_LOT_NUMBERS = ["SYSTEM", "EXISTING-STOCK"]
const TITLE = "Adjust stock"

export interface AdjustStockResult {
  itemId: string
  locationId: string
  lotId: string | null
  direction: StockDirection
  quantity: number
  /** Item total after the change (null if unknown) */
  onHand: number | null
}

export interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Item to adjust. Only `id` is required — current stock is loaded when the dialog opens. */
  item: StockItemRef | null
  /** Pre-select this location and skip the location step */
  locationId?: string | null
  /** Pre-select a lot (lot-tracked items) */
  lotId?: string | null
  /** Start on "Stock in" (default) or "Stock out" */
  defaultDirection?: StockDirection
  onSuccess?: (result: AdjustStockResult) => void
}

/**
 * The one stock-adjustment flow: Stock in / out → location → lot (lot-tracked items) →
 * quantity + reason with a live review → submit.
 */
export function AdjustStockDialog({ open, onOpenChange, item, ...rest }: AdjustStockDialogProps) {
  // Keep showing the last item while the sheet animates closed (callers clear `item` on close).
  const [lastItem, setLastItem] = useState(item)
  if (item && item !== lastItem) setLastItem(item)
  const shown = item ?? lastItem

  return (
    <StockDialog open={open && !!shown} onOpenChange={onOpenChange}>
      {(controls) => shown && <AdjustStockFlow key={shown.id} itemRef={shown} controls={controls} {...rest} />}
    </StockDialog>
  )
}

interface FlowProps extends Omit<AdjustStockDialogProps, "open" | "onOpenChange" | "item"> {
  itemRef: StockItemRef
  controls: { setBusy: (busy: boolean) => void; close: () => void }
}

function AdjustStockFlow({
  itemRef,
  controls,
  locationId: fixedLocationId = null,
  lotId: presetLotId = null,
  defaultDirection = "in",
  onSuccess,
}: FlowProps) {
  const { workspaceId } = useWorkspace()
  const data = useStockItem({ itemId: itemRef.id })
  const now = useNow()

  const [direction, setDirection] = useState<StockDirection>(defaultDirection)
  const [locationChoice, setLocationChoice] = useState<string | null>(null)
  const [lotChoice, setLotChoice] = useState<string | null>(null)
  const [newLot, setNewLot] = useState<NewLotDraft>(EMPTY_NEW_LOT)
  const [quantity, setQuantity] = useState<number | null>(null)
  /** The quantity came from the "counted total" field — a count correction unless a reason says otherwise */
  const [fromCount, setFromCount] = useState(false)
  const [reason, setReason] = useState<ReasonValue>(EMPTY_REASON)
  const [stepChoice, setStepChoice] = useState<AdjustStep | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdLocations, setCreatedLocations] = useState<StockLocation[]>([])
  const [addLocationOpen, setAddLocationOpen] = useState(false)
  const [structure, setStructure] = useState<LocationTemplate | null | undefined>(undefined)

  if (data.loading) {
    return <WizardLoading title={TITLE} icon={SlidersHorizontal} onCancel={controls.close} testId="stock-adjustment-dialog-loading" />
  }
  if (!data.item) {
    return (
      <WizardLoadError
        title={TITLE}
        icon={SlidersHorizontal}
        message={data.error ?? "This item couldn't be found."}
        onRetry={data.reload}
        onCancel={controls.close}
      />
    )
  }

  const item = data.item
  const unit = item.unit
  const lotTracked = item.lotTracking

  // ---- Locations -----------------------------------------------------------
  const allLocations: StockLocation[] = [
    ...data.locations,
    ...createdLocations.filter((c) => !data.locations.some((l) => l.id === c.id)),
  ]
  const options = locationOptionsFrom(allLocations, item)
  // The caller's location might not be in the workspace list yet (e.g. just created) — keep it selectable.
  if (fixedLocationId && !options.some((o) => o.id === fixedLocationId)) {
    const link = item.locations.find((l) => l.locationId === fixedLocationId)
    options.push({
      id: fixedLocationId,
      code: link?.location.code ?? "Selected location",
      description: link?.location.description,
      onHand: link?.quantity ?? 0,
      assigned: !!link,
    })
  }
  const withStock = options.filter((o) => o.onHand > 0)
  const homeOptions = options.filter((o) => o.assigned || o.onHand > 0)
  const candidateLocations = direction === "out" ? withStock : options

  const autoLocationId =
    fixedLocationId ??
    (options.length === 1 ? options[0].id : null) ??
    (direction === "out"
      ? withStock.length === 1
        ? withStock[0].id
        : null
      : homeOptions.length === 1
        ? homeOptions[0].id
        : null)
  const locationId = locationChoice ?? autoLocationId
  const location = options.find((o) => o.id === locationId) ?? null
  const locationCode = location?.code ?? "this location"
  const showLocationStep = !fixedLocationId && options.length !== 1

  // ---- Lots ----------------------------------------------------------------
  const lotOptions = lotTracked ? lotCandidates(data.lots, locationId, direction === "out") : []
  const canCreateLot = lotTracked && direction === "in"
  const presetLotValid = !!presetLotId && lotOptions.some((l) => l.id === presetLotId)
  const autoLotId = !lotTracked
    ? null
    : presetLotValid
      ? presetLotId
      : lotOptions.length === 1
        ? lotOptions[0].id
        : canCreateLot && lotOptions.length === 0
          ? NEW_LOT
          : null
  const lotId = lotTracked ? (lotChoice ?? autoLotId) : null
  const creatingLot = lotId === NEW_LOT
  const selectedLot = lotId && !creatingLot ? (data.lots.find((l) => l.id === lotId) ?? null) : null
  const lotLabel = creatingLot ? newLot.lotNumber.trim() || "New lot" : selectedLot?.lotNumber

  // ---- Steps ---------------------------------------------------------------
  const steps: WizardStep[] = [
    ...(showLocationStep ? [{ id: "location", label: "Location" }] : []),
    ...(lotTracked ? [{ id: "lot", label: "Lot" }] : []),
    { id: "quantity", label: "Quantity" },
  ]
  const step: AdjustStep =
    stepChoice && steps.some((s) => s.id === stepChoice) ? stepChoice : (steps[0].id as AdjustStep)
  const stepIndex = steps.findIndex((s) => s.id === step)
  const nextStep = steps[stepIndex + 1]?.id as AdjustStep | undefined

  // ---- Quantity ------------------------------------------------------------
  const before = lotTracked ? (creatingLot ? 0 : lotQuantityAt(selectedLot, locationId)) : itemQuantityAt(item, locationId)
  const qty = quantity ?? 0
  const signed = direction === "in" ? qty : -qty
  const after = before + signed

  const defaultReason = fromCount ? "Cycle count correction" : "Stock adjustment"

  // ---- Validation ----------------------------------------------------------
  const locationValid = !!locationId && candidateLocations.some((o) => o.id === locationId)
  const newLotNumber = newLot.lotNumber.trim()
  let lotProblem: string | null = null
  if (lotTracked) {
    if (!lotId) lotProblem = "Choose a lot"
    else if (creatingLot) {
      if (direction === "out") lotProblem = "A new lot can only receive stock"
      else if (!newLotNumber) lotProblem = "Enter a lot number"
      else if (RESERVED_LOT_NUMBERS.includes(newLotNumber.toUpperCase()))
        lotProblem = `“${newLotNumber}” is reserved — choose another lot number`
      else if (data.lots.some((l) => l.lotNumber.toLowerCase() === newLotNumber.toLowerCase()))
        lotProblem = `Lot ${newLotNumber} already exists — pick it from the list instead`
      else if (location && !location.assigned)
        lotProblem = `${locationCode} isn't one of this item's locations yet. Receive the new lot into one of its locations, or add ${locationCode} to the item first.`
    }
  }
  let quantityProblem: string | null = null
  if (direction === "out" && before <= 0) {
    quantityProblem = lotTracked && lotLabel
      ? `Nothing to remove — lot ${lotLabel} has no stock at ${locationCode}.`
      : `Nothing to remove — there's no stock at ${locationCode}.`
  } else if (direction === "out" && qty > before) {
    quantityProblem = `Only ${formatQuantity(before, unit)} available at ${locationCode}${lotLabel ? ` in lot ${lotLabel}` : ""}.`
  }
  const canSubmit = locationValid && !lotProblem && qty > 0 && !quantityProblem

  // ---- Actions -------------------------------------------------------------
  const goTo = (target: AdjustStep) => {
    setError(null)
    setStepChoice(target)
  }

  const goBack = () => {
    if (stepIndex <= 0) controls.close()
    else goTo(steps[stepIndex - 1].id as AdjustStep)
  }

  const changeDirection = (next: StockDirection) => {
    if (next === direction) return
    setDirection(next)
    setReason((r) => reasonForDirection(r, next))
    if (next === "out" && lotChoice === NEW_LOT) setLotChoice(null)
    setError(null)
  }

  const chooseLocation = (id: string) => {
    if (id !== locationId) setLotChoice(null)
    setLocationChoice(id)
    setError(null)
  }

  /** "New total" field: work out the direction and amount from the counted quantity */
  const setCountedTotal = (target: number | null) => {
    if (target === null) {
      setQuantity(null)
      return
    }
    const delta = target - before
    if (delta > 0) changeDirection("in")
    if (delta < 0) changeDirection("out")
    setQuantity(Math.abs(delta))
    setFromCount(true)
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
    if (!canSubmit || !locationId) return
    setSubmitting(true)
    controls.setBusy(true)
    setError(null)
    const type = direction === "in" ? "INPUT" : "OUTPUT"
    const reasonString = reasonText(reason, defaultReason)
    try {
      let onHand: number | null = item.onHand + signed
      if (lotTracked && creatingLot) {
        await createLotApi(item.id, {
          lotNumber: newLotNumber,
          quantity: qty,
          expirationDate: newLot.expirationDate || undefined,
          locationAssignments: [{ locationId, quantity: qty }],
          notes: reason.note.trim() || undefined,
        })
      } else if (lotTracked && lotId) {
        await adjustLotQuantityApi(lotId, { type, quantity: qty, reason: reasonString, locationId })
      } else {
        const res = await adjustStockApi(item.id, { type, quantity: qty, reason: reasonString, locationId })
        const serverOnHand = res.data?.item?.onHand
        if (typeof serverOnHand === "number") onHand = serverOnHand
      }

      toast.success("Stock adjusted successfully", {
        description: `${direction === "in" ? "+" : "−"}${formatQuantity(qty, unit)} at ${locationCode}${
          lotLabel ? ` · lot ${lotLabel}` : ""
        } · ${item.name} now ${formatQuantity(onHand, unit)} on hand`,
      })
      notifyStockChanged({ itemId: item.id, locationIds: [locationId] })
      onSuccess?.({
        itemId: item.id,
        locationId,
        lotId: creatingLot ? null : lotId,
        direction,
        quantity: qty,
        onHand,
      })
      controls.close()
    } catch (err) {
      const problem = describeStockError(err, "Couldn't adjust stock")
      setError(problem.message)
      if (problem.stale) data.reload()
    } finally {
      setSubmitting(false)
      controls.setBusy(false)
    }
  }

  // ---- Render --------------------------------------------------------------
  const top = (
    <div className="space-y-3">
      <ItemSummary id={item.id} name={item.name} itemNumber={item.itemNumber} onHand={item.onHand} unit={unit} />
      <DirectionToggle value={direction} onChange={changeDirection} />
    </div>
  )

  const frame = {
    title: TITLE,
    icon: SlidersHorizontal,
    steps,
    currentStep: step,
    top,
    error,
    busy: submitting,
    onBack: goBack,
    backLabel: stepIndex <= 0 ? "Cancel" : "Back",
  }

  if (step === "location") {
    return (
      <>
        <WizardFrame
          {...frame}
          testId="stock-adjustment-dialog-location"
          description={direction === "in" ? "Where is the stock going?" : "Where is the stock coming from?"}
          onSubmit={() => nextStep && goTo(nextStep)}
          submitLabel="Next"
          submitDisabled={!locationValid}
          submitTestId="stock-adjustment-next-button"
        >
          <LocationPicker
            label="Location"
            options={candidateLocations}
            value={locationValid ? locationId : null}
            onChange={chooseLocation}
            onConfirm={(id) => {
              chooseLocation(id)
              if (nextStep) goTo(nextStep)
            }}
            unit={unit}
            testIdPrefix="adjust-location-option"
            splitOthers={direction === "in"}
            otherButtonLabel="Add to another location"
            otherButtonTestId="stock-adjustment-other-location-button"
            searchTestId="stock-adjustment-location-search-input"
            othersFooter={
              direction === "in" ? (
                <Button type="button" variant="ghost" className="h-11 w-full text-primary" onClick={openAddLocation}>
                  <Plus /> New location
                </Button>
              ) : null
            }
            emptyState={
              direction === "out" ? (
                <WizardEmpty icon={PackageMinus} title="Nothing to remove">
                  <p>{item.name} has no stock in any location.</p>
                  <Button type="button" variant="outline" className="mt-4" onClick={() => changeDirection("in")}>
                    Switch to stock in
                  </Button>
                </WizardEmpty>
              ) : (
                <WizardEmpty icon={MapPin} title="No locations yet">
                  <p>Create a location to put stock in.</p>
                  <Button type="button" className="mt-4" onClick={openAddLocation}>
                    <Plus /> New location
                  </Button>
                </WizardEmpty>
              )
            }
          />
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
            chooseLocation(created.id)
            setAddLocationOpen(false)
          }}
        />
      </>
    )
  }

  if (step === "lot") {
    return (
      <WizardFrame
        {...frame}
        testId="stock-adjustment-dialog-lot"
        description={
          <>
            Which lot {direction === "in" ? "are you adding to" : "are you taking from"} at{" "}
            <span className="font-mono font-medium text-foreground">{locationCode}</span>?
          </>
        }
        onSubmit={() => nextStep && goTo(nextStep)}
        submitLabel="Next"
        submitDisabled={!!lotProblem}
        submitTestId="stock-adjustment-next-button"
      >
        <LotPicker
          lots={data.lots}
          locationId={locationId}
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
          testIdPrefix="adjust-lot-option"
          onlyWithStock={direction === "out"}
          allowCreate={canCreateLot}
          newLot={newLot}
          onNewLotChange={setNewLot}
          newLotTestId="adjust-lot-new-option"
          now={now}
          emptyMessage={`No lots have stock at ${locationCode}.`}
        />
        {lotId && lotProblem && lotProblem !== "Enter a lot number" && (
          <p className="text-sm text-destructive" role="status">
            {lotProblem}
          </p>
        )}
      </WizardFrame>
    )
  }

  // Quantity step
  const reviewRows: ReviewRow[] = [
    { label: "Location", value: <span className="font-mono font-medium">{locationCode}</span> },
    ...(lotTracked && lotLabel
      ? [
          {
            label: "Lot",
            value: (
              <span>
                <span className="font-mono font-medium">{lotLabel}</span>
                {creatingLot && (
                  <span className="text-muted-foreground">
                    {" "}
                    (new{newLot.expirationDate ? `, expires ${formatDate(newLot.expirationDate)}` : ""})
                  </span>
                )}
              </span>
            ),
          },
        ]
      : []),
    { label: lotTracked ? "Lot here" : "Here", value: <QuantityChange before={before} after={after} unit={unit} /> },
    { label: "Item total", value: <QuantityChange before={item.onHand} after={item.onHand + signed} unit={unit} /> },
    { label: "Reason", value: reasonText(reason, defaultReason) },
  ]

  return (
    <WizardFrame
      {...frame}
      testId="stock-adjustment-dialog-quantity"
      description={
        <>
          {direction === "in" ? "Adding to" : "Removing from"}{" "}
          <span className="font-mono font-medium text-foreground">{locationCode}</span>
          {lotLabel && (
            <>
              {" "}
              · lot <span className="font-mono font-medium text-foreground">{lotLabel}</span>
            </>
          )}
        </>
      }
      onSubmit={submit}
      submitLabel={
        qty > 0 ? `${direction === "in" ? "Add" : "Remove"} ${formatQuantity(qty, unit)}` : direction === "in" ? "Add stock" : "Remove stock"
      }
      submitDisabled={!canSubmit}
      submitTestId="stock-adjustment-submit-button"
    >
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-2">
          <Label htmlFor="adjust-quantity" className="text-sm">
            {direction === "in" ? "Quantity to add" : "Quantity to remove"}
          </Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {direction === "out" ? "Available" : "Currently"}: {formatQuantity(before, unit)}
          </span>
        </div>
        <QuantityStepper
          id="adjust-quantity"
          value={quantity}
          onChange={(v) => {
            setQuantity(v)
            setFromCount(false)
            setError(null)
          }}
          onSign={(sign) => changeDirection(sign === "+" ? "in" : "out")}
          min={0}
          max={direction === "out" ? Math.max(before, 0) : undefined}
          unit={unit}
          invalid={!!quantityProblem && qty > 0}
          inputTestId="stock-adjustment-amount-input"
          aria-describedby="adjust-quantity-help"
        />
        <div id="adjust-quantity-help" className="min-h-5 text-sm">
          {quantityProblem ? (
            <p className="text-destructive">{quantityProblem}</p>
          ) : direction === "out" && before > 0 ? (
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => {
                setQuantity(before)
                setFromCount(false)
              }}
            >
              Remove all {formatQuantity(before, unit)}
            </button>
          ) : null}
        </div>
      </div>

      {!creatingLot && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5">
          <Label htmlFor="adjust-new-total" className="flex-1 text-sm font-normal text-muted-foreground">
            Or enter the counted total at{" "}
            <span className="whitespace-nowrap font-mono text-foreground">{locationCode}</span>
          </Label>
          <Input
            id="adjust-new-total"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={quantity === null ? "" : String(Math.max(after, 0))}
            placeholder={String(before)}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, "").slice(0, 9)
              setCountedTotal(digits === "" ? null : Number.parseInt(digits, 10))
              setError(null)
            }}
            className="h-11 w-24 text-right font-semibold tabular-nums"
            aria-label="New total quantity"
            data-testid="stock-adjustment-new-quantity-input"
          />
        </div>
      )}

      <ReasonField
        value={reason}
        onChange={setReason}
        direction={direction}
        noteTestId="stock-adjustment-note-input"
      />

      {qty > 0 && !quantityProblem && <ReviewPanel rows={reviewRows} />}
      {lotProblem && step === "quantity" && (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <Boxes className="size-4" /> {lotProblem}
        </p>
      )}
    </WizardFrame>
  )
}
