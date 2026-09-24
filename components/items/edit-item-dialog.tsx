"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2, PackageCheck, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BarcodeScannerDialog } from "@/components/barcodeScannerDialog"
import { getItemByIdApi, updateItemApi, type ItemWithDetails, type UpdateItemRequest } from "@/lib/api/items.api"
import { getCategoriesApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { EntityCombobox } from "./entity-combobox"
import { Field, invalidProps } from "./form-field"
import { DEFAULT_REORDER_POINT, getReorderPoint, type InventoryItemDetails } from "./item-utils"

interface EditItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItemDetails
  /** Receives the reloaded item after a successful save */
  onSaved: (item: ItemWithDetails) => void
  /** Only admins may switch lot tracking on or off — the toggle is hidden otherwise */
  canToggleLotTracking?: boolean
}

/** Edit an item's details, cost, reorder point and lot tracking */
export function EditItemDialog({ open, onOpenChange, item, onSaved, canToggleLotTracking = true }: EditItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="edit-item-dialog">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          <DialogDescription>Changes apply everywhere this item appears.</DialogDescription>
        </DialogHeader>
        <EditItemForm
          item={item}
          canToggleLotTracking={canToggleLotTracking}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FormState {
  name: string
  itemNumber: string
  barcode: string
  unit: string
  categoryId: string
  supplierId: string
  cost: string
  reorderPoint: string
  description: string
  lotTracking: boolean
}

type FormErrors = Partial<Record<keyof FormState, string>>

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = "Enter a name"
  if (!form.itemNumber.trim()) errors.itemNumber = "Enter an item number"
  const cost = Number(form.cost)
  if (form.cost.trim() === "") errors.cost = "Enter the unit cost"
  else if (!Number.isFinite(cost) || cost < 0) errors.cost = "Enter a valid amount, 0 or more"
  if (form.reorderPoint.trim() !== "" && !/^\d+$/.test(form.reorderPoint.trim())) errors.reorderPoint = "Use a whole number, 0 or more"
  return errors
}

const FIELD_ORDER: (keyof FormState)[] = ["name", "itemNumber", "cost", "reorderPoint"]

/** PATCH body — nullable fields let the user clear a category, supplier, barcode etc. */
type ItemPatch = Omit<UpdateItemRequest, "barcode" | "unit" | "description" | "categoryId" | "supplierId"> & {
  barcode?: string | null
  unit?: string | null
  description?: string | null
  categoryId?: string | null
  supplierId?: string | null
  reorderPoint?: number
}

