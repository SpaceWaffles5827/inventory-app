"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarClock,
  CalendarDays,
  Diff,
  History,
  Info,
  MapPin,
  PackageX,
  Pencil,
  Plus,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageContainer, PageHeader, SectionHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, PageSkeleton } from "@/components/common/states"
import { LotStatusBadge } from "@/components/common/status-badge"
import { AddLocationToLotDialog } from "@/components/addLocationToLotDialog"
import { AdjustLocationDialog } from "@/components/adjustlocationdialog"
import { EditLotDialog } from "@/components/items/edit-lot-dialog"
import { TransactionList } from "@/components/items/transaction-list"
import { formatDateOnly, getExpiry, testIdSlug } from "@/components/items/item-utils"
import { EXISTING_STOCK_LOT_NUMBER, lotDisplayName } from "@/components/items/items-data"
import { STOCK_CHANGED_EVENT } from "@/components/stock/stock-utils"
import { getLotByIdApi, type LotWithDetails } from "@/lib/api/lots.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import type { TransactionEntry } from "@/lib/api/transactions.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatDateTime, formatNumber, formatQuantity, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

type NoticeTone = "info" | "warning" | "danger"

const NOTICE_STYLE: Record<NoticeTone, { box: string; icon: string }> = {
  info: { box: "border-info/30 bg-info/10", icon: "text-info" },
  warning: { box: "border-warning/40 bg-warning/10", icon: "text-warning-foreground dark:text-warning" },
  danger: { box: "border-destructive/30 bg-destructive/5", icon: "text-destructive" },
}

function Notice({ tone, icon: Icon, children }: { tone: NoticeTone; icon: LucideIcon; children: ReactNode }) {
  const style = NOTICE_STYLE[tone]
  return (
    <div className={cn("flex gap-3 rounded-xl border px-4 py-3 text-sm", style.box)} role={tone === "info" ? undefined : "alert"}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.icon)} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Detail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

const EXPIRY_TONE = { danger: "danger", warning: "warning", default: "default" } as const

