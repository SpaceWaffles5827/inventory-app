"use client"

import Link from "next/link"
import { ArrowDownUp, Eye, MinusCircle, MoreVertical } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StockStatusBadge } from "@/components/common/status-badge"
import { formatDate, formatNumber, formatQuantity } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { ItemWithRelations } from "@/lib/api/items.api"
import { ItemThumbnail } from "./item-thumbnail"
import type { LocationItemRow } from "./types"

/** A lot with stock at this location */
export interface LotHere {
  id: string
  lotNumber: string
  quantity: number
  expirationDate: Date | string | null
}

export interface StoredItem {
  row: LocationItemRow
  item?: ItemWithRelations
  lotTracked: boolean
  /** undefined while loading (lot-tracked items only) */
  lots?: LotHere[]
}

interface LocationItemsProps {
  rows: StoredItem[]
  onAdjust: (row: LocationItemRow) => void
  onRemove: (row: LocationItemRow) => void
}

const itemHref = (id: string) => `/dashboard/items/${id}`

function LotsCell({ stored, compact = false }: { stored: StoredItem; compact?: boolean }) {
  if (!stored.lotTracked) return compact ? null : <span className="text-muted-foreground">—</span>
  if (!stored.lots) return <Skeleton className="h-5 w-20 rounded-full" />
  if (stored.lots.length === 0) return compact ? null : <span className="text-muted-foreground">—</span>

  const max = compact ? 1 : 2
  const shown = stored.lots.slice(0, max)
  const hidden = stored.lots.length - shown.length
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((lot) => (
        <Badge key={lot.id} variant="outline" asChild className="relative z-10 max-w-full font-mono font-normal">
          <Link
            href={`/dashboard/items/${stored.row.id}/lot/${lot.id}`}
            title={
              lot.expirationDate
                ? `${lot.lotNumber} · ${formatNumber(lot.quantity)} here · expires ${formatDate(lot.expirationDate)}`
                : `${lot.lotNumber} · ${formatNumber(lot.quantity)} here`
            }
          >
            <span className="truncate">{lot.lotNumber}</span>
            <span className="text-muted-foreground tabular-nums">×{formatNumber(lot.quantity)}</span>
          </Link>
        </Badge>
      ))}
      {hidden > 0 && <span className="text-xs text-muted-foreground">+{hidden} more</span>}
    </div>
  )
}

function RowMenu({ stored, onAdjust, onRemove, includeAdjust }: { stored: StoredItem; includeAdjust: boolean } & Omit<LocationItemsProps, "rows">) {
  const { row } = stored
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative z-10 size-10 shrink-0 text-muted-foreground md:size-9"
          aria-label={`Actions for ${row.name}`}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={itemHref(row.id)}>
            <Eye /> View item
          </Link>
        </DropdownMenuItem>
        {includeAdjust && (
          <DropdownMenuItem onSelect={() => onAdjust(row)}>
            <ArrowDownUp /> Adjust stock
          </DropdownMenuItem>
        )}
        {row.quantity > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onRemove(row)}
              data-testid={`remove-from-location-${row.id}`}
            >
              <MinusCircle /> Remove from location
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Desktop table of items stored at a location */
export function LocationItemsTable({ rows, onAdjust, onRemove }: LocationItemsProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Item</TableHead>
            <TableHead>Lot</TableHead>
            <TableHead className="text-right">Qty here</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-px pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((stored) => {
            const { row } = stored
            const empty = row.quantity <= 0
            return (
              <TableRow key={row.id} data-testid={`location-item-row-${row.id}`}>
                <TableCell className="py-2.5 pl-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <ItemThumbnail itemId={row.id} alt={row.name} />
                    <div className="min-w-0">
                      <Link
                        href={itemHref(row.id)}
                        className="block max-w-[22rem] truncate font-medium hover:text-primary hover:underline"
                      >
                        {row.name}
                      </Link>
                      <p className="truncate font-mono text-xs text-muted-foreground">{row.itemNumber}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-[14rem]">
                  <LotsCell stored={stored} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className={cn("font-medium", empty && "font-normal text-muted-foreground")}>
                    {formatQuantity(row.quantity, row.unit)}
                  </span>
                  {empty && <p className="text-xs text-muted-foreground">Assigned, no stock</p>}
                </TableCell>
                <TableCell>
                  <StockStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="pr-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAdjust(row)}
                      data-testid={`location-item-adjust-${row.id}`}
                    >
                      <ArrowDownUp /> Adjust
                    </Button>
                    <RowMenu stored={stored} onAdjust={onAdjust} onRemove={onRemove} includeAdjust={false} />
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

/** Phone list of items stored at a location */
export function LocationItemsList({ rows, onAdjust, onRemove }: LocationItemsProps) {
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-label="Items stored here">
      {rows.map((stored) => {
        const { row } = stored
        const empty = row.quantity <= 0
        return (
          <li key={row.id} className="relative flex items-start gap-3 p-3" data-testid={`location-item-row-${row.id}`}>
            <ItemThumbnail itemId={row.id} alt={row.name} className="size-12" />
            <div className="min-w-0 flex-1 space-y-1">
              <Link
                href={itemHref(row.id)}
                className="block truncate font-medium leading-tight outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
              >
                {row.name}
              </Link>
              <p className="truncate font-mono text-xs text-muted-foreground">{row.itemNumber}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn("text-sm font-semibold tabular-nums", empty && "font-normal text-muted-foreground")}>
                  {formatQuantity(row.quantity, row.unit)}
                </span>
                <StockStatusBadge status={row.status} />
                <LotsCell stored={stored} compact />
              </div>
            </div>
            <RowMenu stored={stored} onAdjust={onAdjust} onRemove={onRemove} includeAdjust />
          </li>
        )
      })}
    </ul>
  )
}
