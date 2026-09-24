"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowUpDown,
  Boxes,
  Layers,
  Loader2,
  MapPin,
  PackageOpen,
  Pencil,
  Plus,
  Printer,
  SearchX,
  Settings2,
  Trash2,
  Warehouse,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PageContainer, PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton, StatsSkeleton } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { useConfirm } from "@/components/common/confirm-provider"
import { AddLocationDialog } from "@/components/addLocationDialog"
import { EditLocationDialog } from "@/components/editLocationDilog"
import { ConfigureStructureDialog } from "@/components/configureStructuredDialog"
import { LocationLabelGenerator } from "@/components/locationLabelGenerator"
import { LocationMobileView } from "@/components/locationMobileView"
import { UtilisationBar } from "@/components/locations/location-ui"
import {
  toLocationRow,
  type LocationListEntry,
  type LocationRow,
} from "@/components/locations/types"
import {
  compareCodes,
  formatStructurePath,
  parseLocationStructure,
  parseLocationTemplate,
} from "@/components/locations/structure"
import {
  deleteLocationApi,
  getLocationsApi,
  getWorkspaceStructureApi,
  type LocationTemplate,
  type LocationWithCount,
} from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatNumber } from "@/lib/format"
import { useWorkspace } from "@/lib/workspace-context"
import { cn } from "@/lib/utils"

type StockFilter = "all" | "in-use" | "empty"
type SortKey = "code" | "code-desc" | "units" | "fullest" | "newest"

const SORT_LABELS: Record<SortKey, string> = {
  code: "Code A–Z",
  "code-desc": "Code Z–A",
  units: "Most stock",
  fullest: "Fullest",
  newest: "Newest",
}

const time = (value: Date | string) => new Date(value).getTime()

