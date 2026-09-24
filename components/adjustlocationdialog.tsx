"use client"

import { useState, type FormEvent } from "react"
import { ArrowRight, Loader2 } from "lucide-react"
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
import { Field, invalidProps } from "@/components/items/form-field"
import { adjustLotQuantityApi } from "@/lib/api/lots.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatNumber, formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"

interface AdjustingLocation {
  locationId: string
  locationCode: string
  currentQuantity: number
}

interface AdjustLocationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lotId: string
  adjustingLocation: AdjustingLocation | null
  onSuccess: () => void
  unit?: string | null
}

type Mode = "add" | "remove" | "set"

const MODES: { value: Mode; label: string }[] = [
  { value: "add", label: "Add" },
  { value: "remove", label: "Remove" },
  { value: "set", label: "Set count" },
]

/** Adjust how much of one lot sits in one location */
export function AdjustLocationDialog({ open, onOpenChange, adjustingLocation, ...props }: AdjustLocationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {adjustingLocation && (
          <AdjustForm {...props} location={adjustingLocation} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AdjustForm({
  lotId,
  location,
  onSuccess,
  unit,
  onClose,
}: Omit<AdjustLocationDialogProps, "open" | "onOpenChange" | "adjustingLocation"> & {
  location: AdjustingLocation
  onClose: () => void
}) {
  const [mode, setMode] = useState<Mode>("add")
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const current = location.currentQuantity
  const valid = /^\d+$/.test(amount.trim())
  const n = valid ? Number(amount) : 0
  const next = mode === "add" ? current + n : mode === "remove" ? current - n : n
  const delta = next - current

  let error: string | undefined
  if (!valid) error = amount.trim() === "" ? "Enter a quantity" : "Use a whole number"
  else if (mode === "remove" && n > current) error = `Only ${formatQuantity(current, unit)} here`
  else if (delta === 0) error = mode === "set" ? "That's the current count" : "Enter a quantity above 0"

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (error) return
    setSaving(true)
    try {
      await adjustLotQuantityApi(lotId, {
        type: delta > 0 ? "INPUT" : "OUTPUT",
        quantity: Math.abs(delta),
        reason: reason.trim() || (mode === "set" ? "Stock count" : "Stock adjustment"),
        locationId: location.locationId,
      })
      toast.success("Stock adjusted successfully", {
        description: `${location.locationCode}: ${formatNumber(current)} → ${formatQuantity(next, unit)}`,
      })
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't adjust stock"))
    } finally {
      setSaving(false)
    }
  }

  const shownError = submitted ? error : undefined

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle>Adjust stock</DialogTitle>
        <DialogDescription>
          This lot at <span className="font-mono font-medium text-foreground">{location.locationCode}</span> ·{" "}
          {formatQuantity(current, unit)} now
        </DialogDescription>
      </DialogHeader>

      <div role="radiogroup" aria-label="Adjustment type" className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/50 p-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            onClick={() => setMode(m.value)}
            className={cn(
              "h-9 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              mode === m.value && "bg-background text-foreground shadow-xs"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Field
        label={mode === "set" ? "Counted quantity" : mode === "add" ? "Quantity to add" : "Quantity to remove"}
        htmlFor="lot-adjust-amount"
        required
        error={shownError}
      >
        <Input
          {...invalidProps("lot-adjust-amount", shownError)}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          placeholder="0"
          className="text-lg tabular-nums"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>

      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">Result</span>
        <span className="flex items-center gap-2 tabular-nums">
          {formatNumber(current)}
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className={cn("font-semibold", next < 0 && "text-destructive")}>{formatQuantity(Math.max(next, 0), unit)}</span>
          {valid && delta !== 0 && (
            <span className={cn("text-xs font-medium", delta > 0 ? "text-success" : "text-destructive")}>
              ({delta > 0 ? "+" : "−"}
              {formatNumber(Math.abs(delta))})
            </span>
          )}
        </span>
      </div>

      <Field label="Reason" htmlFor="lot-adjust-reason" hint="Optional — shown in the history">
        <Input
          {...invalidProps("lot-adjust-reason")}
          placeholder={mode === "set" ? "e.g. Cycle count" : "e.g. Damaged in storage"}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save adjustment"}
        </Button>
      </DialogFooter>
    </form>
  )
}
