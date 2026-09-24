"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateLotApi, type LotWithDetails, type UpdateLotRequest } from "@/lib/api/lots.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { LOT_STATUS, type LotStatus } from "@/lib/stock"
import { EntityCombobox } from "./entity-combobox"
import { Field, invalidProps } from "./form-field"
import { toDateInputValue } from "./item-utils"
import { EXISTING_STOCK_LOT_NUMBER, SYSTEM_LOT_NUMBER } from "./items-data"

interface EditLotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lot: LotWithDetails
  onSaved: () => void
}

/** Edit a lot's number, status, dates, supplier, PO and notes */
export function EditLotDialog({ open, onOpenChange, lot, onSaved }: EditLotDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit lot</DialogTitle>
          <DialogDescription>Quantities change through adjustments, not here.</DialogDescription>
        </DialogHeader>
        <EditLotForm lot={lot} onClose={() => onOpenChange(false)} onSaved={onSaved} />
      </DialogContent>
    </Dialog>
  )
}

interface FormState {
  lotNumber: string
  status: LotStatus
  receivedDate: string
  manufactureDate: string
  expirationDate: string
  supplierId: string
  poNumber: string
  notes: string
}

function EditLotForm({ lot, onClose, onSaved }: { lot: LotWithDetails; onClose: () => void; onSaved: () => void }) {
  const { workspaceId } = useWorkspace()
  const systemManaged = lot.isSystem || lot.lotNumber === SYSTEM_LOT_NUMBER || lot.lotNumber === EXISTING_STOCK_LOT_NUMBER
  const [form, setForm] = useState<FormState>(() => ({
    lotNumber: lot.lotNumber,
    status: lot.status as LotStatus,
    receivedDate: toDateInputValue(lot.receivedDate),
    manufactureDate: toDateInputValue(lot.manufactureDate),
    expirationDate: toDateInputValue(lot.expirationDate),
    supplierId: lot.supplierId ?? "",
    poNumber: lot.poNumber ?? "",
    notes: lot.notes ?? "",
  }))
  const [submitted, setSubmitted] = useState(false)
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

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((f) => ({ ...f, [field]: value }))

  const errors = {
    lotNumber: submitted && !form.lotNumber.trim() ? "Enter a lot number" : undefined,
    expirationDate:
      submitted && form.manufactureDate && form.expirationDate && form.expirationDate < form.manufactureDate
        ? "Expiry can't be before the manufacture date"
        : undefined,
  }

  const supplierOptions = suppliers.length
    ? suppliers.map((s) => ({ value: s.id, label: s.name }))
    : lot.supplier
      ? [{ value: lot.supplier.id, label: lot.supplier.name }]
      : []

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!form.lotNumber.trim() || (form.manufactureDate && form.expirationDate && form.expirationDate < form.manufactureDate)) {
      return
    }
    setSaving(true)
    try {
      // "" clears a date / supplier / text field on the server
      const payload: UpdateLotRequest = {
        ...(systemManaged ? {} : { lotNumber: form.lotNumber.trim() }),
        status: form.status,
        receivedDate: form.receivedDate,
        manufactureDate: form.manufactureDate,
        expirationDate: form.expirationDate,
        supplierId: form.supplierId,
        poNumber: form.poNumber.trim(),
        notes: form.notes.trim(),
      }
      await updateLotApi(lot.id, payload)
      toast.success("Lot updated")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the lot"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Lot number"
          htmlFor="edit-lot-number"
          required={!systemManaged}
          hint={systemManaged ? "Managed by the system" : undefined}
          error={errors.lotNumber}
        >
          <Input
            {...invalidProps("edit-lot-number", errors.lotNumber)}
            className="font-mono"
            value={form.lotNumber}
            onChange={(e) => set("lotNumber", e.target.value)}
            disabled={systemManaged}
            autoComplete="off"
          />
        </Field>
        <Field label="Status" htmlFor="edit-lot-status" hint={LOT_STATUS[form.status]?.description}>
          <Select value={form.status} onValueChange={(v) => set("status", v as LotStatus)}>
            <SelectTrigger id="edit-lot-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LOT_STATUS) as LotStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {LOT_STATUS[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Received" htmlFor="edit-lot-received">
          <Input id="edit-lot-received" type="date" value={form.receivedDate} onChange={(e) => set("receivedDate", e.target.value)} />
        </Field>
        <Field label="Manufactured" htmlFor="edit-lot-manufactured">
          <Input
            id="edit-lot-manufactured"
            type="date"
            value={form.manufactureDate}
            onChange={(e) => set("manufactureDate", e.target.value)}
          />
        </Field>
        <Field label="Expires" htmlFor="edit-lot-expires" error={errors.expirationDate}>
          <Input
            {...invalidProps("edit-lot-expires", errors.expirationDate)}
            type="date"
            value={form.expirationDate}
            onChange={(e) => set("expirationDate", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier" htmlFor="edit-lot-supplier">
          <EntityCombobox
            id="edit-lot-supplier"
            value={form.supplierId}
            onChange={(v) => set("supplierId", v)}
            options={supplierOptions}
            placeholder="No supplier"
            searchPlaceholder="Search suppliers…"
            emptyText="No supplier found."
            clearable
          />
        </Field>
        <Field label="PO number" htmlFor="edit-lot-po">
          <Input
            id="edit-lot-po"
            className="font-mono"
            value={form.poNumber}
            onChange={(e) => set("poNumber", e.target.value)}
            autoComplete="off"
          />
        </Field>
      </div>

      <Field label="Notes" htmlFor="edit-lot-notes">
        <Textarea id="edit-lot-notes" rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </form>
  )
}
