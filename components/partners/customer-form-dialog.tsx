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
import { Input } from "@/components/ui/input"
import { FormField, TEXT_MAX } from "@/components/partners/form"
import { createCustomerApi, updateCustomerApi, type CustomerWithCount } from "@/lib/api/customers.api"
import { getErrorMessage } from "@/lib/api/client"

export interface CustomerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  /** When set the dialog edits this customer, otherwise it creates a new one */
  customer?: CustomerWithCount | null
  onSuccess: (customer: CustomerWithCount) => void
}

export function CustomerFormDialog({ open, onOpenChange, workspaceId, customer, onSuccess }: CustomerFormDialogProps) {
  const [saving, setSaving] = useState(false)
  const mode = customer ? "edit" : "create"

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid={`${mode === "edit" ? "edit" : "add"}-customer-dialog`}>
        <CustomerForm
          key={customer?.id ?? "new"}
          workspaceId={workspaceId}
          customer={customer ?? null}
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

function CustomerForm({
  workspaceId,
  customer,
  saving,
  setSaving,
  onCancel,
  onSaved,
}: {
  workspaceId: string
  customer: CustomerWithCount | null
  saving: boolean
  setSaving: (saving: boolean) => void
  onCancel: () => void
  onSaved: (customer: CustomerWithCount) => void
}) {
  const isEdit = customer !== null
  const [values, setValues] = useState<ContactValues>(() => contactValuesFrom(customer))
  // the API falls back to the customer's name when company is cleared, so treat that as "no company"
  const [company, setCompany] = useState(customer?.company && customer.company !== customer.name ? customer.company : "")
  const [active, setActive] = useState((customer?.status ?? "ACTIVE") === "ACTIVE")
  const [errors, setErrors] = useState<ContactErrors>({})

  const change = (field: keyof ContactValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (saving) return

    const nextErrors = validateContact(values, "Customer")
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const data = trimContact(values)
    const trimmedCompany = company.trim()
    const status = active ? "ACTIVE" : "INACTIVE"
    setSaving(true)
    try {
      if (isEdit) {
        const res = await updateCustomerApi(customer.id, {
          ...data,
          // only send company when it's set or being cleared, so a customer without one stays that way
          company: trimmedCompany || (customer.company ? "" : undefined),
          status,
          workspaceId,
        })
        const updated = res.data?.customer
        if (!updated) throw new Error("The server didn't return the updated customer")
        onSaved({ ...updated, _count: updated._count ?? customer._count })
        toast.success("Customer updated")
      } else {
        const res = await createCustomerApi({
          name: data.name,
          contactPerson: data.contactPerson || undefined,
          email: data.email || undefined,
          phone: data.phone || undefined,
          address: data.address || undefined,
          company: trimmedCompany || undefined,
          status,
          workspaceId,
        })
        const created = res.data?.customer
        if (!created) throw new Error("The server didn't return the new customer")
        onSaved({ ...created, _count: created._count ?? { items: 0 } })
        toast.success(`Customer “${data.name}” added`)
      }
    } catch (err) {
      const message = getErrorMessage(err, isEdit ? "Couldn't update customer" : "Couldn't add customer")
      const fieldError = serverFieldError(message)
      if (fieldError) setErrors(fieldError)
      else toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const idPrefix = isEdit ? "edit-customer" : "add-customer"

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit customer" : "Add customer"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update this customer's name and contact details."
            : "Keep contact details for the people and companies you ship to."}
        </DialogDescription>
      </DialogHeader>

      <ContactFields
        idPrefix={idPrefix}
        noun="Customer"
        values={values}
        errors={errors}
        onChange={change}
        disabled={saving}
        namePlaceholder="e.g. Jane Smith or Acme Corp"
        emailPlaceholder="purchasing@customer.com"
        afterName={
          <FormField id={`${idPrefix}-company`} label="Company" hint="Optional — the business this customer belongs to">
            <Input
              id={`${idPrefix}-company`}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Acme Corporation"
              maxLength={TEXT_MAX}
              autoComplete="off"
              disabled={saving}
            />
          </FormField>
        }
      />

      <ActiveField
        id={`${idPrefix}-active`}
        checked={active}
        onCheckedChange={setActive}
        description="Inactive customers stay on record with their linked items."
        disabled={saving}
      />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} data-testid="cancel-button-desktop">
          Cancel
        </Button>
        <Button type="submit" disabled={saving} data-testid="submit-button-desktop">
          {saving && <Loader2 className="animate-spin" />}
          {isEdit ? "Save changes" : "Add customer"}
        </Button>
      </DialogFooter>
    </form>
  )
}
