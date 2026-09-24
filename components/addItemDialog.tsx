"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Loader2, Plus, ScanLine } from "lucide-react"
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
import { AddCategoryDialog } from "@/components/addCategoryDialog"
import { AddSupplierDialog } from "@/components/addSupplierDialog"
import { AddLocationDialog } from "@/components/addLocationDialog"
import { BarcodeScannerDialog } from "@/components/barcodeScannerDialog"
import { EntityCombobox } from "@/components/items/entity-combobox"
import { Field, invalidProps } from "@/components/items/form-field"
import { DEFAULT_REORDER_POINT, testIdSlug, type ReorderPointFields } from "@/components/items/item-utils"
import { createItemApi, type CreateItemRequest } from "@/lib/api/items.api"
import { getCategoriesApi, type CategoryWithCount } from "@/lib/api/categories.api"
import {
  getLocationsApi,
  getWorkspaceStructureApi,
  type LocationTemplate,
  type LocationWithCount,
} from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"

interface AddItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Defaults to the current workspace */
  workspaceId?: string
  onSuccess?: () => void
  /** Preselect a category (e.g. when adding from a category page) */
  defaultCategoryId?: string
  /** Prefill the barcode (e.g. an unknown code from the scanner) */
  defaultBarcode?: string
}

/** Create an item with its starting stock, cost, reorder point and storage location */
export function AddItemDialog({
  open,
  onOpenChange,
  workspaceId,
  onSuccess,
  defaultCategoryId,
  defaultBarcode,
}: AddItemDialogProps) {
  const { workspaceId: currentWorkspaceId } = useWorkspace()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl" data-testid="add-item-dialog">
        <DialogHeader>
          <DialogTitle data-testid="dialog-title">Add item</DialogTitle>
          <DialogDescription>Add a product to your inventory. You can add photos and more details afterwards.</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every open starts with a fresh form */}
        <AddItemForm
          workspaceId={workspaceId || currentWorkspaceId}
          defaultCategoryId={defaultCategoryId}
          defaultBarcode={defaultBarcode}
          onCancel={() => onOpenChange(false)}
          onCreated={() => {
            onSuccess?.()
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

interface FormState {
  name: string
  unit: string
  barcode: string
  categoryId: string
  supplierId: string
  description: string
  onHand: string
  cost: string
  reorderPoint: string
  locationId: string
}

type FormErrors = Partial<Record<keyof FormState, string>>

const WHOLE_NUMBER = /^\d+$/

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (!form.name.trim()) errors.name = "Enter a name for the item"

  if (form.onHand.trim() === "") errors.onHand = "Enter the starting quantity (0 is fine)"
  else if (!WHOLE_NUMBER.test(form.onHand.trim())) errors.onHand = "Use a whole number, 0 or more"

  const cost = Number(form.cost)
  if (form.cost.trim() === "") errors.cost = "Enter the unit cost"
  else if (!Number.isFinite(cost) || cost < 0) errors.cost = "Enter a valid amount, 0 or more"

  if (form.reorderPoint.trim() !== "" && !WHOLE_NUMBER.test(form.reorderPoint.trim())) {
    errors.reorderPoint = "Use a whole number, 0 or more"
  }

  if (!errors.onHand && Number(form.onHand) > 0 && !form.locationId) {
    errors.locationId = "Storage location is required when initial stock is above 0"
  }
  return errors
}

// DOM ids, in form order — used to focus the first invalid field
const FIELD_IDS: Record<keyof FormState, string> = {
  name: "item-name",
  unit: "item-unit",
  barcode: "item-barcode",
  categoryId: "item-category",
  supplierId: "item-supplier",
  description: "item-description",
  onHand: "item-onhand",
  cost: "item-cost",
  reorderPoint: "item-reorder-point",
  locationId: "item-location",
}

function AddItemForm({
  workspaceId,
  defaultCategoryId,
  defaultBarcode,
  onCancel,
  onCreated,
}: {
  workspaceId: string
  defaultCategoryId?: string
  defaultBarcode?: string
  onCancel: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<FormState>({
    name: "",
    unit: "",
    barcode: defaultBarcode ?? "",
    categoryId: defaultCategoryId ?? "",
    supplierId: "",
    description: "",
    onHand: "",
    cost: "",
    reorderPoint: String(DEFAULT_REORDER_POINT),
    locationId: "",
  })
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [structure, setStructure] = useState<LocationTemplate | null>(null)
  const [loadingLookups, setLoadingLookups] = useState(true)

  const [createOpen, setCreateOpen] = useState<"category" | "supplier" | "location" | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const loadCategories = useCallback(
    () => getCategoriesApi(workspaceId).then((res) => setCategories(res.data?.categories ?? [])),
    [workspaceId]
  )
  const loadSuppliers = useCallback(
    () => getSuppliersApi(workspaceId).then((res) => setSuppliers(res.data?.suppliers ?? [])),
    [workspaceId]
  )
  const loadLocations = useCallback(
    () => getLocationsApi(workspaceId).then((res) => setLocations(res.data?.locations ?? [])),
    [workspaceId]
  )

  useEffect(() => {
    if (!workspaceId) return
    Promise.allSettled([
      loadCategories(),
      loadSuppliers(),
      loadLocations(),
      getWorkspaceStructureApi(workspaceId).then((res) => setStructure(res.data?.structure ?? null)),
    ]).then((results) => {
      // the location structure is only a default for new locations — ignore its failure
      if (results.slice(0, 3).some((r) => r.status === "rejected")) {
        toast.error("Some lists couldn't be loaded", { description: "Categories, suppliers or locations may be missing." })
      }
      setLoadingLookups(false)
    })
  }, [workspaceId, loadCategories, loadSuppliers, loadLocations])

  const errors = submitted ? validate(form) : {}

  const set = (field: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    const found = validate(form)
    const firstInvalid = (Object.keys(FIELD_IDS) as (keyof FormState)[]).find((key) => found[key])
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus()
      return
    }

    setSaving(true)
    try {
      const payload: CreateItemRequest & ReorderPointFields = {
        workspaceId,
        name: form.name.trim(),
        barcode: form.barcode.trim() || undefined,
        unit: form.unit.trim() || undefined,
        description: form.description.trim() || undefined,
        onHand: Number(form.onHand),
        cost: Number(form.cost),
        reorderPoint: form.reorderPoint.trim() === "" ? DEFAULT_REORDER_POINT : Number(form.reorderPoint),
        categoryId: form.categoryId || undefined,
        supplierId: form.supplierId || undefined,
        locationId: form.locationId || undefined,
      }
      await createItemApi(payload)
      toast.success("Item created successfully", { description: payload.name })
      onCreated()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't create the item"))
    } finally {
      setSaving(false)
    }
  }

  const stockAboveZero = WHOLE_NUMBER.test(form.onHand.trim()) && Number(form.onHand) > 0

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Name" htmlFor={FIELD_IDS.name} required error={errors.name} errorTestId="item-name-error">
            <Input
              {...invalidProps(FIELD_IDS.name, errors.name)}
              placeholder="e.g. Wireless mouse"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              autoComplete="off"
              data-testid="item-name-input"
            />
          </Field>
          <Field label="Unit" htmlFor={FIELD_IDS.unit} hint="EA, BOX, KG…">
            <Input
              {...invalidProps(FIELD_IDS.unit)}
              placeholder="EA"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              data-testid="item-unit-input"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor={FIELD_IDS.categoryId}>
            <EntityCombobox
              id={FIELD_IDS.categoryId}
              value={form.categoryId}
              onChange={(v) => set("categoryId", v)}
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
                testId: `category-option-${testIdSlug(c.name)}`,
              }))}
              placeholder={loadingLookups ? "Loading…" : "Choose a category"}
              searchPlaceholder="Search categories…"
              emptyText="No category found."
              createLabel="Create new category"
              onCreate={() => setCreateOpen("category")}
              createTestId="create-category-option"
              clearable
              disabled={loadingLookups}
              triggerTestId="category-select-button"
            />
          </Field>
          <Field label="Supplier" htmlFor={FIELD_IDS.supplierId}>
            <EntityCombobox
              id={FIELD_IDS.supplierId}
              value={form.supplierId}
              onChange={(v) => set("supplierId", v)}
              options={suppliers.map((s) => ({
                value: s.id,
                label: s.name,
                testId: `supplier-option-${testIdSlug(s.name)}`,
              }))}
              placeholder={loadingLookups ? "Loading…" : "Choose a supplier"}
              searchPlaceholder="Search suppliers…"
              emptyText="No supplier found."
              createLabel="Create new supplier"
              onCreate={() => setCreateOpen("supplier")}
              createTestId="create-supplier-option"
              clearable
              disabled={loadingLookups}
              triggerTestId="supplier-select-button"
            />
          </Field>
        </div>

        <Field label="Barcode" htmlFor={FIELD_IDS.barcode} hint="Optional — scan it or type the digits">
          <div className="flex gap-2">
            <Input
              {...invalidProps(FIELD_IDS.barcode)}
              className="font-mono"
              placeholder="e.g. 0012345678905"
              value={form.barcode}
              onChange={(e) => set("barcode", e.target.value)}
              autoComplete="off"
              data-testid="item-barcode-input"
            />
            <Button type="button" variant="outline" onClick={() => setScannerOpen(true)} aria-label="Scan barcode">
              <ScanLine />
              <span className="hidden sm:inline">Scan</span>
            </Button>
          </div>
        </Field>

        <Field label="Description" htmlFor={FIELD_IDS.description}>
          <Textarea
            id={FIELD_IDS.description}
            placeholder="Size, colour, model or anything that helps identify it"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            data-testid="item-description-input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Initial stock" htmlFor={FIELD_IDS.onHand} required error={errors.onHand} errorTestId="item-stock-error">
            <Input
              {...invalidProps(FIELD_IDS.onHand, errors.onHand)}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder="0"
              value={form.onHand}
              onChange={(e) => set("onHand", e.target.value)}
              data-testid="item-stock-input"
            />
          </Field>
          <Field label="Unit cost" htmlFor={FIELD_IDS.cost} required error={errors.cost} errorTestId="item-cost-error">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                {...invalidProps(FIELD_IDS.cost, errors.cost)}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                className="pl-7"
                value={form.cost}
                onChange={(e) => set("cost", e.target.value)}
                data-testid="item-cost-input"
              />
            </div>
          </Field>
          <Field
            label="Reorder point"
            htmlFor={FIELD_IDS.reorderPoint}
            hint="Low stock at or below this"
            error={errors.reorderPoint}
            errorTestId="item-reorder-point-error"
            className="col-span-2 sm:col-span-1"
          >
            <Input
              {...invalidProps(FIELD_IDS.reorderPoint, errors.reorderPoint)}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              placeholder={String(DEFAULT_REORDER_POINT)}
              value={form.reorderPoint}
              onChange={(e) => set("reorderPoint", e.target.value)}
              data-testid="item-reorder-point-input"
            />
          </Field>
        </div>

        <Field
          label="Storage location"
          htmlFor={FIELD_IDS.locationId}
          required={stockAboveZero}
          hint={stockAboveZero ? "Where the initial stock is kept" : "Optional when starting with 0 stock"}
          error={errors.locationId}
          // the e2e suite asserts the "location is required" message via this id
          errorTestId="form-error-message"
        >
          <EntityCombobox
            id={FIELD_IDS.locationId}
            value={form.locationId}
            onChange={(v) => set("locationId", v)}
            options={locations.map((l) => ({
              value: l.id,
              label: l.code,
              testId: `location-option-${testIdSlug(l.code)}`,
            }))}
            placeholder={loadingLookups ? "Loading…" : "Choose a location"}
            searchPlaceholder="Search locations…"
            emptyText="No location found."
            createLabel="Create new location"
            onCreate={() => setCreateOpen("location")}
            createTestId="create-location-option"
            clearable
            mono
            invalid={!!errors.locationId}
            disabled={loadingLookups}
            triggerTestId="location-select-button"
            searchTestId="location-search-input"
          />
        </Field>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving} data-testid="cancel-button-desktop">
            Cancel
          </Button>
          <Button type="submit" disabled={saving || loadingLookups} data-testid="submit-button-desktop">
            {saving ? <Loader2 className="animate-spin" /> : <Plus />}
            {saving ? "Adding…" : "Add item"}
          </Button>
        </DialogFooter>
      </form>

      <AddCategoryDialog
        open={createOpen === "category"}
        onOpenChange={(o) => setCreateOpen(o ? "category" : null)}
        workspaceId={workspaceId}
        onSuccess={async (category) => {
          await loadCategories().catch(() => undefined)
          set("categoryId", category.id)
        }}
      />
      <AddSupplierDialog
        open={createOpen === "supplier"}
        onOpenChange={(o) => setCreateOpen(o ? "supplier" : null)}
        workspaceId={workspaceId}
        onSuccess={async (supplier) => {
          await loadSuppliers().catch(() => undefined)
          set("supplierId", supplier.id)
        }}
      />
      <AddLocationDialog
        open={createOpen === "location"}
        onOpenChange={(o) => setCreateOpen(o ? "location" : null)}
        workspaceId={workspaceId}
        defaultStructure={structure}
        onSuccess={async (location) => {
          await loadLocations().catch(() => undefined)
          set("locationId", location.id)
        }}
        onStructureUpdate={setStructure}
      />
      <BarcodeScannerDialog
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        currentBarcode={form.barcode}
        onBarcodeScanned={(code) => set("barcode", code)}
      />
    </>
  )
}
