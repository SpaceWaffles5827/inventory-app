"use client"

import Link from "next/link"
import { Eye, Loader2, MapPin, MoreVertical, Pencil, Printer, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatNumber } from "@/lib/format"
import { StructureChips, UtilisationBar } from "@/components/locations/location-ui"
import type { LocationListEntry, LocationRow } from "@/components/locations/types"

interface LocationMobileViewProps {
  rows: LocationRow[]
  canDelete: boolean
  deletingId?: string | null
  onEdit: (location: LocationListEntry) => void
  onPrint: (location: LocationListEntry) => void
  onDelete: (row: LocationRow) => void
}

/** Card list of locations for phones (the table takes over from `md`) */
export function LocationMobileView({ rows, canDelete, deletingId, onEdit, onPrint, onDelete }: LocationMobileViewProps) {
  return (
    <ul className="space-y-2" aria-label="Locations">
      {rows.map((row) => {
        const { location } = row
        const href = `/dashboard/locations/${location.id}`
        const deleting = deletingId === location.id

        return (
          <li
            key={location.id}
            className="relative rounded-xl border bg-card p-4 transition-colors active:bg-accent/40"
            data-testid={`location-row-${location.id}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="min-w-0">
                  {/* Stretched link: the whole card opens the location */}
                  <Link
                    href={href}
                    className="break-all font-mono text-base font-semibold leading-tight outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
                  >
                    {location.code}
                  </Link>
                  {location.description && (
                    <p className="truncate text-sm text-muted-foreground">{location.description}</p>
                  )}
                </div>

                <StructureChips structure={row.structure} max={3} />

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
                  {row.inUse ? (
                    <>
                      <span>
                        <span className="font-medium">{formatNumber(row.items)}</span>{" "}
                        <span className="text-muted-foreground">{row.items === 1 ? "item" : "items"}</span>
                      </span>
                      {row.units !== null && (
                        <span>
                          <span className="font-medium">{formatNumber(row.units)}</span>{" "}
                          <span className="text-muted-foreground">units</span>
                        </span>
                      )}
                    </>
                  ) : (
                    <Badge variant="muted">Empty</Badge>
                  )}
                </div>

                {row.units !== null && row.units > 0 && location.capacity > 0 && (
                  <UtilisationBar units={row.units} capacity={location.capacity} showLabel={false} className="pt-1" />
                )}
              </div>

              {/* Non-modal so the dialogs these items open get focus cleanly */}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative z-10 -mr-2 -mt-1 size-10 shrink-0"
                    aria-label={`Actions for ${location.code}`}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="animate-spin" /> : <MoreVertical />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href={href}>
                      <Eye /> View
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onEdit(location)} data-testid={`edit-location-button-${location.id}`}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onPrint(location)}>
                    <Printer /> Print label
                  </DropdownMenuItem>
                  {canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => onDelete(row)}
                        data-testid={`delete-location-button-${location.id}`}
                      >
                        <Trash2 /> Delete
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
  )
}
