"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { adjustLotQuantityApi } from "@/lib/api/lots.api"
import type { LocationWithCount } from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatQuantity } from "@/lib/format"

interface AddLocationToLotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lotId: string
  /** Locations that don't hold this lot yet */
  availableLocations: LocationWithCount[]
  onSuccess: () => void
  unit?: string | null
}

/** Receive more of a lot into a location that doesn't hold it yet */
export function AddLocationToLotDialog({ open, onOpenChange, ...props }: AddLocationToLotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <AddLocationForm {...props} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function AddLocationForm({
  lotId,
  availableLocations,
  onSuccess,
  unit,
  onClose,
}: Omit<AddLocationToLotDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [locationId, setLocationId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const errors = {
    location: submitted && !locationId ? "Choose a location" : undefined,
    quantity:
      submitted && !(/^\d+$/.test(quantity.trim()) && Number(quantity) > 0) ? "Enter a whole number of at least 1" : undefined,
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const qty = Number(quantity)
    if (!locationId || !/^\d+$/.test(quantity.trim()) || qty < 1) return

    setSaving(true)
    try {
      await adjustLotQuantityApi(lotId, {
        type: "INPUT",
        quantity: qty,
        reason: reason.trim() || "Received into new location",
        locationId,
      })
      const code = availableLocations.find((l) => l.id === locationId)?.code
      toast.success("Stock added", { description: `${formatQuantity(qty, unit)} to ${code ?? "location"}` })
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't add stock to that location"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>Add to a location</DialogTitle>
        <DialogDescription>Record stock of this lot at another storage location.</DialogDescription>
      </DialogHeader>

      <Field label="Location" htmlFor="lot-add-location" required error={errors.location}>
        <EntityCombobox
          id="lot-add-location"
          value={locationId}
          onChange={setLocationId}
          options={availableLocations.map((l) => ({ value: l.id, label: l.code }))}
          placeholder="Choose a location"
          searchPlaceholder="Search locations…"
          emptyText="No location found."
          mono
          invalid={!!errors.location}
        />
      </Field>

      <Field label={`Quantity${unit ? ` (${unit})` : ""}`} htmlFor="lot-add-quantity" required error={errors.quantity}>
        <Input
          {...invalidProps("lot-add-quantity", errors.quantity)}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder="0"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </Field>

      <Field label="Reason" htmlFor="lot-add-reason" hint="Optional — shown in the history">
        <Input
          {...invalidProps("lot-add-reason")}
          placeholder="e.g. Received from supplier"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Plus />}
          {saving ? "Adding…" : "Add stock"}
        </Button>
      </DialogFooter>
    </form>
  )
}