export default function LotDetailPage() {
  const { id: itemId, lotId } = useParams<{ id: string; lotId: string }>()
  const { workspaceId } = useWorkspace()

  const [lot, setLot] = useState<LotWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null)
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [dialog, setDialog] = useState<"edit" | "add-location" | null>(null)
  const [adjusting, setAdjusting] = useState<{
    open: boolean
    location: { locationId: string; locationCode: string; currentQuantity: number } | null
  }>({ open: false, location: null })

  const loadLot = useCallback(async () => {
    try {
      const res = await getLotByIdApi(lotId)
      const data = res.data?.lot as LotWithDetails | undefined
      if (!data) throw new ApiError("Lot not found", 404)
      setLot(data)
      setError(null)
    } catch (err) {
      setError({
        message: getErrorMessage(err, "Couldn't load this lot"),
        notFound: err instanceof ApiError && (err.status === 404 || err.status === 403),
      })
    } finally {
      setLoading(false)
    }
  }, [lotId])

  useEffect(() => {
    loadLot()
  }, [loadLot])

  // Stock moved elsewhere (e.g. the global scanner) — refresh quietly
  useEffect(() => {
    const onStockChanged = () => loadLot()
    window.addEventListener(STOCK_CHANGED_EVENT, onStockChanged)
    return () => window.removeEventListener(STOCK_CHANGED_EVENT, onStockChanged)
  }, [loadLot])

  useEffect(() => {
    let cancelled = false
    getLocationsApi(workspaceId)
      .then((res) => {
        if (!cancelled) setLocations(res.data?.locations ?? [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  const transactions = useMemo<TransactionEntry[]>(() => {
    if (!lot) return []
    const codes = new Map<string, string>(locations.map((l) => [l.id, l.code]))
    for (const l of lot.locations) codes.set(l.locationId, l.locationCode ?? l.location?.code)
    const ref = (id: string | null) => (id ? { id, code: codes.get(id) ?? "Unknown" } : null)
    return (lot.transactions ?? []).map((tx) => ({
      id: tx.id,
      type: tx.type,
      quantity: tx.quantity,
      reason: tx.reason,
      previousStock: tx.previousStock,
      newStock: tx.newStock,
      createdAt: new Date(tx.createdAt).toISOString(),
      item: null,
      lot: { id: lot.id, lotNumber: lot.lotNumber },
      fromLocation: ref(tx.fromLocationId),
      toLocation: ref(tx.toLocationId),
      user: tx.user ? { id: tx.user.id, name: tx.user.name ?? tx.user.email } : null,
    }))
  }, [lot, locations])

  const itemHref = `/dashboard/items/${itemId}?tab=lots`

  if (loading) return <PageSkeleton stats={4} />

  if (!lot) {
    return (
      <PageContainer>
        {error?.notFound ? (
          <EmptyState
            icon={PackageX}
            title="Lot not found"
            description="It may have been removed, or it belongs to another workspace."
            action={
              <Button asChild>
                <Link href={itemHref}>
                  <ArrowLeft /> Back to item
                </Link>
              </Button>
            }
          />
        ) : (
          <ErrorState
            title="Couldn't load this lot"
            message={error?.message}
            onRetry={() => {
              setLoading(true)
              loadLot()
            }}
          />
        )}
      </PageContainer>
    )
  }

  const unit = lot.item?.unit
  const isPreExisting = lot.isSystem || lot.lotNumber === EXISTING_STOCK_LOT_NUMBER
  const expiry = getExpiry(lot.expirationDate)
  const showExpiryWarning = lot.status === "ACTIVE" && expiry !== null && expiry.tone !== "default"
  const remaining = lot.initialQuantity > 0 ? Math.round((lot.quantity / lot.initialQuantity) * 100) : 0
  const lotLocations = [...lot.locations].sort((a, b) => b.quantity - a.quantity)
  const stockedCount = lotLocations.filter((l) => l.quantity > 0).length
  const availableLocations = locations.filter((loc) => !lot.locations.some((l) => l.locationId === loc.id))

  return (
    <PageContainer>
      <PageHeader
        back={{ href: itemHref, label: lot.item?.name ?? "Back to item" }}
        title={isPreExisting ? lotDisplayName(lot.lotNumber) : <span className="font-mono">{lot.lotNumber}</span>}
        description={
          <>
            Lot of{" "}
            <Link href={itemHref} className="font-medium text-foreground hover:underline">
              {lot.item?.name ?? "item"}
            </Link>
            {lot.item?.itemNumber && <span className="ml-1.5 font-mono text-sm">{lot.item.itemNumber}</span>}
          </>
        }
        meta={
          <>
            <LotStatusBadge status={lot.status} />
            {showExpiryWarning && <Badge variant={expiry.tone === "danger" ? "danger" : "warning"}>{expiry.label}</Badge>}
            {isPreExisting && <Badge variant="info">Pre-existing stock</Badge>}
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setDialog("add-location")}
              disabled={availableLocations.length === 0}
              data-testid="lot-add-location-button"
            >
              <Plus /> Add to location
            </Button>
            <Button variant="outline" onClick={() => setDialog("edit")} data-testid="lot-edit-button">
              <Pencil /> Edit lot
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {(isPreExisting || showExpiryWarning || lot.status === "QUARANTINED" || lot.status === "RECALLED") && (
          <div className="space-y-3">
            {lot.status === "RECALLED" && (
              <Notice tone="danger" icon={ShieldAlert}>
                <span className="font-medium">This lot has been recalled.</span> Don&apos;t ship or use it.
              </Notice>
            )}
            {lot.status === "QUARANTINED" && (
              <Notice tone="warning" icon={ShieldAlert}>
                <span className="font-medium">This lot is quarantined.</span> Hold it until it passes inspection.
              </Notice>
            )}
            {showExpiryWarning && (
              <Notice tone={expiry.tone === "danger" ? "danger" : "warning"} icon={AlertTriangle}>
                <span className="font-medium">{expiry.label}</span> ({formatDateOnly(lot.expirationDate)}).{" "}
                {expiry.tone === "danger" ? "Consider marking it as expired." : "Use this lot first."}
              </Notice>
            )}
            {isPreExisting && (
              <Notice tone="info" icon={Info}>
                This lot holds the stock that existed before lot tracking was turned on. Adjust and transfer it like any other lot.
              </Notice>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Quantity"
            icon={Boxes}
            tone={lot.quantity > 0 ? "primary" : "default"}
            value={
              <>
                {formatNumber(lot.quantity)}
                {unit && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{unit}</span>}
              </>
            }
            hint={`${remaining}% of ${formatNumber(lot.initialQuantity)} received`}
          />
          <StatCard
            label="Locations"
            icon={MapPin}
            value={formatNumber(stockedCount)}
            hint={stockedCount === 0 ? "Not stored anywhere" : stockedCount === 1 ? `In ${lotLocations[0].locationCode}` : `Most in ${lotLocations[0].locationCode}`}
          />
          <StatCard
            label={expiry && expiry.days < 0 ? "Expired" : "Expires"}
            icon={CalendarClock}
            tone={expiry ? EXPIRY_TONE[expiry.tone] : "default"}
            value={<span className="text-xl sm:text-2xl">{lot.expirationDate ? formatDateOnly(lot.expirationDate) : "No expiry"}</span>}
            hint={expiry ? expiry.label : "No expiration date set"}
          />
          <StatCard
            label="Received"
            icon={CalendarDays}
            value={<span className="text-xl sm:text-2xl">{formatDateOnly(lot.receivedDate)}</span>}
            hint={lot.supplier ? `From ${lot.supplier.name}` : lot.creator?.name ? `By ${lot.creator.name}` : undefined}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3 lg:items-start lg:gap-6">
          <section className="overflow-hidden rounded-xl border bg-card lg:col-span-2">
            <SectionHeader
              className="border-b px-4 py-3"
              title="Locations"
              description={
                lotLocations.length > 0
                  ? `${formatQuantity(lot.quantity, unit)} across ${stockedCount} ${stockedCount === 1 ? "location" : "locations"}`
                  : "Where this lot is stored"
              }
            />
            {lotLocations.length === 0 ? (
              <EmptyState
                bare
                icon={MapPin}
                title="Not stored anywhere"
                description="Add this lot to a location to record where it's kept."
                action={
                  availableLocations.length > 0 && (
                    <Button onClick={() => setDialog("add-location")}>
                      <Plus /> Add to location
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="divide-y">
                {lotLocations.map((l) => {
                  const code = l.locationCode ?? l.location?.code ?? "Unknown"
                  const share = lot.quantity > 0 ? Math.round((l.quantity / lot.quantity) * 100) : 0
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-4 py-3" data-testid={`lot-location-row-${testIdSlug(code)}`}>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <MapPin className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Link href={`/dashboard/locations/${l.locationId}`} className="block truncate font-mono text-sm font-medium hover:underline">
                          {code}
                        </Link>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-muted" aria-hidden>
                            <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">{l.quantity === 0 ? "Empty" : `${share}%`}</span>
                        </div>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <span className="text-lg font-semibold" data-testid="lot-location-quantity">
                          {formatNumber(l.quantity)}
                        </span>
                        {unit && <span className="ml-1 text-xs text-muted-foreground">{unit}</span>}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() =>
                          setAdjusting({
                            open: true,
                            location: { locationId: l.locationId, locationCode: code, currentQuantity: l.quantity },
                          })
                        }
                        aria-label={`Adjust stock in ${code}`}
                      >
                        <Diff />
                        <span className="hidden sm:inline">Adjust</span>
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card">
            <SectionHeader className="border-b px-4 py-3" title="Details" />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-5 p-4">
              <Detail label="Lot number">
                <span className="break-all font-mono">{lot.lotNumber}</span>
              </Detail>
              <Detail label="Status">
                <LotStatusBadge status={lot.status} />
              </Detail>
              <Detail label="Received">{formatDateOnly(lot.receivedDate)}</Detail>
              <Detail label="Manufactured">{formatDateOnly(lot.manufactureDate)}</Detail>
              <Detail label="Expires">{formatDateOnly(lot.expirationDate)}</Detail>
              <Detail label="Supplier">{lot.supplier?.name ?? <span className="text-muted-foreground">—</span>}</Detail>
              <Detail label="PO number">
                {lot.poNumber ? <span className="break-all font-mono">{lot.poNumber}</span> : <span className="text-muted-foreground">—</span>}
              </Detail>
              <Detail label="Created">
                <span title={formatDateTime(lot.createdAt)}>{formatRelativeTime(lot.createdAt)}</span>
                <span className="block text-xs text-muted-foreground">{lot.creator?.name ?? "Unknown user"}</span>
              </Detail>
              <Detail label="Notes" className="col-span-full">
                {lot.notes ? <p className="whitespace-pre-line leading-relaxed">{lot.notes}</p> : <span className="text-muted-foreground">No notes</span>}
              </Detail>
            </dl>
          </section>
        </div>

        <section className="overflow-hidden rounded-xl border bg-card">
          <SectionHeader className="border-b px-4 py-3" title="Movements" description="Every change to this lot, newest first" />
          {transactions.length === 0 ? (
            <EmptyState bare icon={History} title="No movements yet" description="Adjustments and transfers of this lot will show up here." />
          ) : (
            <TransactionList transactions={transactions} unit={unit} />
          )}
        </section>
      </div>

      <EditLotDialog open={dialog === "edit"} onOpenChange={(open) => !open && setDialog(null)} lot={lot} onSaved={loadLot} />

      <AddLocationToLotDialog
        open={dialog === "add-location"}
        onOpenChange={(open) => !open && setDialog(null)}
        lotId={lot.id}
        availableLocations={availableLocations}
        unit={unit}
        onSuccess={loadLot}
      />

      <AdjustLocationDialog
        open={adjusting.open}
        onOpenChange={(open) => setAdjusting((s) => ({ ...s, open }))}
        lotId={lot.id}
        adjustingLocation={adjusting.location}
        unit={unit}
        onSuccess={loadLot}
      />
    </PageContainer>
  )
}
