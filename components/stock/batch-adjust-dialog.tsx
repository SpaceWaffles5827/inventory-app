"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Layers, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { adjustStockApi } from "@/lib/api/items.api"
import { getLocationsApi } from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatNumber, formatQuantity } from "@/lib/format"
import { useWorkspace } from "@/lib/workspace-context"
import { DirectionToggle } from "./direction-toggle"
import { LocationPicker } from "./location-picker"
import { ReasonField } from "./reason-field"
import { ItemThumb } from "./stock-summary"
import {
  EMPTY_REASON,
  itemQuantityAt,
  notifyStockChanged,
  reasonForDirection,
  reasonText,
  type ReasonValue,
  type StockDirection,
  type StockItem,
  type StockLocation,
} from "./stock-utils"
import { StockDialog, WizardEmpty, WizardFrame, WizardLoadError, WizardLoading, type WizardStep } from "./stock-wizard"

const TITLE = "Batch adjust"

export interface BatchEntry {
  item: StockItem
  quantity: number
}

export interface BatchAdjustResult {
  /** Item ids that were adjusted */
  succeeded: string[]
  /** Item id → error message */
  failed: Record<string, string>
}

interface BatchAdjustDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entries: BatchEntry[]
  defaultDirection?: StockDirection
  /** Pre-select a location (e.g. a location label scanned during the batch) */
  defaultLocationId?: string | null
  onComplete: (result: BatchAdjustResult) => void
}

/** Receive or pick a whole list of scanned items at one location */
export function BatchAdjustDialog({ open, onOpenChange, ...rest }: BatchAdjustDialogProps) {
  return (
    <StockDialog open={open} onOpenChange={onOpenChange}>
      {(controls) => <BatchAdjustFlow controls={controls} {...rest} />}
    </StockDialog>
  )
}

type Step = "location" | "review"

interface LocationsState {
  list: StockLocation[] | null
  error: string | null
  version: number
}

