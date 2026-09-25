"use client"

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { AlertTriangle, Boxes, DollarSign, Download, Package, PackageSearch, Plus, SlidersHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PageContainer, PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton, PageSkeleton, StatsSkeleton } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { Pagination, usePagination } from "@/components/common/pagination"
import { AddItemDialog } from "@/components/addItemDialog"
import { DeleteItemDialog } from "@/components/deleteItemDialog"
import { StockAdjustmentWizard } from "@/components/stockAdjustmentWizard"
import { TransferStockWizard } from "@/components/transferStockWizard"
import { ItemTableView } from "@/components/itemTableview"
import { ItemGridView } from "@/components/itemgridview"
import { ItemListView } from "@/components/itemListView"
import { ItemMobileView } from "@/components/itemMobileview"
import type { ItemRowActions } from "@/components/items/item-actions-menu"
import { ViewToggle, readStoredViewMode, storeViewMode, type InventoryViewMode } from "@/components/items/view-toggle"
import { useIsDesktop } from "@/components/items/use-media-query"
import { fetchAllItems } from "@/components/items/items-data"
import { STOCK_CHANGED_EVENT } from "@/components/stock/stock-utils"
import {
  downloadCsv,
  getItemStatus,
  getItemValue,
  getReorderPoint,
  replaceSearchParams,
  stockedLocations,
  todayInputValue,
  type InventoryItem,
} from "@/components/items/item-utils"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatCurrency, formatCurrencyCompact, formatNumber } from "@/lib/format"
import { STOCK_STATUS, type StockStatus } from "@/lib/stock"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Filters live in the URL (?status=LOW_STOCK&category=…&supplier=…&sort=…&q=…) so they survive
// navigating into an item and back, and other pages can deep-link into a filtered list.
// ---------------------------------------------------------------------------

type StatusFilter = "all" | "attention" | StockStatus
type SortKey = "name" | "name-desc" | "itemNumber" | "onHand-asc" | "onHand-desc" | "value-desc" | "newest"

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "attention", label: "Low or out of stock" },
  { value: "IN_STOCK", label: STOCK_STATUS.IN_STOCK.label },
  { value: "LOW_STOCK", label: STOCK_STATUS.LOW_STOCK.label },
  { value: "OUT_OF_STOCK", label: STOCK_STATUS.OUT_OF_STOCK.label },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "itemNumber", label: "Item number" },
  { value: "onHand-asc", label: "Stock: low to high" },
  { value: "onHand-desc", label: "Stock: high to low" },
  { value: "value-desc", label: "Value: high to low" },
  { value: "newest", label: "Recently added" },
]

/** Filter value for items without a category / supplier */
const NONE = "none"
/** Rows rendered per page */
const PAGE_SIZE = 50

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" })

const SORTERS: Record<SortKey, (a: InventoryItem, b: InventoryItem) => number> = {
  name: (a, b) => collator.compare(a.name, b.name),
  "name-desc": (a, b) => collator.compare(b.name, a.name),
  itemNumber: (a, b) => collator.compare(a.itemNumber, b.itemNumber),
  "onHand-asc": (a, b) => a.onHand - b.onHand || collator.compare(a.name, b.name),
  "onHand-desc": (a, b) => b.onHand - a.onHand || collator.compare(a.name, b.name),
  "value-desc": (a, b) => getItemValue(b) - getItemValue(a),
  newest: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
}

function parseStatus(value: string | null): StatusFilter {
  if (!value) return "all"
  if (value.toLowerCase() === "attention") return "attention"
  const upper = value.toUpperCase()
  return upper in STOCK_STATUS ? (upper as StockStatus) : "all"
}

function parseSort(value: string | null): SortKey {
  return SORT_OPTIONS.some((o) => o.value === value) ? (value as SortKey) : "name"
}

export default function InventoryPage() {
  // useSearchParams needs a Suspense boundary so the route can still be prerendered
  return (
    <Suspense fallback={<PageSkeleton stats={4} />}>
      <InventoryView />
    </Suspense>
  )
}

