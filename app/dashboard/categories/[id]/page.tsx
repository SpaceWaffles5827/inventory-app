"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { AlertTriangle, DollarSign, FolderTree, Layers, Package, Pencil, Plus, SearchX, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { PageContainer, PageHeader, SectionHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { Pagination, usePagination } from "@/components/common/pagination"
import { useConfirm } from "@/components/common/confirm-provider"
import { ListToolbar, OptionSelect, type Option } from "@/components/partners/list-toolbar"
import { EditCategoryDialog } from "@/components/editCategoryDialog"
import { AddItemDialog } from "@/components/addItemDialog"
import { DeleteItemDialog } from "@/components/deleteItemDialog"
import { StockAdjustmentWizard } from "@/components/stockAdjustmentWizard"
import { TransferStockWizard } from "@/components/transferStockWizard"
import { ItemTableView } from "@/components/itemTableview"
import { ItemMobileView } from "@/components/itemMobileview"
import { deleteCategoryApi, getCategoryByIdApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "@/lib/format"
import { STOCK_STATUS, type StockStatus } from "@/lib/stock"
import CategoryDetailLoading from "./loading"

type StatusFilter = "all" | StockStatus
type SortKey = "name" | "itemNumber" | "stock-asc" | "stock-desc" | "value-desc"

const PAGE_SIZE = 25

const STATUS_OPTIONS: Option<StatusFilter>[] = [
  { value: "all", label: "All statuses" },
  { value: "IN_STOCK", label: STOCK_STATUS.IN_STOCK.label },
  { value: "LOW_STOCK", label: STOCK_STATUS.LOW_STOCK.label },
  { value: "OUT_OF_STOCK", label: STOCK_STATUS.OUT_OF_STOCK.label },
]

const SORT_OPTIONS: Option<SortKey>[] = [
  { value: "name", label: "Name (A–Z)" },
  { value: "itemNumber", label: "Item number" },
  { value: "stock-asc", label: "Stock (low → high)" },
  { value: "stock-desc", label: "Stock (high → low)" },
  { value: "value-desc", label: "Highest value" },
]

export default function CategoryDetailPage() {
  const params = useParams<{ id: string }>()
  const categoryId = params.id
  const router = useRouter()
  const confirm = useConfirm()
  const { workspaceId, isAdmin } = useWorkspace()

  const [category, setCategory] = useState<CategoryWithCount | null>(null)
  const [items, setItems] = useState<ItemWithRelations[]>([])
  const [locations, setLocations] = useState<LocationWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("name")

  const [editOpen, setEditOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [adjustItem, setAdjustItem] = useState<ItemWithRelations | null>(null)
  const [transferItem, setTransferItem] = useState<ItemWithRelations | null>(null)
  const [deleteItem, setDeleteItem] = useState<ItemWithRelations | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const [categoryRes, itemsRes, locationsRes] = await Promise.all([
        getCategoryByIdApi(categoryId, workspaceId),
        getItemsApi(workspaceId),
        // locations only feed the transfer wizard — a failure here shouldn't block the page
        getLocationsApi(workspaceId).catch(() => null),
      ])
      const found = categoryRes.data?.category
      if (!found) {
        setNotFound(true)
        return
      }
      const categoryItems = (itemsRes.data?.items ?? []).filter((item) => item.categoryId === categoryId)
      setCategory({ ...found, itemCount: categoryItems.length })
      setItems(categoryItems)
      setLocations(locationsRes?.data?.locations ?? [])
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError(getErrorMessage(err, "Couldn't load this category"))
    } finally {
      setLoading(false)
    }
  }, [categoryId, workspaceId])

  useEffect(() => {
    load()
  }, [load])

  /** Quiet refetch after a stock change — keeps the current list on screen */
  const refreshItems = useCallback(async () => {
    try {
      const res = await getItemsApi(workspaceId)
      const categoryItems = (res.data?.items ?? []).filter((item) => item.categoryId === categoryId)
      setItems(categoryItems)
      setCategory((prev) => (prev ? { ...prev, itemCount: categoryItems.length } : prev))
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't refresh the item list"))
    }
  }, [categoryId, workspaceId])

  const stats = useMemo(() => {
    let units = 0
    let value = 0
    let low = 0
    let out = 0
    for (const item of items) {
      units += item.onHand
      value += item.onHand * item.cost
      if (item.status === "LOW_STOCK") low += 1
      if (item.status === "OUT_OF_STOCK") out += 1
    }
    return { units, value, low, out }
  }, [items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = items.filter((item) => {
      if (status !== "all" && item.status !== status) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.itemNumber.toLowerCase().includes(q) ||
        (item.barcode ?? "").toLowerCase().includes(q) ||
        (item.supplier?.name ?? "").toLowerCase().includes(q)
      )
    })
    return filtered.sort((a, b) => {
      switch (sort) {
        case "itemNumber":
          return a.itemNumber.localeCompare(b.itemNumber, undefined, { numeric: true })
        case "stock-asc":
          return a.onHand - b.onHand
        case "stock-desc":
          return b.onHand - a.onHand
        case "value-desc":
          return b.onHand * b.cost - a.onHand * a.cost
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [items, query, status, sort])

  const { page, total, pageRows, setPage } = usePagination(visible, PAGE_SIZE, `${query}|${status}|${sort}`)

  const handleDeleteItem = (item: ItemWithRelations) => {
    if (!isAdmin) {
      toast.error("Only workspace admins can delete items")
      return
    }
    setDeleteItem(item)
  }

  const handleDeleteCategory = async () => {
    if (!category) return
    if (items.length > 0) {
      toast.error(`Can't delete “${category.name}”`, {
        description: `${formatNumber(items.length)} ${items.length === 1 ? "item is" : "items are"} still in this category. Move them to another category or delete them first.`,
      })
      return
    }
    const deleted = await confirm({
      title: `Delete “${category.name}”?`,
      description: "This category has no items, so nothing else changes. The category is removed permanently and can't be restored.",
      destructive: true,
      confirmLabel: "Delete category",
      action: async () => {
        try {
          await deleteCategoryApi(category.id, workspaceId)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't delete category"))
          throw err
        }
      },
    })
    if (deleted) {
      toast.success(`Category “${category.name}” deleted`)
      router.push("/dashboard/categories")
    }
  }

  const back = { href: "/dashboard/categories", label: "All categories" }

  if (loading) return <CategoryDetailLoading />

  if (notFound) {
    return (
      <PageContainer>
        <PageHeader title="Category not found" back={back} />
        <EmptyState
          icon={FolderTree}
          title="This category doesn't exist"
          description="It may have been deleted, or the link points to a different workspace."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/categories">Back to categories</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  if (error || !category) {
    return (
      <PageContainer>
        <PageHeader title="Category" back={back} />
        <ErrorState title="Couldn't load this category" message={error ?? undefined} onRetry={load} />
      </PageContainer>
    )
  }

  const hasFilters = query.trim() !== "" || status !== "all"
  const lowTotal = stats.low + stats.out

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={<span className="break-words">{category.name}</span>}
        description={category.description || undefined}
        meta={
          <span className="text-xs text-muted-foreground">
            Created {formatDate(category.createdAt)}
            {formatDate(category.updatedAt) !== formatDate(category.createdAt) && (
              <> · Updated {formatDate(category.updatedAt)}</>
            )}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="edit-category-button">
              <Pencil /> Edit
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={handleDeleteCategory}
                data-testid="delete-category-button"
              >
                <Trash2 /> Delete
              </Button>
            )}
            <Button onClick={() => setAddItemOpen(true)} data-testid="category-add-item-button">
              <Plus /> Add item
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Items"
            value={formatNumber(items.length)}
            icon={Package}
            tone="primary"
            hint={items.length === 1 ? "Product in this category" : "Products in this category"}
          />
          <StatCard label="Units on hand" value={formatNumber(stats.units)} icon={Layers} hint="Across all locations" />
          <StatCard
            label="Stock value"
            value={formatCurrencyCompact(stats.value)}
            icon={DollarSign}
            tone="success"
            hint={stats.value >= 10_000 ? formatCurrency(stats.value) : "On hand × unit cost"}
          />
          <StatCard
            label="Low stock"
            value={formatNumber(lowTotal)}
            icon={AlertTriangle}
            tone={lowTotal > 0 ? "warning" : "default"}
            hint={lowTotal > 0 ? `${formatNumber(stats.out)} out of stock` : "Everything is stocked"}
          />
        </div>

        <section className="space-y-4">
          <SectionHeader
            title="Items in this category"
            description={
              items.length > 0 && hasFilters
                ? `Showing ${formatNumber(visible.length)} of ${formatNumber(items.length)}`
                : undefined
            }
          />

          {items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No items in this category yet"
              description={`Add an item and pick “${category.name}” as its category, or change the category on an existing item.`}
              action={
                <Button onClick={() => setAddItemOpen(true)}>
                  <Plus /> Add item
                </Button>
              }
            />
          ) : (
            <>
              <ListToolbar
                search={
                  <SearchInput
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search name, item #, barcode…"
                    aria-label="Search items in this category"
                    data-testid="search-category-items-input"
                  />
                }
              >
                <OptionSelect label="Filter by stock status" value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />
                <OptionSelect label="Sort items" value={sort} onValueChange={setSort} options={SORT_OPTIONS} />
              </ListToolbar>

              {visible.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="No items match"
                  description="Try a different search or stock status."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery("")
                        setStatus("all")
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="hidden md:block">
                    <ItemTableView
                      items={pageRows}
                      onAdjustmentClick={setAdjustItem}
                      onTransferClick={setTransferItem}
                      onDeleteClick={handleDeleteItem}
                    />
                  </div>
                  <div className="overflow-hidden rounded-xl border bg-card md:hidden">
                    <ItemMobileView
                      items={pageRows}
                      onAdjustmentClick={setAdjustItem}
                      onTransferClick={setTransferItem}
                      onDeleteClick={handleDeleteItem}
                    />
                  </div>
                  <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} noun="items" />
                </>
              )}
            </>
          )}
        </section>
      </div>

      <EditCategoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={workspaceId}
        category={category}
        onSuccess={(updated) => setCategory({ ...updated, itemCount: items.length })}
      />

      <AddItemDialog open={addItemOpen} onOpenChange={setAddItemOpen} workspaceId={workspaceId} onSuccess={refreshItems} />

      <StockAdjustmentWizard
        item={adjustItem}
        open={adjustItem !== null}
        onClose={() => setAdjustItem(null)}
        onSuccess={refreshItems}
      />

      <TransferStockWizard
        item={transferItem}
        open={transferItem !== null}
        onClose={() => setTransferItem(null)}
        onSuccess={refreshItems}
        locations={locations}
      />

      <DeleteItemDialog
        item={deleteItem}
        open={deleteItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteItem(null)
        }}
        onSuccess={refreshItems}
      />
    </PageContainer>
  )
}
