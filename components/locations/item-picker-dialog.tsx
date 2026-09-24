"use client"

import { useState } from "react"
import { Loader2, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { ItemWithRelations } from "@/lib/api/items.api"
import { formatQuantity } from "@/lib/format"

const MAX_RESULTS = 50

interface ItemPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null while loading */
  items: ItemWithRelations[] | null
  error?: string | null
  locationId: string
  locationCode: string
  onSelect: (item: ItemWithRelations) => void
  /** Switch to the camera scanner instead */
  onScan: () => void
}

/** Choose which item to adjust at a location — items already stored here come first */
export function ItemPickerDialog({
  open,
  onOpenChange,
  items,
  error,
  locationId,
  locationCode,
  onSelect,
  onScan,
}: ItemPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 sm:max-w-lg" data-testid="location-item-picker">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            Choose an item to add to or remove from{" "}
            <span className="whitespace-nowrap font-mono text-foreground">{locationCode}</span>.
          </DialogDescription>
        </DialogHeader>
        <PickerList items={items} error={error} locationId={locationId} onSelect={onSelect} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onScan}>
            <ScanLine /> Scan item barcode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PickerList({
  items,
  error,
  locationId,
  onSelect,
}: Pick<ItemPickerDialogProps, "items" | "error" | "locationId" | "onSelect">) {
  const [search, setSearch] = useState("")

  if (error && !items) {
    return <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">{error}</p>
  }
  if (!items) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading items…
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  const matches = q
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.itemNumber.toLowerCase().includes(q) ||
          (item.barcode ?? "").toLowerCase().includes(q)
      )
    : items
  const qtyHere = (item: ItemWithRelations) => item.locations?.find((l) => l.locationId === locationId)?.quantity
  const here = matches.filter((item) => qtyHere(item) !== undefined)
  const others = matches.filter((item) => qtyHere(item) === undefined)
  const shownOthers = others.slice(0, Math.max(0, MAX_RESULTS - here.length))
  const hidden = others.length - shownOthers.length

  const renderItem = (item: ItemWithRelations) => {
    const qty = qtyHere(item)
    return (
      <CommandItem
        key={item.id}
        value={item.id}
        onSelect={() => onSelect(item)}
        className="min-h-11 gap-3"
        data-testid={`location-item-option-${item.id}`}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{item.name}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{item.itemNumber}</p>
        </div>
        {qty !== undefined && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formatQuantity(qty, item.unit)} here
          </span>
        )}
      </CommandItem>
    )
  }

  return (
    <Command shouldFilter={false} className="rounded-lg border">
      <CommandInput value={search} onValueChange={setSearch} placeholder="Search name, item number or barcode…" />
      <CommandList className="max-h-[45dvh] sm:max-h-80">
        <CommandEmpty>{items.length === 0 ? "No items in this workspace yet." : "No matching items."}</CommandEmpty>
        {here.length > 0 && <CommandGroup heading="Stored here">{here.map(renderItem)}</CommandGroup>}
        {shownOthers.length > 0 && <CommandGroup heading="Other items">{shownOthers.map(renderItem)}</CommandGroup>}
        {hidden > 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {hidden} more — keep typing to narrow the list.
          </p>
        )}
      </CommandList>
    </Command>
  )
}
