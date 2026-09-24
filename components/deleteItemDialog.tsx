"use client"

import { useState, type FormEvent } from "react"
import { AlertTriangle, Loader2, Trash2 } from "lucide-react"
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
import { Field } from "@/components/items/form-field"
import { deleteItemApi } from "@/lib/api/items.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatNumber, formatQuantity } from "@/lib/format"

/** The fields the dialog needs — any item shape from the API satisfies it */
export interface DeletableItem {
  id: string
  name: string
  itemNumber: string
  onHand: number
  unit?: string | null
  locations?: { quantity: number }[] | null
}

interface DeleteItemDialogProps {
  item: DeletableItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Permanently deletes an item. Items that still hold stock need the on-hand quantity typed in
 * as confirmation; empty items only need a click.
 */
export function DeleteItemDialog({ item, open, onOpenChange, onSuccess }: DeleteItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="delete-item-dialog">
        {item && (
          <DeleteItemForm
            item={item}
            onCancel={() => onOpenChange(false)}
            onDeleted={() => {
              onSuccess?.()
              onOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeleteItemForm({ item, onCancel, onDeleted }: { item: DeletableItem; onCancel: () => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState("")
  const [deleting, setDeleting] = useState(false)

  const hasStock = item.onHand > 0
  const stockedLocationCount = (item.locations ?? []).filter((l) => l.quantity > 0).length
  const confirmed = !hasStock || confirmation.trim() === String(item.onHand)
  const showMismatch = hasStock && confirmation.trim() !== "" && !confirmed

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!confirmed) return
    setDeleting(true)
    try {
      await deleteItemApi(item.id)
      toast.success("Item deleted successfully", { description: item.name })
      onDeleted()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete the item"))
      setDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Delete this item?</DialogTitle>
        <DialogDescription>
          This permanently removes <span className="font-medium text-foreground">{item.name}</span> together with its stock
          records, lots and movement history. This can&apos;t be undone.
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-medium">{item.name}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.itemNumber}</span>
        </div>
        <div className="mt-1 text-muted-foreground">
          {hasStock
            ? `${formatQuantity(item.onHand, item.unit)} on hand${
                stockedLocationCount > 0
                  ? ` in ${formatNumber(stockedLocationCount)} ${stockedLocationCount === 1 ? "location" : "locations"}`
                  : ""
              }`
            : "No stock on hand"}
        </div>
      </div>

      {hasStock && (
        <>
          <div className="flex gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p>
              This item still has stock. Deleting it writes off{" "}
              <span className="font-semibold">{formatQuantity(item.onHand, item.unit)}</span> from your records.
            </p>
          </div>
          <Field
            label={
              <span>
                Type <span className="font-mono font-semibold">{item.onHand}</span> to confirm
              </span>
            }
            htmlFor="confirm-stock"
            error={showMismatch ? "That doesn't match the quantity on hand" : undefined}
          >
            <Input
              id="confirm-stock"
              inputMode="numeric"
              autoComplete="off"
              placeholder={String(item.onHand)}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              aria-invalid={showMismatch || undefined}
              data-testid="confirm-stock-input"
            />
          </Field>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={deleting} data-testid="cancel-button-desktop">
          Cancel
        </Button>
        <Button type="submit" variant="destructive" disabled={deleting || !confirmed} data-testid="submit-button-desktop">
          {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {deleting ? "Deleting…" : "Delete item"}
        </Button>
      </DialogFooter>
    </form>
  )
}
