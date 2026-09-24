"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, DollarSign, Eye, FolderTree, Package, Pencil, Plus, SearchX, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageContainer, PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton, StatsSkeleton } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { useConfirm } from "@/components/common/confirm-provider"
import { ListToolbar, OptionSelect, type Option } from "@/components/partners/list-toolbar"
import { RowActions } from "@/components/partners/row-actions"
import type { CategoryRow } from "@/components/catalog/category-row"
import { AddCategoryDialog } from "@/components/addCategoryDialog"
import { EditCategoryDialog } from "@/components/editCategoryDialog"
import { CategoryMobileView } from "@/components/categoryMobileView"
import { deleteCategoryApi, getCategoriesApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getItemsApi, type ItemWithRelations } from "@/lib/api/items.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber } from "@/lib/format"

type SortKey = "name-asc" | "name-desc" | "items-desc" | "value-desc" | "newest"
type UsageFilter = "all" | "in-use" | "empty"

const SORT_OPTIONS: Option<SortKey>[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "items-desc", label: "Most items" },
  { value: "value-desc", label: "Highest value" },
  { value: "newest", label: "Newest first" },
]

const USAGE_OPTIONS: Option<UsageFilter>[] = [
  { value: "all", label: "All categories" },
  { value: "in-use", label: "With items" },
  { value: "empty", label: "Empty" },
]

function isLow(item: ItemWithRelations) {
  return item.status === "LOW_STOCK" || item.status === "OUT_OF_STOCK"
}

