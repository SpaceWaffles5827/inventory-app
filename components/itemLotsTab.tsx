"use client"

import Link from "next/link"
import { ChevronRight, PackageCheck, PackagePlus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/common/empty-state"
import { SectionHeader } from "@/components/common/page"
import { ListSkeleton } from "@/components/common/states"
import { LotStatusBadge } from "@/components/common/status-badge"
import { daysUntil, formatDateOnly, getExpiry, testIdSlug } from "@/components/items/item-utils"
import { isHiddenLot, lotDisplayName } from "@/components/items/items-data"
import type { LotWithRelations } from "@/lib/api/lots.api"
import { formatNumber } from "@/lib/format"

interface ItemLotsTabProps {
  itemId: string
  lots: LotWithRelations[]
  loading?: boolean
  itemUnit?: string | null
  onCreateLot: () => void
}

const STATUS_ORDER: Record<string, number> = { ACTIVE: 0, QUARANTINED: 1, RECALLED: 2, EXPIRED: 3, DEPLETED: 4 }

/** Active lots first, soonest expiry first; then everything else, newest received first */
function sortLots(lots: LotWithRelations[]) {
  return [...lots].sort((a, b) => {
    const status = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
    if (status !== 0) return status
    if (a.expirationDate && b.expirationDate) return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
    if (a.expirationDate) return -1
    if (b.expirationDate) return 1
    return new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime()
  })
}

const EXPIRY_VARIANT = { danger: "danger", warning: "warning", default: "muted" } as const

/** Lots / batches of a lot-tracked item */
export function ItemLotsTab({ itemId, lots: allLots, loading = false, itemUnit, onCreateLot }: ItemLotsTabProps) {
  const lots = allLots.filter((l) => !isHiddenLot(l))
  const activeCount = lots.filter((l) => l.status === "ACTIVE").length

  return (
    <div className="overflow-hidden rounded-xl border bg-card" data-testid="item-lots-tab">
      <SectionHeader
        className="border-b px-4 py-3"
        title="Lots"
        description={lots.length > 0 ? `${activeCount} active of ${lots.length}` : "Track batches with their own dates and quantities"}
        actions={
          <Button size="sm" onClick={onCreateLot} data-testid="item-create-lot-button">
            <PackagePlus /> Receive lot
          </Button>
        }
      />

      {loading && lots.length === 0 ? (
        <ListSkeleton rows={3} className="rounded-none border-0" />
      ) : lots.length === 0 ? (
        <EmptyState
          bare
          icon={PackageCheck}
          title="No lots yet"
          description="Receive a lot to record its lot number, expiry date and where it's stored."
        />
      ) : (
        <ul className="divide-y">
          {sortLots(lots).map((lot) => {
            const expiry = lot.status === "ACTIVE" ? getExpiry(lot.expirationDate) : null
            const remaining = lot.initialQuantity > 0 ? Math.min(100, Math.round((lot.quantity / lot.initialQuantity) * 100)) : 0
            const stocked = lot.locations.filter((l) => l.quantity > 0)
            return (
              <li key={lot.id}>
                <Link
                  href={`/dashboard/items/${itemId}/lot/${lot.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  data-testid={`item-lot-row-${testIdSlug(lot.lotNumber)}`}
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-1 truncate font-mono text-sm font-medium">{lotDisplayName(lot.lotNumber)}</span>
                      <LotStatusBadge status={lot.status} />
                      {expiry && expiry.tone !== "default" && <Badge variant={EXPIRY_VARIANT[expiry.tone]}>{expiry.label}</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Received {formatDateOnly(lot.receivedDate)}</span>
                      {lot.expirationDate && (
                        <span>
                          {(daysUntil(lot.expirationDate) ?? 0) < 0 ? "Expired" : "Expires"} {formatDateOnly(lot.expirationDate)}
                        </span>
                      )}
                      {lot.supplier && <span className="truncate">{lot.supplier.name}</span>}
                    </div>
                    {stocked.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {stocked.map((l) => (
                          <span key={l.id} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {l.locationCode ?? l.location?.code}: {formatNumber(l.quantity)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="w-24 shrink-0 space-y-1 text-right">
                    <p className="tabular-nums">
                      <span className="font-semibold">{formatNumber(lot.quantity)}</span>
                      {itemUnit && <span className="ml-1 text-xs text-muted-foreground">{itemUnit}</span>}
                    </p>
                    <div className="ml-auto h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${remaining}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {remaining}% of {formatNumber(lot.initialQuantity)}
                    </p>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
