"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ActiveField,
  ContactFields,
  contactValuesFrom,
  serverFieldError,
  trimContact,
  validateContact,
  type ContactErrors,
  type ContactValues,
} from "@/components/partners/contact-fields"
import { createSupplierApi, updateSupplierApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getErrorMessage } from "@/lib/api/client"

export interface SupplierFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  /** When set the dialog edits this supplier, otherwise it creates a new one */
  supplier?: SupplierWithCount | null
  onSuccess: (supplier: SupplierWithCount) => void
}

export function SupplierFormDialog({ open, onOpenChange, workspaceId, supplier, onSuccess }: SupplierFormDialogProps) {
  const [saving, setSaving] = useState(false)
  const mode = supplier ? "edit" : "create"

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid={`${mode === "edit" ? "edit" : "add"}-supplier-dialog`}>
        {/* Radix unmounts the content while closed, so the form re-initialises on every open */}
        <SupplierForm
          key={supplier?.id ?? "new"}
          workspaceId={workspaceId}
          supplier={supplier ?? null}
          saving={saving}
          setSaving={setSaving}
          onCancel={() => onOpenChange(false)}
          onSaved={(saved) => {
            onSuccess(saved)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function SupplierForm({
  workspaceId,
  supplier,
  saving,
  setSaving,
  onCancel,
  onSaved,
}: {
  workspaceId: string
  supplier: SupplierWithCount | null
  saving: boolean
  setSaving: (saving: boolean) => void
  onCancel: () => void
  onSaved: (supplier: SupplierWithCount) => void
}) {
  const isEdit = supplier !== null
  const [values, setValues] = useState<ContactValues>(() => contactValuesFrom(supplier))
  const [isActive, setIsActive] = useState(supplier?.isActive ?? true)
  const [errors, setErrors] = useState<ContactErrors>({})

  const change = (field: keyof ContactValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    // this dialog can be opened from inside another form (Add item) — keep the submit to ourselves
    e.stopPropagation()
    if (saving) return

    const nextErrors = validateContact(values, "Supplier")
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const data = trimContact(values)
    setSaving(true)
    try {
      if (isEdit) {
        const res = await updateSupplierApi(supplier.id, { ...data, isActive, workspaceId })
        const updated = res.data?.supplier
        if (!updated) throw new Error("The server didn't return the updated supplier")
        onSaved({ ...updated, _count: updated._count ?? supplier._count })
        toast.success("Supplier updated")
      } else {
        const res = await createSupplierApi({
          name: data.name,
          contactPerson: data.contactPerson || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          address: data.address || undefined,
          isActive,
          workspaceId,
        })
        const created = res.data?.supplier
        if (!created) throw new Error("The server didn't return the new supplier")
        onSaved({ ...created, _count: created._count ?? { items: 0 } })
        toast.success(`Supplier “${data.name}” added`)
      }
    } catch (err) {
      const message = getErrorMessage(err, isEdit ? "Couldn't update supplier" : "Couldn't add supplier")
      const fieldError = serverFieldError(message)
      if (fieldError) setErrors(fieldError)
      else toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit supplier" : "Add supplier"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update this supplier's name and contact details."
            : "Suppliers can be linked to items and lots so you know who to reorder from."}
        </DialogDescription>
      </DialogHeader>

      <ContactFields
        idPrefix={isEdit ? "edit-supplier" : "add-supplier"}
        noun="Supplier"
        values={values}
        errors={errors}
        onChange={change}
        disabled={saving}
        namePlaceholder="e.g. Northwind Traders"
      />

      <ActiveField
        id={isEdit ? "edit-supplier-active" : "add-supplier-active"}
        checked={isActive}
        onCheckedChange={setIsActive}
        description="Turn off for suppliers you no longer order from. Linked items keep the supplier."
        disabled={saving}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} data-testid="cancel-button-desktop">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="submit-button-desktop">
          {saving && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : "Add supplier"}
        </Button>
      </DialogFooter>
    </form>
  )
}