function InventoryView() {
  const { workspaceId, isAdmin } = useWorkspace()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const isDesktop = useIsDesktop()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "")
  const [viewMode, setViewMode] = useState<InventoryViewMode>(readStoredViewMode)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [adjust, setAdjust] = useState<{ open: boolean; item: InventoryItem | null }>({ open: false, item: null })
  const [transfer, setTransfer] = useState<{ open: boolean; item: InventoryItem | null }>({ open: false, item: null })
  const [remove, setRemove] = useState<{ open: boolean; item: InventoryItem | null }>({ open: false, item: null })

  const status = parseStatus(searchParams.get("status"))
  const categoryId = searchParams.get("category") ?? "all"
  const supplierId = searchParams.get("supplier") ?? "all"
  const sort = parseSort(searchParams.get("sort"))
  // The command palette links to /dashboard/items?new=1; the scanner adds &barcode=<unknown code>
  const wantsNew = searchParams.get("new") === "1"
  const newBarcode = searchParams.get("barcode") ?? undefined
  const addOpen = addDialogOpen || wantsNew

  // ---- data -----------------------------------------------------------------

  const load = useCallback(async () => {
    setError(null)
    try {
      setItems(await fetchAllItems(workspaceId))
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load your inventory"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  // Stock moved elsewhere (e.g. the global scanner) — refresh quietly
  useEffect(() => {
    const onStockChanged = () => load()
    window.addEventListener(STOCK_CHANGED_EVENT, onStockChanged)
    return () => window.removeEventListener(STOCK_CHANGED_EVENT, onStockChanged)
  }, [load])

  const retry = () => {
    setLoading(true)
    load()
  }

  // ---- derived --------------------------------------------------------------

  const categoryOptions = useMemo(() => uniqueOptions(items.map((i) => i.category)), [items])
  const supplierOptions = useMemo(() => uniqueOptions(items.map((i) => i.supplier)), [items])
  const hasUncategorized = useMemo(() => items.some((i) => !i.categoryId), [items])
  const hasNoSupplier = useMemo(() => items.some((i) => !i.supplierId), [items])

  const stats = useMemo(() => {
    let units = 0
    let value = 0
    let attention = 0
    for (const item of items) {
      units += item.onHand
      value += getItemValue(item)
      if (getItemStatus(item) !== "IN_STOCK") attention++
    }
    return { skus: items.length, units, value, attention }
  }, [items])

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matches = items.filter((item) => {
      if (terms.length > 0) {
        const haystack = [item.name, item.itemNumber, item.barcode, item.category?.name, item.supplier?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        if (!terms.every((t) => haystack.includes(t))) return false
      }
      if (status !== "all") {
        const itemStatus = getItemStatus(item)
        if (status === "attention" ? itemStatus === "IN_STOCK" : itemStatus !== status) return false
      }
      if (categoryId !== "all" && (categoryId === NONE ? item.categoryId : item.categoryId !== categoryId)) return false
      if (supplierId !== "all" && (supplierId === NONE ? item.supplierId : item.supplierId !== supplierId)) return false
      return true
    })
    return matches.sort(SORTERS[sort])
  }, [items, query, status, categoryId, supplierId, sort])

  const optionLabel = (options: { id: string; name: string }[], id: string, none: string) =>
    id === NONE ? none : (options.find((o) => o.id === id)?.name ?? "Unknown")

  const activeFilters: { key: string; label: string; clear: () => void }[] = []
  if (status !== "all") {
    activeFilters.push({
      key: "status",
      label: STATUS_FILTERS.find((o) => o.value === status)?.label ?? status,
      clear: () => replaceSearchParams({ status: null }),
    })
  }
  if (categoryId !== "all") {
    activeFilters.push({
      key: "category",
      label: optionLabel(categoryOptions, categoryId, "No category"),
      clear: () => replaceSearchParams({ category: null }),
    })
  }
  if (supplierId !== "all") {
    activeFilters.push({
      key: "supplier",
      label: optionLabel(supplierOptions, supplierId, "No supplier"),
      clear: () => replaceSearchParams({ supplier: null }),
    })
  }
  const hasFilters = activeFilters.length > 0 || query.trim() !== ""

  // Clicking the "Low or out of stock" card toggles that filter
  const attentionHref = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (status === "attention") params.delete("status")
    else params.set("status", "attention")
    params.delete("new")
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }, [searchParams, status, pathname])

  // ---- actions --------------------------------------------------------------

  const setSearch = (value: string) => {
    setQuery(value)
    replaceSearchParams({ q: value.trim() ? value : null })
  }

  const clearFilters = () => {
    setQuery("")
    replaceSearchParams({ q: null, status: null, category: null, supplier: null })
  }

  const changeView = (mode: InventoryViewMode) => {
    setViewMode(mode)
    storeViewMode(mode)
  }

  const handleAddOpenChange = (open: boolean) => {
    setAddDialogOpen(open)
    if (!open && wantsNew) replaceSearchParams({ new: null, barcode: null })
  }

  const exportCsv = () => {
    downloadCsv(
      `inventory-${todayInputValue()}.csv`,
      ["Item number", "Name", "Category", "Supplier", "Barcode", "Unit", "On hand", "Reorder point", "Unit cost", "Value", "Status", "Locations"],
      filtered.map((item) => [
        item.itemNumber,
        item.name,
        item.category?.name,
        item.supplier?.name,
        item.barcode,
        item.unit,
        item.onHand,
        getReorderPoint(item),
        item.cost,
        Math.round(getItemValue(item) * 100) / 100,
        STOCK_STATUS[getItemStatus(item)].label,
        stockedLocations(item)
          .map((l) => `${l.location.code} (${l.quantity})`)
          .join("; "),
      ])
    )
    toast.success(`Exported ${formatNumber(filtered.length)} ${filtered.length === 1 ? "item" : "items"}`)
  }

  const rowActions: ItemRowActions = {
    onAdjustmentClick: (item) => setAdjust({ open: true, item }),
    onTransferClick: (item) => setTransfer({ open: true, item }),
    onDeleteClick: isAdmin ? (item) => setRemove({ open: true, item }) : undefined,
  }

  // ---- render ---------------------------------------------------------------

  let content: ReactNode
  if (loading) {
    content = (
      <div className="space-y-6">
        <StatsSkeleton count={4} />
        <ListSkeleton rows={8} />
      </div>
    )
  } else if (error && items.length === 0) {
    content = <ErrorState title="Couldn't load your inventory" message={error} onRetry={retry} />
  } else if (items.length === 0) {
    content = (
      <EmptyState
        icon={Package}
        title="No items yet"
        description="Add your first item to start tracking stock levels, locations and value."
        action={
          <Button onClick={() => setAddDialogOpen(true)} data-testid="add-first-item-button">
            <Plus /> Add your first item
          </Button>
        }
      />
    )
  } else {
    content = (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="SKUs"
            value={formatNumber(stats.skus)}
            icon={Package}
            hint={`In ${formatNumber(categoryOptions.length)} ${categoryOptions.length === 1 ? "category" : "categories"}`}
          />
          <StatCard label="Units on hand" value={formatNumber(stats.units)} icon={Boxes} hint="Across all locations" />
          <StatCard
            label="Low or out of stock"
            value={formatNumber(stats.attention)}
            icon={AlertTriangle}
            tone={stats.attention > 0 ? "warning" : "success"}
            href={attentionHref}
            hint={status === "attention" ? "Filtering the list · tap to clear" : stats.attention > 0 ? "Tap to review" : "Everything is stocked"}
            className={cn(status === "attention" && "border-warning/60 bg-warning/5")}
            data-testid="low-stock-stat"
          />
          <StatCard
            label="Inventory value"
            value={formatCurrencyCompact(stats.value)}
            icon={DollarSign}
            hint={stats.value >= 10_000 ? `${formatCurrency(stats.value)} at cost` : "At unit cost"}
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <SearchInput
              value={query}
              onValueChange={setSearch}
              placeholder="Search items…"
              aria-label="Search by name, item number, barcode, category or supplier"
              className="min-w-0 flex-1"
              data-testid="search-items-input"
            />
            {isDesktop ? (
              <>
                <SortSelect value={sort} className="w-[190px]" />
                <ViewToggle value={viewMode} onChange={changeView} />
              </>
            ) : (
              <Button variant="outline" className="shrink-0" onClick={() => setFiltersOpen(true)} data-testid="mobile-filters-button">
                <SlidersHorizontal />
                Filters
                {activeFilters.length > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                    {activeFilters.length}
                  </span>
                )}
              </Button>
            )}
          </div>

          {isDesktop && (
            <div className="flex flex-wrap items-center gap-2">
              <FilterSelects
                status={status}
                categoryId={categoryId}
                supplierId={supplierId}
                categories={categoryOptions}
                suppliers={supplierOptions}
                hasUncategorized={hasUncategorized}
                hasNoSupplier={hasNoSupplier}
                triggerClassName="w-[190px]"
              />
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X /> Clear filters
                </Button>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-muted-foreground" data-testid="item-count" aria-live="polite">
              Showing {formatNumber(filtered.length)} of {formatNumber(items.length)} items
            </p>
            {!isDesktop && activeFilters.length > 0 && (
              <>
                {activeFilters.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={f.clear}
                    className="inline-flex h-7 max-w-full items-center gap-1 rounded-full border bg-card pl-2.5 pr-1.5 text-xs font-medium hover:bg-accent"
                    aria-label={`Remove filter ${f.label}`}
                  >
                    <span className="truncate">{f.label}</span>
                    <X className="size-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                <button type="button" onClick={clearFilters} className="text-xs font-medium text-primary hover:underline">
                  Clear all
                </button>
              </>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No items match your filters"
            description="Try a different search term or remove some filters."
            action={
              <Button variant="outline" onClick={clearFilters}>
                <X /> Clear filters
              </Button>
            }
          />
        ) : (
          <InventoryResults
            resetKey={`${query}|${status}|${categoryId}|${supplierId}|${sort}`}
            items={filtered}
            view={isDesktop ? viewMode : "mobile"}
            actions={rowActions}
          />
        )}
      </div>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="Inventory"
        description="Everything you stock, where it lives and what it's worth"
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0} data-testid="export-items-button">
              <Download /> Export CSV
            </Button>
            <Button onClick={() => setAddDialogOpen(true)} data-testid="add-item-button-desktop">
              <Plus /> Add item
            </Button>
          </>
        }
      />

      {content}

      {/* Mobile filter sheet — desktop shows the same controls inline */}
      <Dialog open={filtersOpen && !isDesktop} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filter and sort</DialogTitle>
            <DialogDescription>Changes apply as you pick them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <FilterSelects
              status={status}
              categoryId={categoryId}
              supplierId={supplierId}
              categories={categoryOptions}
              suppliers={supplierOptions}
              hasUncategorized={hasUncategorized}
              hasNoSupplier={hasNoSupplier}
              withLabels
            />
            <div className="space-y-1.5">
              <Label htmlFor="filter-sort">Sort by</Label>
              <SortSelect value={sort} id="filter-sort" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>
              Clear filters
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>
              Show {formatNumber(filtered.length)} {filtered.length === 1 ? "item" : "items"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddItemDialog
        open={addOpen}
        onOpenChange={handleAddOpenChange}
        workspaceId={workspaceId}
        defaultBarcode={wantsNew ? newBarcode : undefined}
        onSuccess={load}
      />

      <StockAdjustmentWizard
        item={adjust.item}
        open={adjust.open}
        onClose={() => setAdjust((s) => ({ ...s, open: false }))}
        onSuccess={load}
      />

      <TransferStockWizard
        item={transfer.item}
        open={transfer.open}
        onClose={() => setTransfer((s) => ({ ...s, open: false }))}
        onSuccess={load}
      />

      <DeleteItemDialog
        item={remove.item}
        open={remove.open}
        onOpenChange={(open) => setRemove((s) => ({ ...s, open }))}
        onSuccess={load}
      />
    </PageContainer>
  )
}

// ---------------------------------------------------------------------------

function uniqueOptions(values: ({ id: string; name: string } | null | undefined)[]) {
  const map = new Map<string, string>()
  for (const v of values) if (v) map.set(v.id, v.name)
  return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => collator.compare(a.name, b.name))
}