/** "zone" → "zones", "shelf" → "shelves", "bay" → "bays", "box" → "boxes" */
function plural(word: string): string {
  const w = word.toLowerCase()
  if (/(s|x|z|ch|sh)$/.test(w)) return `${w}es`
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`
  if (/[^f]f$/.test(w)) return `${w.slice(0, -1)}ves`
  return `${w}s`
}

function sortRows(rows: LocationRow[], sort: SortKey): LocationRow[] {
  const byCode = (a: LocationRow, b: LocationRow) => compareCodes(a.location.code, b.location.code)
  const sorted = [...rows]
  switch (sort) {
    case "code-desc":
      return sorted.sort((a, b) => byCode(b, a))
    case "units":
      return sorted.sort((a, b) => (b.units ?? b.items) - (a.units ?? a.items) || byCode(a, b))
    case "fullest":
      return sorted.sort((a, b) => (b.utilisation ?? -1) - (a.utilisation ?? -1) || byCode(a, b))
    case "newest":
      return sorted.sort((a, b) => time(b.location.createdAt) - time(a.location.createdAt) || byCode(a, b))
    default:
      return sorted.sort(byCode)
  }
}

export default function LocationsPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const { workspaceId, isAdmin } = useWorkspace()

  const [locations, setLocations] = useState<LocationListEntry[]>([])
  const [template, setTemplate] = useState<LocationTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [stockFilter, setStockFilter] = useState<StockFilter>("all")
  const [sort, setSort] = useState<SortKey>("code")
  const [zone, setZone] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<LocationListEntry | null>(null)
  const [structureOpen, setStructureOpen] = useState(false)
  const [labelTargets, setLabelTargets] = useState<LocationListEntry[] | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [locationsRes, structureRes] = await Promise.allSettled([
        getLocationsApi(workspaceId),
        getWorkspaceStructureApi(workspaceId),
      ])
      if (locationsRes.status === "rejected") throw locationsRes.reason
      setLocations((locationsRes.value.data?.locations ?? []) as LocationListEntry[])
      if (structureRes.status === "fulfilled") setTemplate(parseLocationTemplate(structureRes.value.data?.structure))
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load locations"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(
    () => locations.map((location) => toLocationRow(location, parseLocationStructure(location.structure))),
    [locations]
  )
  const existingCodes = useMemo(() => locations.map((l) => l.code), [locations])

  // Group by the first structure level ("Zone A", "Zone B") when that actually groups things
  const zones = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of rows) {
      const value = row.structure[0]?.value
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => compareCodes(a[0], b[0]))
  }, [rows])
  const showZones = zones.length >= 2 && zones.length <= 40 && zones.length < rows.length
  const zoneLabel = template?.levels[0]?.label || rows.find((r) => r.structure[0]?.label)?.structure[0]?.label || "Zone"
  const activeZone = showZones && zone && zones.some(([z]) => z === zone) ? zone : null

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    const matches = rows.filter((row) => {
      if (activeZone && row.structure[0]?.value !== activeZone) return false
      if (stockFilter === "in-use" && !row.inUse) return false
      if (stockFilter === "empty" && row.inUse) return false
      if (!q) return true
      const { code, description, barcode } = row.location
      return (
        code.toLowerCase().includes(q) ||
        (description ?? "").toLowerCase().includes(q) ||
        (barcode ?? "").toLowerCase().includes(q)
      )
    })
    return sortRows(matches, sort)
  }, [rows, activeZone, stockFilter, q, sort])

  const stats = useMemo(() => {
    const inUse = rows.filter((r) => r.inUse).length
    const unitsKnown = rows.every((r) => r.units !== null)
    const units = rows.reduce((sum, r) => sum + (r.units ?? 0), 0)
    const capacity = rows.reduce((sum, r) => sum + (r.location.capacity ?? 0), 0)
    return { total: rows.length, inUse, empty: rows.length - inUse, units: unitsKnown ? units : null, capacity }
  }, [rows])

  const isFiltered = Boolean(q) || stockFilter !== "all" || activeZone !== null
  const clearFilters = () => {
    setQuery("")
    setStockFilter("all")
    setZone(null)
  }

  const handleCreated = (location: LocationWithCount) => {
    setLocations((prev) => [...prev, { ...location, totalUnits: 0 }])
  }

  const handleUpdated = (updated: LocationWithCount) => {
    setLocations((prev) => prev.map((l) => (l.id === updated.id ? { ...updated, totalUnits: l.totalUnits } : l)))
  }

  const handleDelete = async (row: LocationRow) => {
    const { location } = row
    if (row.units !== null && row.units > 0) {
      toast.error(`${location.code} still holds stock`, {
        description: `Move or remove its ${formatNumber(row.units)} units before deleting it.`,
        action: { label: "View", onClick: () => router.push(`/dashboard/locations/${location.id}`) },
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

    setDeletingId(location.id)
    try {
      await deleteLocationApi(location.id, workspaceId)
      setLocations((prev) => prev.filter((l) => l.id !== location.id))
      toast.success(`Location ${location.code} deleted`)
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't delete the location"))
    } finally {
      setDeletingId(null)
    }
  }

  const structurePath = template?.levels.map((l) => l.label).join(" › ")

  return (
    <PageContainer>
      <PageHeader
        title="Locations"
        description="Zones, shelves and bins where your stock lives. Print a label for each one and scan it to find what's inside."
        meta={
          structurePath ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Layers className="size-3.5" />
              Structure: <span className="font-medium text-foreground">{structurePath}</span>
            </span>
          ) : isAdmin && !loading ? (
            <span className="text-xs text-muted-foreground">
              No location structure yet —{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setStructureOpen(true)}
              >
                set one up
              </button>{" "}
              so every code follows the same pattern.
            </span>
          ) : undefined
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setLabelTargets(filtered.map((r) => r.location))}
              disabled={loading || filtered.length === 0}
              aria-label="Print labels"
              data-testid="print-location-labels-button"
            >
              <Printer />
              <span className="hidden sm:inline">Print labels</span>
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setStructureOpen(true)}
                aria-label="Configure structure"
                data-testid="configure-structure-button"
              >
                <Settings2 />
                <span className="hidden sm:inline">Structure</span>
              </Button>
            )}
            <Button onClick={() => setAddOpen(true)} data-testid="add-location-button-desktop">
              <Plus /> Add location
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        {loading ? (
          <>
            <StatsSkeleton count={4} />
            <ListSkeleton rows={6} />
          </>
        ) : error && rows.length === 0 ? (
          <ErrorState
            title="Couldn't load locations"
            message={error}
            onRetry={() => {
              setLoading(true)
              load()
            }}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No locations yet"
            description={
              <>
                A location is anywhere stock sits — a zone, aisle, shelf or bin. Each gets a code like{" "}
                <span className="font-mono text-foreground">A-01-03</span> that you can print on a label and scan.
              </>
            }
            action={
              <>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus /> Add your first location
                </Button>
                {isAdmin && !template && (
                  <Button variant="outline" onClick={() => setStructureOpen(true)}>
                    <Settings2 /> Set up structure
                  </Button>
                )}
              </>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard
                label="Locations"
                value={formatNumber(stats.total)}
                icon={MapPin}
                tone="primary"
                hint={showZones ? `Across ${zones.length} ${plural(zoneLabel)}` : undefined}
              />
              <StatCard
                label="In use"
                value={formatNumber(stats.inUse)}
                icon={Warehouse}
                tone="success"
                hint={stats.total ? `${Math.round((stats.inUse / stats.total) * 100)}% hold stock` : undefined}
              />
              <StatCard
                label="Empty"
                value={formatNumber(stats.empty)}
                icon={PackageOpen}
                tone="default"
                hint="Ready for new stock"
              />
              <StatCard
                label="Units stored"
                value={stats.units === null ? "—" : formatNumber(stats.units)}
                icon={Boxes}
                tone="info"
                hint={
                  stats.units !== null && stats.capacity > 0
                    ? `${Math.round((stats.units / stats.capacity) * 100)}% of ${formatNumber(stats.capacity)} capacity`
                    : undefined
                }
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <SearchInput
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search code, description or barcode…"
                  aria-label="Search locations"
                  className="md:max-w-sm md:flex-1"
                  data-testid="search-locations-input"
                />
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 md:flex">
                  <Tabs value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
                    <TabsList className="grid h-10 w-full grid-cols-3 md:h-9 md:w-auto" aria-label="Filter by stock">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="in-use">In use</TabsTrigger>
                      <TabsTrigger value="empty">Empty</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    <SelectTrigger className="h-10 w-[8.75rem] gap-2 md:h-9" aria-label="Sort locations">
                      <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="end">
                      {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                        <SelectItem key={key} value={key}>
                          {SORT_LABELS[key]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {showZones && (
                <div
                  className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
                  role="group"
                  aria-label={`Filter by ${zoneLabel.toLowerCase()}`}
                >
                  <ZoneChip active={activeZone === null} onClick={() => setZone(null)}>
                    All {plural(zoneLabel)}
                  </ZoneChip>
                  {zones.map(([value, count]) => (
                    <ZoneChip key={value} active={activeZone === value} onClick={() => setZone(value)}>
                      {zoneLabel} <span className="font-mono">{value}</span>
                      <span className="tabular-nums opacity-70">{count}</span>
                    </ZoneChip>
                  ))}
                </div>
              )}

              {isFiltered && (
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  Showing {formatNumber(filtered.length)} of {formatNumber(rows.length)} locations ·{" "}
                  <button type="button" className="font-medium text-primary hover:underline" onClick={clearFilters}>
                    Clear filters
                  </button>
                </p>
              )}
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No matching locations"
                description={q ? `Nothing matches “${query.trim()}” with the current filters.` : "No locations match these filters."}
                action={
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <>
                <div className="md:hidden">
                  <LocationMobileView
                    rows={filtered}
                    canDelete={isAdmin}
                    deletingId={deletingId}
                    onEdit={setEditing}
                    onPrint={(location) => setLabelTargets([location])}
                    onDelete={handleDelete}
                  />
                </div>

                <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="pl-4">Code</TableHead>
                        <TableHead className="hidden xl:table-cell">Description</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Units</TableHead>
                        <TableHead className="w-44">Capacity</TableHead>
                        <TableHead className="hidden xl:table-cell">Barcode</TableHead>
                        <TableHead className="w-px pr-4 text-right">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => (
                        <LocationTableRow
                          key={row.location.id}
                          row={row}
                          canDelete={isAdmin}
                          deleting={deletingId === row.location.id}
                          onOpen={() => router.push(`/dashboard/locations/${row.location.id}`)}
                          onEdit={() => setEditing(row.location)}
                          onPrint={() => setLabelTargets([row.location])}
                          onDelete={() => handleDelete(row)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <AddLocationDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        workspaceId={workspaceId}
        defaultStructure={template}
        onSuccess={handleCreated}
        onStructureUpdate={setTemplate}
        existingCodes={existingCodes}
        allowAddAnother
      />

      <EditLocationDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        workspaceId={workspaceId}
        location={editing}
        onSuccess={handleUpdated}
        existingCodes={existingCodes}
      />

      {isAdmin && (
        <ConfigureStructureDialog
          open={structureOpen}
          onOpenChange={setStructureOpen}
          workspaceId={workspaceId}
          defaultStructure={template}
          onSuccess={setTemplate}
        />
      )}

      <LocationLabelGenerator
        open={labelTargets !== null}
        onOpenChange={(open) => !open && setLabelTargets(null)}
        locations={labelTargets ?? []}
      />
    </PageContainer>
  )
}

function ZoneChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors sm:h-8",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  )
}

function LocationTableRow({
  row,
  canDelete,
  deleting,
  onOpen,
  onEdit,
  onPrint,
  onDelete,
}: {
  row: LocationRow
  canDelete: boolean
  deleting: boolean
  onOpen: () => void
  onEdit: () => void
  onPrint: () => void
  onDelete: () => void
}) {
  const { location, structure, units } = row
  const path = formatStructurePath(structure)
  const subtitle = location.description || path

  return (
    <TableRow className="cursor-pointer" onClick={onOpen} data-testid={`location-row-${location.id}`}>
      <TableCell className="max-w-[18rem] py-3 pl-4">
        <Link
          href={`/dashboard/locations/${location.id}`}
          onClick={(e) => e.stopPropagation()}
          className="break-all font-mono font-semibold hover:text-primary hover:underline"
        >
          {location.code}
        </Link>
        {subtitle && <p className="truncate text-xs text-muted-foreground xl:hidden">{subtitle}</p>}
        {path && <p className="hidden truncate text-xs text-muted-foreground xl:block">{path}</p>}
      </TableCell>
      <TableCell className="hidden max-w-[16rem] whitespace-normal xl:table-cell">
        <span className={cn("line-clamp-2 text-sm", !location.description && "text-muted-foreground")}>
          {location.description || "—"}
        </span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        <span className={cn(row.items === 0 && "text-muted-foreground")}>{formatNumber(row.items)}</span>
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {units === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={cn("font-medium", units === 0 && "font-normal text-muted-foreground")}>
            {formatNumber(units)}
          </span>
        )}
      </TableCell>
      <TableCell>
        {units !== null && location.capacity > 0 ? (
          <UtilisationBar units={units} capacity={location.capacity} />
        ) : (
          <span className="text-sm tabular-nums text-muted-foreground">{formatNumber(location.capacity)}</span>
        )}
      </TableCell>
      <TableCell className="hidden max-w-[12rem] xl:table-cell">
        <span className="block truncate font-mono text-xs text-muted-foreground">{location.barcode || "—"}</span>
      </TableCell>
      <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-0.5">
          <RowAction label={`Print label for ${location.code}`} tooltip="Print label" onClick={onPrint}>
            <Printer />
          </RowAction>
          <RowAction
            label={`Edit ${location.code}`}
            tooltip="Edit"
            onClick={onEdit}
            data-testid={`edit-location-button-${location.id}`}
          >
            <Pencil />
          </RowAction>
          {canDelete && (
            <RowAction
              label={`Delete ${location.code}`}
              tooltip="Delete"
              onClick={onDelete}
              disabled={deleting}
              destructive
              data-testid={`delete-location-button-${location.id}`}
            >
              {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </RowAction>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

function RowAction({
  label,
  tooltip,
  onClick,
  disabled,
  destructive,
  children,
  ...rest
}: {
  label: string
  tooltip: string
  onClick: () => void
  disabled?: boolean
  destructive?: boolean
  children: React.ReactNode
  "data-testid"?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          className={cn("text-muted-foreground", destructive ? "hover:text-destructive" : "hover:text-foreground")}
          data-testid={rest["data-testid"]}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