export default function CategoriesPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const { workspaceId, isAdmin } = useWorkspace()

  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  /** null when items couldn't be loaded — stock figures then show as unavailable */
  const [items, setItems] = useState<ItemWithRelations[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [query, setQuery] = useState("")
  const [usage, setUsage] = useState<UsageFilter>("all")
  const [sort, setSort] = useState<SortKey>("name-asc")

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<CategoryWithCount | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        getCategoriesApi(workspaceId),
        // items only feed the stock columns — if they fail the list still works
        getItemsApi(workspaceId).catch(() => null),
      ])
      setCategories(categoriesRes.data?.categories ?? [])
      setItems(itemsRes ? (itemsRes.data?.items ?? []) : null)
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load categories"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo<CategoryRow[]>(() => {
    const stock = new Map<string, { units: number; value: number; lowStock: number }>()
    for (const item of items ?? []) {
      if (!item.categoryId) continue
      const entry = stock.get(item.categoryId) ?? { units: 0, value: 0, lowStock: 0 }
      entry.units += item.onHand
      entry.value += item.onHand * item.cost
      if (isLow(item)) entry.lowStock += 1
      stock.set(item.categoryId, entry)
    }
    return categories.map((category) => {
      const s = stock.get(category.id)
      return {
        ...category,
        units: items ? (s?.units ?? 0) : null,
        value: items ? (s?.value ?? 0) : null,
        lowStock: items ? (s?.lowStock ?? 0) : null,
      }
    })
  }, [categories, items])

  const totals = useMemo(() => {
    const categorised = categories.reduce((sum, c) => sum + c.itemCount, 0)
    const empty = categories.filter((c) => c.itemCount === 0).length
    const uncategorised = items ? items.filter((i) => !i.categoryId).length : null
    const value = items ? items.reduce((sum, i) => (i.categoryId ? sum + i.onHand * i.cost : sum), 0) : null
    return { categorised, empty, uncategorised, value }
  }, [categories, items])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = rows.filter((c) => {
      if (usage === "in-use" && c.itemCount === 0) return false
      if (usage === "empty" && c.itemCount > 0) return false
      if (!q) return true
      return c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q)
    })
    return filtered.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return b.name.localeCompare(a.name)
        case "items-desc":
          return b.itemCount - a.itemCount || a.name.localeCompare(b.name)
        case "value-desc":
          return (b.value ?? 0) - (a.value ?? 0) || a.name.localeCompare(b.name)
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [rows, query, usage, sort])

  const clearFilters = () => {
    setQuery("")
    setUsage("all")
  }

  const openEdit = (category: CategoryWithCount) => {
    setEditing(category)
    setEditOpen(true)
  }

  const handleDelete = async (category: CategoryRow) => {
    if (category.itemCount > 0) {
      toast.error(`Can't delete “${category.name}”`, {
        description: `${formatNumber(category.itemCount)} ${category.itemCount === 1 ? "item is" : "items are"} still in this category. Move them to another category or delete them first.`,
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
      setCategories((prev) => prev.filter((c) => c.id !== category.id))
      toast.success(`Category “${category.name}” deleted`)
    }
  }

  const hasFilters = query.trim() !== "" || usage !== "all"

  return (
    <PageContainer>
      <PageHeader
        title="Categories"
        description="Group similar items so they're easier to find, filter and report on."
        actions={
          <Button onClick={() => setCreateOpen(true)} data-testid="add-category-button-desktop">
            <Plus /> Add category
          </Button>
        }
      />

      <div className="space-y-6">
        {error ? (
          <ErrorState title="Couldn't load categories" message={error} onRetry={load} />
        ) : loading ? (
          <>
            <StatsSkeleton count={4} />
            <ListSkeleton rows={6} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard
                label="Categories"
                value={formatNumber(categories.length)}
                icon={FolderTree}
                tone="primary"
                hint={totals.empty > 0 ? `${formatNumber(totals.empty)} without items` : "All in use"}
              />
              <StatCard
                label="Categorised items"
                value={formatNumber(totals.categorised)}
                icon={Package}
                hint={items ? `of ${formatNumber(items.length)} items in total` : "Across all categories"}
              />
              <StatCard
                label="Uncategorised"
                value={totals.uncategorised === null ? "—" : formatNumber(totals.uncategorised)}
                icon={AlertTriangle}
                tone={totals.uncategorised ? "warning" : "default"}
                hint={
                  totals.uncategorised === null
                    ? "Item data unavailable"
                    : totals.uncategorised > 0
                      ? "Items without a category"
                      : "Every item has a category"
                }
              />
              <StatCard
                label="Stock value"
                value={totals.value === null ? "—" : formatCurrencyCompact(totals.value)}
                icon={DollarSign}
                tone="success"
                hint={totals.value === null ? "Item data unavailable" : "On hand in categorised items"}
              />
            </div>

            {categories.length === 0 ? (
              <EmptyState
                icon={FolderTree}
                title="No categories yet"
                description="Create categories like “Electronics” or “Packaging” to group your items and see stock and value per group."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus /> Add category
                  </Button>
                }
              />
            ) : (
              <section className="space-y-4">
                <ListToolbar
                  search={
                    <SearchInput
                      value={query}
                      onValueChange={setQuery}
                      placeholder="Search categories…"
                      aria-label="Search categories"
                      data-testid="search-categories-input"
                    />
                  }
                >
                  <OptionSelect label="Filter categories" value={usage} onValueChange={setUsage} options={USAGE_OPTIONS} />
                  <OptionSelect label="Sort categories" value={sort} onValueChange={setSort} options={SORT_OPTIONS} />
                </ListToolbar>

                {visible.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No categories match"
                    description={
                      query.trim()
                        ? `Nothing matches “${query.trim()}”${usage !== "all" ? " with the current filter" : ""}.`
                        : "No categories match the current filter."
                    }
                    action={
                      hasFilters && (
                        <Button variant="outline" onClick={clearFilters}>
                          Clear filters
                        </Button>
                      )
                    }
                  />
                ) : (
                  <>
                    <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-11 pl-4 text-muted-foreground">Category</TableHead>
                            <TableHead className="h-11 text-right text-muted-foreground">Items</TableHead>
                            <TableHead className="h-11 text-right text-muted-foreground">Units</TableHead>
                            <TableHead className="h-11 text-right text-muted-foreground">Stock value</TableHead>
                            <TableHead className="hidden h-11 text-right text-muted-foreground lg:table-cell">
                              Low stock
                            </TableHead>
                            <TableHead className="hidden h-11 text-muted-foreground xl:table-cell">Created</TableHead>
                            <TableHead className="h-11 w-14 pr-4">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visible.map((category) => {
                            const href = `/dashboard/categories/${category.id}`
                            return (
                              <TableRow
                                key={category.id}
                                className="cursor-pointer"
                                onClick={() => router.push(href)}
                                data-testid={`category-row-${category.id}`}
                              >
                                <TableCell className="w-full max-w-0 py-3 pl-4">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                      <FolderTree className="size-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <Link
                                        href={href}
                                        onClick={(e) => e.stopPropagation()}
                                        className="block truncate font-medium hover:underline"
                                      >
                                        {category.name}
                                      </Link>
                                      <p className="truncate text-sm text-muted-foreground">
                                        {category.description || "No description"}
                                      </p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatNumber(category.itemCount)}</TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {category.units === null ? "—" : formatNumber(category.units)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {category.value === null ? "—" : formatCurrency(category.value)}
                                </TableCell>
                                <TableCell className="hidden text-right lg:table-cell">
                                  {category.lowStock ? (
                                    <Badge variant="warning" className="tabular-nums">
                                      {formatNumber(category.lowStock)}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="hidden text-muted-foreground xl:table-cell">
                                  {formatDate(category.createdAt)}
                                </TableCell>
                                <TableCell className="pr-4 text-right">
                                  <RowActions
                                    label={`Actions for ${category.name}`}
                                    actions={[
                                      { label: "View items", icon: Eye, href },
                                      { label: "Edit", icon: Pencil, onSelect: () => openEdit(category) },
                                      {
                                        label: "Delete",
                                        icon: Trash2,
                                        destructive: true,
                                        separated: true,
                                        hidden: !isAdmin,
                                        onSelect: () => handleDelete(category),
                                      },
                                    ]}
                                  />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="md:hidden">
                      <CategoryMobileView
                        categories={visible}
                        onEditClick={openEdit}
                        onDeleteClick={isAdmin ? handleDelete : undefined}
                      />
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <AddCategoryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        onSuccess={(category) => setCategories((prev) => [...prev, category])}
      />
      <EditCategoryDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={workspaceId}
        category={editing}
        onSuccess={(updated) => setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
      />
    </PageContainer>
  )
}