function SortSelect({ value, className, id }: { value: SortKey; className?: string; id?: string }) {
  return (
    <Select value={value} onValueChange={(v) => replaceSearchParams({ sort: v === "name" ? null : v })}>
      <SelectTrigger id={id} className={className} aria-label="Sort by">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

interface FilterSelectsProps {
  status: StatusFilter
  categoryId: string
  supplierId: string
  categories: { id: string; name: string }[]
  suppliers: { id: string; name: string }[]
  hasUncategorized: boolean
  hasNoSupplier: boolean
  withLabels?: boolean
  triggerClassName?: string
}

function FilterSelects({
  status,
  categoryId,
  supplierId,
  categories,
  suppliers,
  hasUncategorized,
  hasNoSupplier,
  withLabels = false,
  triggerClassName,
}: FilterSelectsProps) {
  const field = (id: string, label: string, control: ReactNode) =>
    withLabels ? (
      <div key={id} className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        {control}
      </div>
    ) : (
      <div key={id}>{control}</div>
    )

  const activeClass = "border-primary/50 bg-primary/5"

  return (
    <>
      {field(
        "filter-status",
        "Status",
        <Select value={status} onValueChange={(v) => replaceSearchParams({ status: v })}>
          <SelectTrigger id="filter-status" aria-label="Status" className={cn(triggerClassName, status !== "all" && activeClass)}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {field(
        "filter-category",
        "Category",
        <Select value={categoryId} onValueChange={(v) => replaceSearchParams({ category: v })}>
          <SelectTrigger id="filter-category" aria-label="Category" className={cn(triggerClassName, categoryId !== "all" && activeClass)}>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            {hasUncategorized && <SelectItem value={NONE}>No category</SelectItem>}
          </SelectContent>
        </Select>
      )}
      {field(
        "filter-supplier",
        "Supplier",
        <Select value={supplierId} onValueChange={(v) => replaceSearchParams({ supplier: v })}>
          <SelectTrigger id="filter-supplier" aria-label="Supplier" className={cn(triggerClassName, supplierId !== "all" && activeClass)}>
            <SelectValue placeholder="All suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
            {hasNoSupplier && <SelectItem value={NONE}>No supplier</SelectItem>}
          </SelectContent>
        </Select>
      )}
    </>
  )
}

function InventoryResults({
  items,
  view,
  actions,
  resetKey,
}: {
  items: InventoryItem[]
  view: InventoryViewMode | "mobile"
  actions: ItemRowActions
  /** Paging snaps back to page 1 whenever this changes (new search / filters / sort) */
  resetKey: string
}) {
  const { page, total, pageRows: shown, setPage } = usePagination(items, PAGE_SIZE, resetKey)

  return (
    <div className="space-y-4">
      {view === "mobile" ? (
        <ItemMobileView items={shown} {...actions} />
      ) : view === "grid" ? (
        <ItemGridView items={shown} {...actions} />
      ) : view === "list" ? (
        <ItemListView items={shown} {...actions} />
      ) : (
        <ItemTableView items={shown} {...actions} />
      )}
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
        onPageChange={(next) => {
          setPage(next)
          window.scrollTo({ top: 0, behavior: "smooth" })
        }}
        noun="items"
      />
    </div>
  )
}