function EditItemForm({
  item,
  canToggleLotTracking,
  onClose,
  onSaved,
}: {
  item: InventoryItemDetails
  canToggleLotTracking: boolean
  onClose: () => void
  onSaved: (item: ItemWithDetails) => void
}) {
  const { workspaceId } = useWorkspace()
  const [form, setForm] = useState<FormState>(() => ({
    name: item.name,
    itemNumber: item.itemNumber,
    barcode: item.barcode ?? "",
    unit: item.unit ?? "",
    categoryId: item.categoryId ?? "",
    supplierId: item.supplierId ?? "",
    cost: String(item.cost),
    reorderPoint: String(getReorderPoint(item)),
    description: item.description ?? "",
    lotTracking: item.lotTracking,
  }))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([getCategoriesApi(workspaceId), getSuppliersApi(workspaceId)]).then(([cats, sups]) => {
      if (cancelled) return
      if (cats.status === "fulfilled") setCategories(cats.value.data?.categories ?? [])
      if (sups.status === "fulfilled") setSuppliers(sups.value.data?.suppliers ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  // Keep the current selection visible even before the lists load
  const categoryOptions = categories.length
    ? categories.map((c) => ({ value: c.id, label: c.name }))
    : item.category
      ? [{ value: item.category.id, label: item.category.name }]
      : []
  const supplierOptions = suppliers.length
    ? suppliers.map((s) => ({ value: s.id, label: s.name }))
    : item.supplier
      ? [{ value: item.supplier.id, label: item.supplier.name }]
      : []

  const errors = submitted ? validate(form) : {}
  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm((f) => ({ ...f, [field]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const found = validate(form)
    const firstInvalid = FIELD_ORDER.find((k) => found[k])
    if (firstInvalid) {
      document.getElementById(`edit-item-${firstInvalid}`)?.focus()
      return
    }

    const orNull = (value: string) => value.trim() || null
    const payload: ItemPatch = {
      name: form.name.trim(),
      itemNumber: form.itemNumber.trim(),
      barcode: orNull(form.barcode),
      unit: orNull(form.unit),
      description: orNull(form.description),
      categoryId: form.categoryId || null,
      supplierId: form.supplierId || null,
      cost: Number(form.cost),
      reorderPoint: form.reorderPoint.trim() === "" ? DEFAULT_REORDER_POINT : Number(form.reorderPoint),
    }
    if (form.lotTracking !== item.lotTracking) payload.lotTracking = form.lotTracking

    setSaving(true)
    try {
      await updateItemApi(item.id, payload as UpdateItemRequest)
      const refreshed = await getItemByIdApi(item.id)
      if (refreshed.data?.item) onSaved(refreshed.data.item as ItemWithDetails)
      toast.success("Item updated successfully")
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't save your changes"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Name" htmlFor="edit-item-name" required error={errors.name}>
            <Input
              {...invalidProps("edit-item-name", errors.name)}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="off"
              data-testid="edit-item-name-input"
            />
          </Field>
          <Field label="Item number" htmlFor="edit-item-itemNumber" required error={errors.itemNumber}>
            <Input
              {...invalidProps("edit-item-itemNumber", errors.itemNumber)}
              className="font-mono"
              value={form.itemNumber}
              onChange={(e) => set("itemNumber", e.target.value)}
              autoComplete="off"
              data-testid="edit-item-number-input"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Barcode" htmlFor="edit-item-barcode">
            <div className="flex gap-2">
              <Input
                {...invalidProps("edit-item-barcode")}
                className="font-mono"
                placeholder="Scan or type"
                value={form.barcode}
                onChange={(e) => set("barcode", e.target.value)}
                autoComplete="off"
                data-testid="edit-item-barcode-input"
              />
              <Button type="button" variant="outline" onClick={() => setScannerOpen(true)} aria-label="Scan barcode">
                <ScanLine />
                <span className="hidden sm:inline">Scan</span>
              </Button>
            </div>
          </Field>
          <Field label="Unit" htmlFor="edit-item-unit" hint="EA, BOX, KG…">
            <Input
              {...invalidProps("edit-item-unit")}
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              data-testid="edit-item-unit-input"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="edit-item-category">
            <EntityCombobox
              id="edit-item-category"
              value={form.categoryId}
              onChange={(v) => set("categoryId", v)}
              options={categoryOptions}
              placeholder="No category"
              searchPlaceholder="Search categories…"
              emptyText="No category found."
              clearable
            />
          </Field>
          <Field label="Supplier" htmlFor="edit-item-supplier">
            <EntityCombobox
              id="edit-item-supplier"
              value={form.supplierId}
              onChange={(v) => set("supplierId", v)}
              options={supplierOptions}
              placeholder="No supplier"
              searchPlaceholder="Search suppliers…"
              emptyText="No supplier found."
              clearable
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Unit cost" htmlFor="edit-item-cost" required error={errors.cost}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                {...invalidProps("edit-item-cost", errors.cost)}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                className="pl-7"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
                data-testid="edit-item-cost-input"
              />
            </div>
          </Field>
          <Field label="Reorder point" htmlFor="edit-item-reorderPoint" hint="Low stock at or below this" error={errors.reorderPoint}>
            <Input
              {...invalidProps("edit-item-reorderPoint", errors.reorderPoint)}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder={String(DEFAULT_REORDER_POINT)}
              value={form.reorderPoint}
              onChange={(e) => set("reorderPoint", e.target.value)}
              data-testid="edit-item-reorder-point-input"
            />
          </Field>
        </div>

        <Field label="Description" htmlFor="edit-item-description">
          <Textarea
            id="edit-item-description"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            data-testid="edit-item-description-input"
          />
        </Field>

        {canToggleLotTracking && (
          <label
            htmlFor="edit-item-lot-tracking"
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <PackageCheck className="size-4" />
            </span>
            <span className="min-w-0 flex-1 space-y-0.5">
              <span className="block text-sm font-medium">Lot tracking</span>
              <span className="block text-xs text-muted-foreground">
                {form.lotTracking === item.lotTracking
                  ? form.lotTracking
                    ? "Stock is tracked per lot, each with its own dates and locations."
                    : "Track batches with lot numbers and expiry dates."
                  : form.lotTracking
                    ? "Current stock becomes a “pre-existing stock” lot; new stock is received as lots."
                    : "All lot quantities will be merged into untracked stock. Lot records are kept for reference."}
              </span>
            </span>
            <Switch
              id="edit-item-lot-tracking"
              checked={form.lotTracking}
              onCheckedChange={(checked) => set("lotTracking", checked)}
              data-testid="lot-tracking-switch"
            />
          </label>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} data-testid="cancel-item-edit-button">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} data-testid="save-item-button">
            {saving && <Loader2 className="animate-spin" />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </form>

      <BarcodeScannerDialog
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        currentBarcode={form.barcode}
        onBarcodeScanned={(barcode) => set("barcode", barcode)}
      />
    </>
  )
}