function BatchAdjustFlow({
  entries,
  defaultDirection = "in",
  defaultLocationId = null,
  onComplete,
  controls,
}: Omit<BatchAdjustDialogProps, "open" | "onOpenChange"> & {
  controls: { setBusy: (busy: boolean) => void; close: () => void }
}) {
  const { workspaceId } = useWorkspace()
  const [version, setVersion] = useState(0)
  const [locations, setLocations] = useState<LocationsState>({ list: null, error: null, version: -1 })
  const [direction, setDirection] = useState<StockDirection>(defaultDirection)
  const [locationChoice, setLocationChoice] = useState<string | null>(null)
  const [reason, setReason] = useState<ReasonValue>(EMPTY_REASON)
  const [stepChoice, setStepChoice] = useState<Step | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [failures, setFailures] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    getLocationsApi(workspaceId)
      .then((res) => {
        if (!cancelled) setLocations({ list: res.data?.locations ?? [], error: null, version })
      })
      .catch((err) => {
        if (!cancelled) setLocations({ list: null, error: getErrorMessage(err, "Couldn't load locations"), version })
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId, version])

  if (locations.version === -1) return <WizardLoading title={TITLE} icon={Layers} onCancel={controls.close} />
  if (!locations.list) {
    return (
      <WizardLoadError
        title={TITLE}
        icon={Layers}
        message={locations.error ?? "Couldn't load locations"}
        onRetry={() => setVersion((v) => v + 1)}
        onCancel={controls.close}
      />
    )
  }

  const options = locations.list
    .map((loc) => ({
      id: loc.id,
      code: loc.code,
      description: loc.description,
      onHand: entries.reduce((sum, e) => sum + itemQuantityAt(e.item, loc.id), 0),
      assigned: entries.some((e) => e.item.locations.some((l) => l.locationId === loc.id)),
    }))
    .filter((o) => direction === "in" || o.onHand > 0)
  const defaultValid = !!defaultLocationId && options.some((o) => o.id === defaultLocationId)
  const locationId = locationChoice ?? (defaultValid ? defaultLocationId : null)
  const location = options.find((o) => o.id === locationId) ?? null
  const wanted: Step = stepChoice ?? (defaultValid ? "review" : "location")
  // Switching direction can rule the chosen location out (nothing to pick there) — go back and choose again.
  const step: Step = wanted === "review" && !location ? "location" : wanted
  const steps: WizardStep[] = [
    { id: "location", label: "Location" },
    { id: "review", label: "Review" },
  ]

  const rows = entries.map((entry) => {
    const available = itemQuantityAt(entry.item, locationId)
    let problem: string | null = null
    if (entry.item.lotTracking) problem = "Lot-tracked — adjust it on its own so you can pick the lot"
    else if (direction === "out" && entry.quantity > available)
      problem = available > 0 ? `Only ${formatQuantity(available, entry.item.unit)} here` : "None here"
    return { ...entry, available, problem, error: failures[entry.item.id] ?? null }
  })
  const ready = rows.filter((r) => !r.problem)
  const totalUnits = ready.reduce((sum, r) => sum + r.quantity, 0)
  const code = location?.code ?? "—"

  const changeDirection = (next: StockDirection) => {
    setDirection(next)
    setReason((r) => reasonForDirection(r, next))
  }

  const submit = async () => {
    if (!locationId || ready.length === 0) return
    setSubmitting(true)
    controls.setBusy(true)
    const type = direction === "in" ? "INPUT" : "OUTPUT"
    const reasonString = reasonText(reason, direction === "in" ? "Batch receive" : "Batch pick")
    const succeeded: string[] = []
    const failed: Record<string, string> = {}
    for (const row of ready) {
      try {
        await adjustStockApi(row.item.id, { type, quantity: row.quantity, reason: reasonString, locationId })
        succeeded.push(row.item.id)
        notifyStockChanged({ itemId: row.item.id, locationIds: [locationId] })
      } catch (err) {
        failed[row.item.id] = getErrorMessage(err, "Failed")
      }
    }
    setSubmitting(false)
    controls.setBusy(false)
    setFailures(failed)
    onComplete({ succeeded, failed })

    const failedCount = Object.keys(failed).length
    if (succeeded.length > 0) {
      toast.success(
        `${direction === "in" ? "Received" : "Picked"} ${succeeded.length} item${succeeded.length === 1 ? "" : "s"} at ${code}`,
        failedCount > 0 ? { description: `${failedCount} couldn't be adjusted — see the list.` } : undefined
      )
    }
    if (failedCount === 0) controls.close()
  }

  const frame = {
    title: TITLE,
    icon: Layers,
    steps,
    currentStep: step,
    top: <DirectionToggle value={direction} onChange={changeDirection} />,
    busy: submitting,
  }

  if (step === "location") {
    return (
      <WizardFrame
        {...frame}
        testId="batch-adjust-dialog-location"
        description={direction === "in" ? "Where are these items going?" : "Where are these items coming from?"}
        onBack={controls.close}
        backLabel="Cancel"
        onSubmit={() => setStepChoice("review")}
        submitLabel="Next"
        submitDisabled={!location}
        submitTestId="batch-adjust-next-button"
      >
        <LocationPicker
          label="Location"
          options={options}
          value={location ? locationId : null}
          onChange={setLocationChoice}
          onConfirm={(id) => {
            setLocationChoice(id)
            setStepChoice("review")
          }}
          testIdPrefix="batch-location-option"
          splitOthers={direction === "in"}
          searchTestId="batch-location-search-input"
          emptyState={
            <WizardEmpty icon={MapPin} title={direction === "out" ? "None of these items are in stock" : "No locations yet"} />
          }
        />
      </WizardFrame>
    )
  }

  return (
    <WizardFrame
      {...frame}
      testId="batch-adjust-dialog-review"
      description={
        <>
          {direction === "in" ? "Receiving into" : "Picking from"}{" "}
          <span className="font-mono font-medium text-foreground">{code}</span>
        </>
      }
      onBack={() => setStepChoice("location")}
      onSubmit={submit}
      submitLabel={`${direction === "in" ? "Receive" : "Pick"} ${formatNumber(totalUnits)} unit${totalUnits === 1 ? "" : "s"}`}
      submitDisabled={ready.length === 0}
      submitTestId="batch-adjust-submit-button"
    >
      <ul className="divide-y rounded-xl border bg-card">
        {rows.map((row) => (
          <li key={row.item.id} className="flex items-center gap-3 px-3 py-2.5">
            <ItemThumb itemId={row.item.id} alt={row.item.name} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.item.name}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{row.item.itemNumber}</p>
              {(row.error || row.problem) && (
                <p className={row.error ? "text-xs text-destructive" : "text-xs text-warning-foreground dark:text-warning"}>
                  {row.error ?? row.problem}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold tabular-nums">
                {direction === "in" ? "+" : "−"}
                {formatQuantity(row.quantity, row.item.unit)}
              </p>
              {direction === "out" && !row.item.lotTracking && (
                <p className="text-xs text-muted-foreground tabular-nums">of {formatNumber(row.available)}</p>
              )}
            </div>
            {row.problem && (
              <Badge variant="muted" className="shrink-0">
                Skipped
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <ReasonField value={reason} onChange={setReason} direction={direction} noteTestId="batch-adjust-note-input" />
    </WizardFrame>
  )
}
