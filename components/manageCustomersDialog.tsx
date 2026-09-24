"use client"

import { useEffect, useState } from "react"
import { Building2, Loader2, Plus, X } from "lucide-react"
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
import { EntityCombobox } from "@/components/items/entity-combobox"
import { getItemByIdApi, updateItemApi, type ItemWithDetails } from "@/lib/api/items.api"
import { getCustomersApi, type CustomerWithCount } from "@/lib/api/customers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"

interface ManageCustomersDialogProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  currentCustomerIds: string[]
  onSuccess: (updatedItem: ItemWithDetails) => void
}

/** Link an item to the customers it is kept for */
export function ManageCustomersDialog({ isOpen, onClose, ...props }: ManageCustomersDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Customers</DialogTitle>
          <DialogDescription>Link this item to the customers it is stocked for.</DialogDescription>
        </DialogHeader>
        <ManageCustomersForm {...props} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function ManageCustomersForm({ onClose, itemId, currentCustomerIds, onSuccess }: Omit<ManageCustomersDialogProps, "isOpen">) {
  const { workspaceId } = useWorkspace()
  const [customers, setCustomers] = useState<CustomerWithCount[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>(currentCustomerIds)
  const [pendingId, setPendingId] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    getCustomersApi({ workspaceId, status: "ACTIVE" })
      .then((res) => {
        if (!cancelled) setCustomers(res.data?.customers ?? [])
      })
      .catch((err) => toast.error(getErrorMessage(err, "Couldn't load customers")))
      .finally(() => {
        if (!cancelled) setLoadingCustomers(false)
      })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const byId = new Map(customers.map((c) => [c.id, c]))
  const available = customers.filter((c) => !selectedIds.includes(c.id))
  const changed =
    selectedIds.length !== currentCustomerIds.length || selectedIds.some((id) => !currentCustomerIds.includes(id))

  const add = () => {
    if (!pendingId || selectedIds.includes(pendingId)) return
    setSelectedIds((ids) => [...ids, pendingId])
    setPendingId("")
  }

  const save = async () => {
    setSaving(true)
    try {
      await updateItemApi(itemId, { customerIds: selectedIds })
      const refreshed = await getItemByIdApi(itemId)
      if (refreshed.data?.item) onSuccess(refreshed.data.item as ItemWithDetails)
      toast.success("Customers updated")
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update customers"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <EntityCombobox
              id="manage-customer-picker"
              value={pendingId}
              onChange={setPendingId}
              options={available.map((c) => ({ value: c.id, label: c.company ? `${c.name} · ${c.company}` : c.name }))}
              placeholder={loadingCustomers ? "Loading…" : available.length ? "Choose a customer" : "No more customers"}
              searchPlaceholder="Search customers…"
              emptyText="No customer found."
              disabled={loadingCustomers || available.length === 0 || saving}
            />
          </div>
          <Button type="button" onClick={add} disabled={!pendingId || saving}>
            <Plus /> Add
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Linked <span className="text-muted-foreground">({selectedIds.length})</span>
          </p>
          {selectedIds.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              Not linked to any customer.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {selectedIds.map((id) => {
                const customer = byId.get(id)
                return (
                  <li key={id} className="flex items-center gap-3 px-3 py-2">
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{customer?.name ?? (loadingCustomers ? "Loading…" : "Inactive customer")}</p>
                      {customer?.company && <p className="truncate text-xs text-muted-foreground">{customer.company}</p>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setSelectedIds((ids) => ids.filter((x) => x !== id))}
                      disabled={saving}
                      aria-label={`Unlink ${customer?.name ?? "customer"}`}
                    >
                      <X />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={saving || !changed}>
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  )
}
