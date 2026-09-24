"use client"

import { useState } from "react"
import { Loader2, MapPin, Plus, X } from "lucide-react"
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
import { testIdSlug } from "@/components/items/item-utils"
import { getItemByIdApi, updateItemApi, type ItemWithDetails } from "@/lib/api/items.api"
import type { LocationWithCount } from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatQuantity } from "@/lib/format"

interface ManageLocationsDialogProps {
  isOpen: boolean
  onClose: () => void
  itemId: string
  currentLocationIds: string[]
  /** All locations in the workspace */
  locations: LocationWithCount[]
  onSuccess: (updatedItem: ItemWithDetails) => void
  /** Quantity currently stored per location id — locations holding stock can't be unassigned */
  quantities?: Record<string, number>
  unit?: string | null
}

/** Assign an item to storage locations (or unassign empty ones) */
export function ManageLocationsDialog({ isOpen, onClose, ...props }: ManageLocationsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="manage-locations-dialog">
        <DialogHeader>
          <DialogTitle>Storage locations</DialogTitle>
          <DialogDescription>Choose where this item can be stored. Stock is added to a location by adjusting or transferring.</DialogDescription>
        </DialogHeader>
        <ManageLocationsForm {...props} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function ManageLocationsForm({
  onClose,
  itemId,
  currentLocationIds,
  locations,
  onSuccess,
  quantities = {},
  unit,
}: Omit<ManageLocationsDialogProps, "isOpen">) {
  const [selectedIds, setSelectedIds] = useState<string[]>(currentLocationIds)
  const [pendingId, setPendingId] = useState("")
  const [saving, setSaving] = useState(false)

  const byId = new Map(locations.map((l) => [l.id, l]))
  const available = locations.filter((l) => !selectedIds.includes(l.id))
  const changed =
    selectedIds.length !== currentLocationIds.length || selectedIds.some((id) => !currentLocationIds.includes(id))

  const add = () => {
    if (!pendingId || selectedIds.includes(pendingId)) return
    setSelectedIds((ids) => [...ids, pendingId])
    setPendingId("")
  }

  const save = async () => {
    setSaving(true)
    try {
      await updateItemApi(itemId, { locationIds: selectedIds })
      const refreshed = await getItemByIdApi(itemId)
      if (refreshed.data?.item) onSuccess(refreshed.data.item as ItemWithDetails)
      toast.success("Locations updated successfully")
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update locations"))
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
              id="manage-location-picker"
              value={pendingId}
              onChange={setPendingId}
              options={available.map((l) => ({
                value: l.id,
                label: l.code,
                testId: `manage-location-option-${testIdSlug(l.code)}`,
              }))}
              placeholder={available.length ? "Choose a location" : "All locations assigned"}
              searchPlaceholder="Search locations…"
              emptyText="No location found."
              mono
              disabled={available.length === 0 || saving}
              triggerTestId="manage-location-select-trigger"
            />
          </div>
          <Button type="button" onClick={add} disabled={!pendingId || saving} data-testid="manage-location-add-button">
            <Plus /> Add
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            Assigned <span className="text-muted-foreground">({selectedIds.length})</span>
          </p>
          {selectedIds.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No locations assigned yet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {selectedIds.map((id) => {
                const code = byId.get(id)?.code ?? "Unknown location"
                const qty = quantities[id] ?? 0
                const isNew = !currentLocationIds.includes(id)
                return (
                  <li key={id} className="flex items-center gap-3 px-3 py-2" data-testid={`manage-location-row-${testIdSlug(code)}`}>
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">{code}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {isNew ? "New" : qty > 0 ? formatQuantity(qty, unit) : "Empty"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setSelectedIds((ids) => ids.filter((x) => x !== id))}
                      disabled={qty > 0 || saving}
                      title={qty > 0 ? "Move or remove the stock here first" : `Remove ${code}`}
                      aria-label={`Remove ${code}`}
                      data-testid={`manage-location-remove-${testIdSlug(code)}`}
                    >
                      <X />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          {Object.values(quantities).some((q) => q > 0) && (
            <p className="text-xs text-muted-foreground">Locations that still hold stock can&apos;t be removed.</p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving} data-testid="manage-location-cancel-button">
          Cancel
        </Button>
        <Button type="button" onClick={save} disabled={saving || !changed} data-testid="manage-location-save-button">
          {saving && <Loader2 className="animate-spin" />}
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  )
}
