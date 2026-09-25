"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowDownUp,
  Banknote,
  Boxes,
  Gauge,
  History,
  Layers,
  MapPin,
  MoreHorizontal,
  Package,
  PackageOpen,
  Pencil,
  Printer,
  ScanLine,
  SearchX,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageContainer, PageHeader, SectionHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { Pagination, usePagination } from "@/components/common/pagination"
import { useConfirm } from "@/components/common/confirm-provider"
import { StockAdjustmentWizard, type StockAdjustmentWizardProps } from "@/components/stockAdjustmentWizard"
import { RemoveFromLocationDialog } from "@/components/removeFromLocationDialog"
import { BarcodeScannerDialog } from "@/components/barcodeScannerDialog"
import { LocationLabelGenerator } from "@/components/locationLabelGenerator"
import { EditLocationDialog } from "@/components/editLocationDilog"
import { StructureEditorDialog } from "@/components/structureEditorDialog"
import { ItemPickerDialog } from "@/components/locations/item-picker-dialog"
import { LocationDetailSkeleton } from "@/components/locations/location-detail-skeleton"
import {
  LocationItemsList,
  LocationItemsTable,
  type LotHere,
  type StoredItem,
} from "@/components/locations/location-items"
import { CopyButton, StructureChips } from "@/components/locations/location-ui"
import { stockValueAt, utilisationTone, type LocationDetail, type LocationItemRow } from "@/components/locations/types"
import {
  barcodeForCodeChange,
  composeLocationCode,
  parseLocationStructure,
  type StructurePart,
} from "@/components/locations/structure"
import {
  deleteLocationApi,
  getLocationByIdApi,
  updateLocationApi,
  type LocationWithCount,
  type UpdateLocationRequest,
} from "@/lib/api/locations.api"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { getLotsByItemApi } from "@/lib/api/lots.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"
import { formatCurrencyCompact, formatDate, formatNumber, formatRelativeTime } from "@/lib/format"
import { useWorkspace } from "@/lib/workspace-context"

interface PageData {
  location?: LocationDetail
  notFound?: boolean
  error?: string
  items?: ItemWithRelations[]
  itemsError?: string
}

/** Location (with its item rows) plus the workspace items (cost, lots, full item for the wizard) */
async function fetchPageData(locationId: string, workspaceId: string): Promise<PageData> {
  const [locationRes, itemsRes] = await Promise.allSettled([
    getLocationByIdApi(locationId, workspaceId),
    getItemsApi(workspaceId),
  ])
  const result: PageData = {}

  if (locationRes.status === "fulfilled") {
    const data = locationRes.value.data?.location
    if (data) result.location = data as LocationDetail
    else result.notFound = true
  } else if (locationRes.reason instanceof ApiError && locationRes.reason.status === 404) {
    result.notFound = true
  } else {
    result.error = getErrorMessage(locationRes.reason, "Couldn't load this location")
  }

  if (itemsRes.status === "fulfilled") result.items = itemsRes.value.data?.items ?? []
  else result.itemsError = getErrorMessage(itemsRes.reason, "Couldn't load items")

  return result
}

const ITEMS_PAGE_SIZE = 25

