"use client"

import Link from "next/link"
import { Diff, ExternalLink, MapPin, MoreHorizontal, Settings2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EmptyState } from "@/components/common/empty-state"
import { SectionHeader } from "@/components/common/page"
import { useConfirm } from "@/components/common/confirm-provider"
import { testIdSlug, type InventoryItemDetails } from "@/components/items/item-utils"
import { getItemByIdApi, updateItemApi, type ItemWithDetails } from "@/lib/api/items.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatNumber } from "@/lib/format"

interface ItemLocationsTabProps {
  item: InventoryItemDetails
  onManageLocations: () => void
  onAdjustStock: (locationId: string) => void
  onItemUpdate: (updatedItem: ItemWithDetails) => void
}

/** Where the item is stored and how much is in each location */
export function ItemLocationsTab({ item, onManageLocations, onAdjustStock, onItemUpdate }: ItemLocationsTabProps) {
  const confirm = useConfirm()
  const rows = [...(item.locations ?? [])].sort(
    (a, b) => (b.quantity ?? 0) - (a.quantity ?? 0) || a.location.code.localeCompare(b.location.code)
  )
  const total = rows.reduce((sum, l) => sum + (l.quantity ?? 0), 0)

  const removeLocation = async (locationId: string, code: string) => {
    await confirm({
      title: `Remove ${code}?`,
      description: "The item will no longer be assigned to this location. You can add it back at any time.",
      destructive: true,
      confirmLabel: "Remove",
      action: async () => {
        try {
          await updateItemApi(item.id, { locationIds: rows.map((l) => l.locationId).filter((id) => id !== locationId) })
          const refreshed = await getItemByIdApi(item.id)
          if (refreshed.data?.item) onItemUpdate(refreshed.data.item as ItemWithDetails)
          toast.success(`Removed from ${code}`)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't remove the location"))
          throw err
        }
      },
    })
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card" data-testid="item-locations-tab">
      <SectionHeader
        className="border-b px-4 py-3"
        title="Storage locations"
        description={
          rows.length > 0
            ? `${formatNumber(total)}${item.unit ? ` ${item.unit}` : ""} across ${rows.length} ${rows.length === 1 ? "location" : "locations"}`
            : "Where this item is kept"
        }
        actions={
          <Button variant="outline" size="sm" onClick={onManageLocations} data-testid="item-manage-locations-button">
            <Settings2 /> Manage
          </Button>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          bare
          icon={MapPin}
          title="Not stored anywhere yet"
          description="Assign a location, then adjust stock into it."
          action={
            <Button onClick={onManageLocations}>
              <MapPin /> Assign a location
            </Button>
          }
        />
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const qty = row.quantity ?? 0
            const share = total > 0 ? Math.round((qty / total) * 100) : 0
            // Only empty locations can be unassigned (the API rejects removing stocked ones)
            const canRemove = qty === 0
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 px-4 py-3"
                data-testid={`item-location-row-${testIdSlug(row.location.code)}`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-4" />
                </span>

                <div className="min-w-0 flex-1 space-y-1">
                  <Link
                    href={`/dashboard/locations/${row.locationId}`}
                    className="block truncate font-mono text-sm font-medium hover:underline"
                  >
                    {row.location.code}
                  </Link>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{qty === 0 ? "Empty" : `${share}%`}</span>
                  </div>
                  {(row.location.description || row.minStock > 0 || row.maxStock > 0) && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        row.location.description,
                        row.minStock > 0 ? `Min ${formatNumber(row.minStock)}` : null,
                        row.maxStock > 0 ? `Max ${formatNumber(row.maxStock)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-right tabular-nums">
                  <span className="text-lg font-semibold" data-testid="item-location-quantity">
                    {formatNumber(qty)}
                  </span>
                  {item.unit && <span className="ml-1 text-xs text-muted-foreground">{item.unit}</span>}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAdjustStock(row.locationId)}
                    aria-label={`Adjust stock in ${row.location.code}`}
                    data-testid="item-location-adjust-button"
                  >
                    <Diff />
                    <span className="hidden sm:inline">Adjust</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-9 text-muted-foreground" aria-label={`More for ${row.location.code}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/locations/${row.locationId}`}>
                          <ExternalLink /> Open location
                        </Link>
                      </DropdownMenuItem>
                      {canRemove && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => removeLocation(row.locationId, row.location.code)}>
                            <Trash2 /> Remove location
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
