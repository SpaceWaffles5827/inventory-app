"use client"

import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, ArrowRight, Check, Loader2, MapPin, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EntityCombobox } from "@/components/items/entity-combobox"
import { Field, invalidProps } from "@/components/items/form-field"
import { testIdSlug, todayInputValue } from "@/components/items/item-utils"
import { createLotApi } from "@/lib/api/lots.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatNumber, formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

interface LotLocationOption {
  locationId: string
  quantity?: number | null
  location?: { code: string } | null
}

interface CreateLotDialogProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  /** The item's assigned locations — a new lot can only be received into these */
  itemLocations: LotLocationOption[]
  unit?: string | null
  /** Called after the lot is created (refresh the item and its lots) */
  onSuccess: () => void | Promise<void>
}

/** Two-step "receive a lot": lot details, then how the quantity is split across locations */
export function CreateLotDialog({ isOpen, onClose, ...props }: CreateLotDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        {/* Mounted only while open, so every open starts at step 1 with an empty form */}
        <CreateLotForm {...props} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

interface LotDetails {
  lotNumber: string
  quantity: string
  receivedDate: string
  manufactureDate: string
  expirationDate: string
  supplierId: string
  poNumber: string
  notes: string
}

type DetailErrors = Partial<Record<keyof LotDetails | "locations", string>>

function validateDetails(d: LotDetails, hasLocations: boolean): DetailErrors {
  const errors: DetailErrors = {}
  if (!d.lotNumber.trim()) errors.lotNumber = "Enter a lot or batch number"
  if (d.quantity.trim() === "") errors.quantity = "Enter the quantity received"
  else if (!/^\d+$/.test(d.quantity.trim()) || Number(d.quantity) < 1) errors.quantity = "Use a whole number of at least 1"
  if (d.manufactureDate && d.expirationDate && d.expirationDate < d.manufactureDate) {
    errors.expirationDate = "Expiry can't be before the manufacture date"
  }
  if (!hasLocations) errors.locations = "Assign a storage location to this item first (Locations tab → Manage)."
  return errors
}

function CreateLotForm({ onClose, itemId, itemLocations, unit, onSuccess }: Omit<CreateLotDialogProps, "isOpen">) {
  const { workspaceId } = useWorkspace()
  const [step, setStep] = useState<1 | 2>(1)
  const [details, setDetails] = useState<LotDetails>({
    lotNumber: "",
    quantity: "",
    receivedDate: todayInputValue(),
    manufactureDate: "",
    expirationDate: "",
    supplierId: "",
    poNumber: "",
    notes: "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [split, setSplit] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])

  useEffect(() => {
    let cancelled = false
    getSuppliersApi(workspaceId)
      .then((res) => {
        if (!cancelled) setSuppliers(res.data?.suppliers ?? [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const errors = submitted ? validateDetails(details, itemLocations.length > 0) : {}
  const set = (field: keyof LotDetails, value: string) => setDetails((d) => ({ ...d, [field]: value }))

  const total = Number(details.quantity) || 0
  const assigned = itemLocations.reduce((sum, l) => sum + (Number(split[l.locationId]) || 0), 0)
  const remaining = total - assigned
  const splitValid = remaining === 0 && Object.values(split).every((v) => v === "" || /^\d+$/.test(v))

  const goToSplit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const found = validateDetails(details, itemLocations.length > 0)
    if (Object.keys(found).length > 0) {
      const first = (["lotNumber", "quantity", "expirationDate"] as const).find((k) => found[k])
      if (first) document.getElementById(`lot-${first}`)?.focus()
      return
    }
    // A single location gets everything; otherwise keep what the user already entered
    if (itemLocations.length === 1) setSplit({ [itemLocations[0].locationId]: String(total) })
    setStep(2)
  }

  const distributeEvenly = () => {
    const n = itemLocations.length
    const base = Math.floor(total / n)
    const extra = total % n
    setSplit(Object.fromEntries(itemLocations.map((l, i) => [l.locationId, String(base + (i < extra ? 1 : 0))])))
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!splitValid) return
    setSaving(true)
    try {
      await createLotApi(itemId, {
        lotNumber: details.lotNumber.trim(),
        quantity: total,
        receivedDate: details.receivedDate || undefined,
        manufactureDate: details.manufactureDate || undefined,
        expirationDate: details.expirationDate || undefined,
        supplierId: details.supplierId || undefined,
        poNumber: details.poNumber.trim() || undefined,
        notes: details.notes.trim() || undefined,
        locationAssignments: itemLocations
          .map((l) => ({ locationId: l.locationId, quantity: Number(split[l.locationId]) || 0 }))
          .filter((a) => a.quantity > 0),
      })
      toast.success("Lot created successfully!", { description: `${details.lotNumber.trim()} · ${formatQuantity(total, unit)}` })
      await onSuccess()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create the lot"))
    } finally {
      setSaving(false)
    }
  }

  if (step === 1) {
    return (
      <form onSubmit={goToSplit} noValidate className="space-y-5" data-testid="create-lot-dialog-step1">
        <DialogHeader>
          <DialogTitle>Receive a lot</DialogTitle>
          <DialogDescription>Step 1 of 2 · Lot details. Next you&apos;ll choose where the stock goes.</DialogDescription>
        </DialogHeader>

        {errors.locations && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
            {errors.locations}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Lot number" htmlFor="lot-lotNumber" required error={errors.lotNumber}>
            <Input
              {...invalidProps("lot-lotNumber", errors.lotNumber)}
              className="font-mono"
              placeholder="LOT-2026-001"
              autoComplete="off"
              value={details.lotNumber}
              onChange={(e) => set("lotNumber", e.target.value)}
              data-testid="lot-number-input"
            />
          </Field>
          <Field label={`Quantity${unit ? ` (${unit})` : ""}`} htmlFor="lot-quantity" required error={errors.quantity}>
            <Input
              {...invalidProps("lot-quantity", errors.quantity)}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="100"
              value={details.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              data-testid="lot-quantity-input"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Received" htmlFor="lot-receivedDate">
            <Input
              id="lot-receivedDate"
              type="date"
              value={details.receivedDate}
              onChange={(e) => set("receivedDate", e.target.value)}
              data-testid="lot-received-date-input"
            />
          </Field>
          <Field label="Manufactured" htmlFor="lot-manufactureDate">
            <Input
              id="lot-manufactureDate"
              type="date"
              value={details.manufactureDate}
              onChange={(e) => set("manufactureDate", e.target.value)}
              data-testid="lot-manufacture-date-input"
            />
          </Field>
          <Field label="Expires" htmlFor="lot-expirationDate" error={errors.expirationDate}>
            <Input
              {...invalidProps("lot-expirationDate", errors.expirationDate)}
              type="date"
              value={details.expirationDate}
              onChange={(e) => set("expirationDate", e.target.value)}
              data-testid="lot-expiration-date-input"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Supplier" htmlFor="lot-supplier">
            <EntityCombobox
              id="lot-supplier"
              value={details.supplierId}
              onChange={(v) => set("supplierId", v)}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
              placeholder="Choose a supplier"
              searchPlaceholder="Search suppliers…"
              emptyText="No supplier found."
              clearable
            />
          </Field>
          <Field label="PO number" htmlFor="lot-poNumber">
            <Input
              id="lot-poNumber"
              className="font-mono"
              placeholder="PO-12345"
              autoComplete="off"
              value={details.poNumber}
              onChange={(e) => set("poNumber", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="lot-notes">
          <Textarea
            id="lot-notes"
            rows={2}
            placeholder="Inspection results, storage instructions…"
            value={details.notes}
            onChange={(e) => set("notes", e.target.value)}
            data-testid="lot-notes-input"
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} data-testid="lot-cancel-button">
            Cancel
          </Button>
          <Button type="submit" data-testid="lot-step1-next-button">
            Next: choose locations <ArrowRight />
          </Button>
        </DialogFooter>
      </form>
    )
  }

  return (
    <form onSubmit={create} className="space-y-5" data-testid="create-lot-dialog-step2">
      <DialogHeader>
        <DialogTitle>Where is it stored?</DialogTitle>
        <DialogDescription>
          Step 2 of 2 · Split <span className="font-medium text-foreground">{formatQuantity(total, unit)}</span> of lot{" "}
          <span className="font-mono font-medium text-foreground">{details.lotNumber.trim()}</span> across locations.
        </DialogDescription>
      </DialogHeader>

      <ul className="divide-y rounded-lg border">
        {itemLocations.map((l) => {
          const code = l.location?.code ?? "Unknown location"
          const inputId = `lot-split-${l.locationId}`
          return (
            <li key={l.locationId} className="flex items-center gap-3 px-3 py-2.5">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <label htmlFor={inputId} className="min-w-0 flex-1">
                <span className="block truncate font-mono text-sm">{code}</span>
                <span className="text-xs text-muted-foreground">{formatQuantity(l.quantity ?? 0, unit)} there now</span>
              </label>
              <Input
                id={inputId}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                className="w-24 text-right tabular-nums"
                value={split[l.locationId] ?? ""}
                onChange={(e) => setSplit((s) => ({ ...s, [l.locationId]: e.target.value }))}
                data-testid={`lot-location-quantity-${testIdSlug(code)}`}
              />
            </li>
          )
        })}
      </ul>

      {itemLocations.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={distributeEvenly}>
            Split evenly
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSplit({ [itemLocations[0].locationId]: String(total) })}
          >
            All in {itemLocations[0].location?.code ?? "first location"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSplit({})}>
            Clear
          </Button>
        </div>
      )}

      <div
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
          remaining === 0
            ? "border-success/30 bg-success/10 text-success"
            : "border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning"
        )}
        aria-live="polite"
      >
        <span className="flex items-center gap-2 font-medium">
          {remaining === 0 && <Check className="size-4" />}
          {remaining === 0
            ? "All stock placed"
            : remaining > 0
              ? `${formatNumber(remaining)} left to place`
              : `${formatNumber(-remaining)} too many`}
        </span>
        <span className="tabular-nums">
          {formatNumber(assigned)} / {formatNumber(total)}
        </span>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={saving} data-testid="lot-step2-back-button">
          <ArrowLeft /> Back
        </Button>
        <Button type="submit" disabled={saving || !splitValid} data-testid="lot-create-button">
          {saving ? <Loader2 className="animate-spin" /> : <PackagePlus />}
          {saving ? "Creating…" : "Create lot"}
        </Button>
      </DialogFooter>
    </form>
  )
}