export default function LocationDetailPage() {
  const params = useParams<{ id: string }>()
  const locationId = params.id
  const router = useRouter()
  const confirm = useConfirm()
  const { workspaceId, isAdmin } = useWorkspace()

  const [location, setLocation] = useState<LocationDetail | null>(null)
  const [items, setItems] = useState<ItemWithRelations[] | null>(null)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [lotsByItem, setLotsByItem] = useState<Record<string, LotHere[]>>({})
  const [refreshCount, setRefreshCount] = useState(0)

  const [itemQuery, setItemQuery] = useState("")
  const [editOpen, setEditOpen] = useState(false)
  const [levelsOpen, setLevelsOpen] = useState(false)
  const [labelOpen, setLabelOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<StockAdjustmentWizardProps["item"]>(null)
  const [removeRow, setRemoveRow] = useState<LocationItemRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const apply = useCallback((result: PageData) => {
    if (result.location) {
      setLocation(result.location)
      setNotFound(false)
      setError(null)
    } else if (result.notFound) {
      setNotFound(true)
    } else if (result.error) {
      setError(result.error)
    }
    if (result.items) {
      setItems(result.items)
      setItemsError(null)
    } else if (result.itemsError) {
      setItemsError(result.itemsError)
    }
    setRefreshCount((n) => n + 1)
    setLoading(false)
  }, [])

  /** Refetch after a mutation (keeps the current data on screen meanwhile) */
  const load = useCallback(
    () => fetchPageData(locationId, workspaceId).then(apply),
    [locationId, workspaceId, apply]
  )

  useEffect(() => {
    let cancelled = false
    fetchPageData(locationId, workspaceId).then((result) => {
      if (!cancelled) apply(result)
    })
    return () => {
      cancelled = true
    }
  }, [locationId, workspaceId, apply])

  const itemsById = useMemo(() => new Map((items ?? []).map((item) => [item.id, item])), [items])

  // Lot numbers per lot-tracked item stored here (one request per item, only when needed)
  const lotItemIds = useMemo(() => {
    if (!location || !items) return ""
    return location.items
      .filter((row) => row.quantity > 0 && itemsById.get(row.id)?.lotTracking)
      .map((row) => row.id)
      .join(",")
  }, [location, items, itemsById])

  useEffect(() => {
    if (!lotItemIds) return
    let cancelled = false
    const ids = lotItemIds.split(",")
    Promise.allSettled(ids.map((id) => getLotsByItemApi(id))).then((results) => {
      if (cancelled) return
      const next: Record<string, LotHere[]> = {}
      results.forEach((result, i) => {
        if (result.status !== "fulfilled") {
          next[ids[i]] = [] // show "—" rather than a spinner forever
          return
        }
        next[ids[i]] = (result.value.data?.lots ?? []).flatMap((lot) => {
          const here = lot.locations.find((l) => l.locationId === locationId)
          return here && here.quantity > 0 && lot.lotNumber !== "SYSTEM"
            ? [{ id: lot.id, lotNumber: lot.lotNumber, quantity: here.quantity, expirationDate: lot.expirationDate }]
            : []
        })
      })
      setLotsByItem(next)
    })
    return () => {
      cancelled = true
    }
  }, [lotItemIds, locationId, refreshCount])

  const structure = useMemo(() => parseLocationStructure(location?.structure), [location])

  const storedItems = useMemo<StoredItem[]>(() => {
    if (!location) return []
    return [...location.items]
      .sort((a, b) => Number(b.quantity > 0) - Number(a.quantity > 0) || a.name.localeCompare(b.name))
      .map((row) => {
        const item = itemsById.get(row.id)
        const lotTracked = Boolean(item?.lotTracking)
        return {
          row,
          item,
          lotTracked,
          lots: lotTracked ? (lotsByItem[row.id] ?? (row.quantity > 0 ? undefined : [])) : undefined,
        }
      })
  }, [location, itemsById, lotsByItem])

  const q = itemQuery.trim().toLowerCase()
  const visibleItems = q
    ? storedItems.filter(
        ({ row }) => row.name.toLowerCase().includes(q) || row.itemNumber.toLowerCase().includes(q)
      )
    : storedItems
  const itemsPagination = usePagination(visibleItems, ITEMS_PAGE_SIZE, q)

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  // The wizard loads current stock itself; the location row is enough when the items list is unavailable
  const openAdjust = (row: LocationItemRow) => {
    setAdjustItem(
      itemsById.get(row.id) ?? { id: row.id, name: row.name, itemNumber: row.itemNumber, unit: row.unit, status: row.status }
    )
  }

  const handleScanned = (scanned: string) => {
    const code = scanned.trim().toLowerCase()
    if (!code) return
    if (!items) {
      toast.error("Items are still loading — try scanning again in a moment")
      return
    }
    const match = items.find(
      (item) => item.barcode?.toLowerCase() === code || item.itemNumber.toLowerCase() === code
    )
    if (match) {
      setAdjustItem(match)
      return
    }
    if (location && (location.barcode?.toLowerCase() === code || location.code.toLowerCase() === code)) {
      toast.info("That's this location's label", { description: "Scan an item's barcode to adjust its stock here." })
      return
    }
    toast.error(`No item matches “${scanned.trim()}”`, {
      description: "Check the barcode, or pick the item from the list instead.",
      action: { label: "Pick item", onClick: () => setPickerOpen(true) },
    })
  }

  const handleEdited = (updated: LocationWithCount) => {
    setLocation((prev) => (prev ? { ...prev, ...updated, items: prev.items, totalUnits: prev.totalUnits } : prev))
  }

  const saveLevels = async (next: StructurePart[]) => {
    if (!location) return
    const code = composeLocationCode(next.map((part) => part.value))
    const payload: UpdateLocationRequest = { workspaceId, code, structure: next }
    const barcode = barcodeForCodeChange(location.barcode, location.code, code)
    if (barcode !== undefined) payload.barcode = barcode
    try {
      await updateLocationApi(location.id, payload)
      toast.success(code !== location.code ? `Code changed to ${code}` : "Levels updated")
      await load()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't update the levels"))
      throw err
    }
  }

  const units = location ? (location.totalUnits ?? location.items.reduce((sum, r) => sum + r.quantity, 0)) : 0

  const handleDelete = async () => {
    if (!location) return
    if (units > 0) {
      toast.error(`${location.code} still holds stock`, {
        description: `Move or remove its ${formatNumber(units)} units before deleting it.`,
      })
      return
    }
    const ok = await confirm({
      title: `Delete location ${location.code}?`,
      description:
        "This permanently removes the location and any printed labels for it will stop scanning. Locations that still hold stock can't be deleted.",
      confirmLabel: "Delete location",
      destructive: true,
    })
    if (!ok) return
    setDeleting(true)
    try {
      await deleteLocationApi(location.id, workspaceId)
      toast.success(`Location ${location.code} deleted`)
      router.push("/dashboard/locations")
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete the location"))
      setDeleting(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) return <LocationDetailSkeleton />

  if (notFound || (!location && !error)) {
    return (
      <PageContainer>
        <PageHeader back={{ href: "/dashboard/locations", label: "All locations" }} title="Location not found" />
        <EmptyState
          icon={MapPin}
          title="This location doesn't exist"
          description="It may have been deleted, or it belongs to a different workspace."
          action={
            <Button asChild>
              <Link href="/dashboard/locations">View all locations</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  if (!location) {
    return (
      <PageContainer>
        <PageHeader back={{ href: "/dashboard/locations", label: "All locations" }} title="Location" />
        <ErrorState
          title="Couldn't load this location"
          message={error ?? undefined}
          onRetry={() => {
            setLoading(true)
            load()
          }}
        />
      </PageContainer>
    )
  }

  const skus = location.items.filter((r) => r.quantity > 0).length
  const value = items ? stockValueAt(items, location.id) : null
  const ratio = location.capacity > 0 ? units / location.capacity : null
  const capacityTone = utilisationTone(ratio)

  return (
    <PageContainer>
      <PageHeader
        back={{ href: "/dashboard/locations", label: "All locations" }}
        title={
          <span className="flex min-w-0 items-center gap-1">
            <span className="break-all font-mono">{location.code}</span>
            <CopyButton value={location.code} label="Copy location code" />
          </span>
        }
        description={location.description || undefined}
        meta={structure.length > 0 ? <StructureChips structure={structure} /> : undefined}
        actions={
          <>
            <Button onClick={() => setPickerOpen(true)} data-testid="location-adjust-stock-button">
              <ArrowDownUp /> Adjust stock
            </Button>
            <Button
              variant="outline"
              onClick={() => setLabelOpen(true)}
              aria-label="Print label"
              data-testid="location-print-label-button"
            >
              <Printer />
              <span className="hidden sm:inline">Print label</span>
            </Button>
            <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="location-edit-button">
              <Pencil /> Edit
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="More actions" disabled={deleting}>
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/activity?locationId=${location.id}`}>
                    <History /> Stock activity
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setScanOpen(true)}>
                  <ScanLine /> Scan item to adjust
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuItem onSelect={() => setLevelsOpen(true)} data-testid="location-edit-levels">
                      <Layers /> Edit levels
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={handleDelete} data-testid="location-delete-button">
                      <Trash2 /> Delete location
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Items stored"
            value={formatNumber(skus)}
            icon={Package}
            tone="primary"
            hint={
              location.items.length > skus
                ? `${formatNumber(location.items.length - skus)} more assigned with no stock`
                : "Different items with stock here"
            }
          />
          <StatCard label="Total units" value={formatNumber(units)} icon={Boxes} tone="info" hint="Across all lots" />
          <StatCard
            label="Stock value"
            value={
              value !== null ? formatCurrencyCompact(value) : itemsError ? "—" : <Skeleton className="h-8 w-20" />
            }
            icon={Banknote}
            tone="success"
            hint="At item cost"
          />
          <StatCard
            label="Capacity used"
            value={ratio === null ? "—" : `${Math.round(ratio * 100)}%`}
            icon={Gauge}
            tone={capacityTone === "danger" ? "danger" : capacityTone === "warning" ? "warning" : "default"}
            hint={
              ratio === null
                ? "No capacity set"
                : ratio > 1
                  ? `Over capacity by ${formatNumber(units - location.capacity)} units`
                  : `${formatNumber(units)} of ${formatNumber(location.capacity)} units`
            }
          />
        </div>

        <section className="space-y-3" aria-labelledby="stored-items-heading">
          <SectionHeader
            title={<span id="stored-items-heading">Items stored here</span>}
            description={
              location.items.length > 0
                ? `${formatNumber(skus)} ${skus === 1 ? "item" : "items"} · ${formatNumber(units)} units`
                : undefined
            }
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScanOpen(true)}
                className="h-9"
                data-testid="location-scan-item-button"
              >
                <ScanLine /> Scan to add
              </Button>
            }
          />

          {storedItems.length > 6 && (
            <SearchInput
              value={itemQuery}
              onValueChange={setItemQuery}
              placeholder="Filter by name or item number…"
              aria-label="Filter items at this location"
              className="sm:max-w-sm"
            />
          )}

          {storedItems.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="Nothing stored here yet"
              description="Add stock to this location by picking an item, or scan an item's barcode."
              action={
                <>
                  <Button onClick={() => setPickerOpen(true)}>
                    <ArrowDownUp /> Adjust stock
                  </Button>
                  <Button variant="outline" onClick={() => setScanOpen(true)}>
                    <ScanLine /> Scan item
                  </Button>
                </>
              }
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No matching items"
              description={`Nothing here matches “${itemQuery.trim()}”.`}
              action={
                <Button variant="outline" onClick={() => setItemQuery("")}>
                  Clear filter
                </Button>
              }
            />
          ) : (
            <>
              <div className="md:hidden">
                <LocationItemsList rows={itemsPagination.pageRows} onAdjust={openAdjust} onRemove={setRemoveRow} />
              </div>
              <div className="hidden md:block">
                <LocationItemsTable rows={itemsPagination.pageRows} onAdjust={openAdjust} onRemove={setRemoveRow} />
              </div>
              <Pagination
                page={itemsPagination.page}
                pageSize={itemsPagination.pageSize}
                total={itemsPagination.total}
                onPageChange={itemsPagination.setPage}
                noun="items"
              />
            </>
          )}
          {itemsError && (
            <p className="text-xs text-muted-foreground">
              Some details (value, lots) are unavailable: {itemsError}
            </p>
          )}
        </section>

        <section className="rounded-xl border bg-card" aria-labelledby="location-details-heading">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <h2 id="location-details-heading" className="text-base font-semibold">
              Details
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/activity?locationId=${location.id}`}>
                <History /> Activity
              </Link>
            </Button>
          </div>
          <dl className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailItem label="Code">
              <span className="flex min-w-0 items-center gap-1">
                <span className="break-all font-mono">{location.code}</span>
                <CopyButton value={location.code} label="Copy location code" className="size-7" />
              </span>
            </DetailItem>
            <DetailItem label="Barcode">
              {location.barcode ? (
                <span className="flex min-w-0 items-center gap-1">
                  <span className="break-all font-mono">{location.barcode}</span>
                  <CopyButton value={location.barcode} label="Copy barcode" className="size-7" />
                </span>
              ) : (
                <span className="text-muted-foreground">None — labels encode the code</span>
              )}
            </DetailItem>
            <DetailItem label="Levels">
              <div className="flex flex-wrap items-center gap-2">
                {structure.length > 0 ? (
                  <StructureChips structure={structure} />
                ) : (
                  <span className="text-muted-foreground">No levels</span>
                )}
                {isAdmin && (
                  <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setLevelsOpen(true)}>
                    Edit
                  </Button>
                )}
              </div>
            </DetailItem>
            <DetailItem label="Capacity">
              <span className="tabular-nums">{formatNumber(location.capacity)} units</span>
            </DetailItem>
            <DetailItem label="Created">{formatDate(location.createdAt)}</DetailItem>
            <DetailItem label="Last updated">{formatRelativeTime(location.updatedAt)}</DetailItem>
          </dl>
        </section>
      </div>

      <ItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        items={items}
        error={itemsError}
        locationId={location.id}
        locationCode={location.code}
        onSelect={(item) => {
          setPickerOpen(false)
          setAdjustItem(item)
        }}
        onScan={() => {
          setPickerOpen(false)
          setScanOpen(true)
        }}
      />

      <BarcodeScannerDialog
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        currentBarcode=""
        onBarcodeScanned={handleScanned}
      />

      <StockAdjustmentWizard
        item={adjustItem}
        open={adjustItem !== null}
        onClose={() => setAdjustItem(null)}
        onSuccess={load}
        defaultLocationId={location.id}
      />

      <RemoveFromLocationDialog
        open={removeRow !== null}
        onOpenChange={(open) => !open && setRemoveRow(null)}
        item={removeRow}
        locationCode={location.code}
        locationId={location.id}
        onSuccess={load}
      />

      <LocationLabelGenerator open={labelOpen} onOpenChange={setLabelOpen} location={location} />

      <EditLocationDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={workspaceId}
        location={location}
        onSuccess={handleEdited}
      />

      {isAdmin && (
        <StructureEditorDialog
          open={levelsOpen}
          onOpenChange={setLevelsOpen}
          initialStructure={structure}
          onSave={saveLevels}
          currentCode={location.code}
        />
      )}
    </PageContainer>
  )
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}
