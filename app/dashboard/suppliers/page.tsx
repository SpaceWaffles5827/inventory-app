"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CircleCheck, Package, Pencil, PhoneOff, Plus, Power, SearchX, Trash2, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageContainer, PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton, StatsSkeleton } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { Pagination, usePagination } from "@/components/common/pagination"
import { useConfirm } from "@/components/common/confirm-provider"
import { ListToolbar, OptionSelect, type Option } from "@/components/partners/list-toolbar"
import { RowActions } from "@/components/partners/row-actions"
import { ContactLinks } from "@/components/partners/contact-details"
import { AddSupplierDialog } from "@/components/addSupplierDialog"
import { EditSupplierDialog } from "@/components/editSupplierDialog"
import { SupplierMobileView } from "@/components/supplierMobileView"
import { deleteSupplierApi, getSuppliersApi, updateSupplierApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatDate, formatNumber, getInitials } from "@/lib/format"

type StatusFilter = "all" | "active" | "inactive"
type SortKey = "name-asc" | "name-desc" | "items-desc" | "newest"

const PAGE_SIZE = 25

const STATUS_OPTIONS: Option<StatusFilter>[] = [
  { value: "all", label: "All suppliers" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
]

const SORT_OPTIONS: Option<SortKey>[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "items-desc", label: "Most items" },
  { value: "newest", label: "Newest first" },
]

const itemCount = (s: SupplierWithCount) => s._count?.items ?? 0

export default function SuppliersPage() {
  const confirm = useConfirm()
  const { workspaceId, isAdmin } = useWorkspace()

  const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set())

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("name-asc")

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<SupplierWithCount | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getSuppliersApi(workspaceId)
      setSuppliers(res.data?.suppliers ?? [])
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load suppliers"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const active = suppliers.filter((s) => s.isActive).length
    const items = suppliers.reduce((sum, s) => sum + itemCount(s), 0)
    const noContact = suppliers.filter((s) => !s.email && !s.phone).length
    return { active, inactive: suppliers.length - active, items, noContact }
  }, [suppliers])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = suppliers.filter((s) => {
      if (status === "active" && !s.isActive) return false
      if (status === "inactive" && s.isActive) return false
      if (!q) return true
      return [s.name, s.contactPerson, s.email, s.phone, s.address].some((v) => (v ?? "").toLowerCase().includes(q))
    })
    return filtered.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return b.name.localeCompare(a.name)
        case "items-desc":
          return itemCount(b) - itemCount(a) || a.name.localeCompare(b.name)
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [suppliers, query, status, sort])

  const { page, total, pageRows, setPage } = usePagination(visible, PAGE_SIZE, `${query}|${status}|${sort}`)

  const setPending = (id: string, pending: boolean) =>
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (pending) next.add(id)
      else next.delete(id)
      return next
    })

  /** Optimistic: flip the switch immediately, roll back if the save fails */
  const toggleActive = async (supplier: SupplierWithCount, active: boolean) => {
    if (pendingIds.has(supplier.id) || supplier.isActive === active) return
    setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? { ...s, isActive: active } : s)))
    setPending(supplier.id, true)
    try {
      await updateSupplierApi(supplier.id, { isActive: active, workspaceId })
      toast.success(`${supplier.name} marked as ${active ? "active" : "inactive"}`)
    } catch (err) {
      setSuppliers((prev) => prev.map((s) => (s.id === supplier.id ? { ...s, isActive: !active } : s)))
      toast.error(getErrorMessage(err, "Couldn't update the supplier"))
    } finally {
      setPending(supplier.id, false)
    }
  }

  const openEdit = (supplier: SupplierWithCount) => {
    setEditing(supplier)
    setEditOpen(true)
  }

  const handleDelete = async (supplier: SupplierWithCount) => {
    const count = itemCount(supplier)
    if (count > 0) {
      toast.error(`Can't delete ${supplier.name}`, {
        description: `${formatNumber(count)} ${count === 1 ? "item is" : "items are"} linked to this supplier. Assign them to another supplier first, or mark ${supplier.name} as inactive instead.`,
      })
      return
    }
    const deleted = await confirm({
      title: `Delete ${supplier.name}?`,
      description:
        "The supplier and its contact details are removed permanently. No items use this supplier, so stock isn't affected. To keep the record, mark it as inactive instead.",
      destructive: true,
      confirmLabel: "Delete supplier",
      action: async () => {
        try {
          await deleteSupplierApi(supplier.id, workspaceId)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't delete supplier"))
          throw err
        }
      },
    })
    if (deleted) {
      setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id))
      toast.success(`${supplier.name} deleted`)
    }
  }

  const actionsFor = (supplier: SupplierWithCount) => [
    { label: "Edit", icon: Pencil, onSelect: () => openEdit(supplier) },
    {
      label: supplier.isActive ? "Mark as inactive" : "Mark as active",
      icon: Power,
      onSelect: () => toggleActive(supplier, !supplier.isActive),
    },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      separated: true,
      hidden: !isAdmin,
      onSelect: () => handleDelete(supplier),
    },
  ]

  const hasFilters = query.trim() !== "" || status !== "all"

  return (
    <PageContainer>
      <PageHeader
        title="Suppliers"
        description="The vendors you buy stock from, and how to reach them."
        actions={
          <Button onClick={() => setCreateOpen(true)} data-testid="add-supplier-button">
            <Plus /> Add supplier
          </Button>
        }
      />

      <div className="space-y-6">
        {error ? (
          <ErrorState title="Couldn't load suppliers" message={error} onRetry={load} />
        ) : loading ? (
          <>
            <StatsSkeleton count={4} />
            <ListSkeleton rows={6} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard
                label="Suppliers"
                value={formatNumber(suppliers.length)}
                icon={Truck}
                tone="primary"
                hint={totals.inactive > 0 ? `${formatNumber(totals.inactive)} inactive` : "All active"}
              />
              <StatCard
                label="Active"
                value={formatNumber(totals.active)}
                icon={CircleCheck}
                tone="success"
                hint="Currently ordering from"
              />
              <StatCard
                label="Items supplied"
                value={formatNumber(totals.items)}
                icon={Package}
                hint="Items linked to a supplier"
              />
              <StatCard
                label="No contact info"
                value={formatNumber(totals.noContact)}
                icon={PhoneOff}
                tone={totals.noContact > 0 ? "warning" : "default"}
                hint={totals.noContact > 0 ? "Missing email and phone" : "Everyone is reachable"}
              />
            </div>

            {suppliers.length === 0 ? (
              <EmptyState
                icon={Truck}
                title="No suppliers yet"
                description="Add the vendors you buy from so you can link them to items and know who to call when stock runs low."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus /> Add supplier
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
                      placeholder="Search name, contact, email…"
                      aria-label="Search suppliers"
                      data-testid="search-suppliers-input"
                    />
                  }
                >
                  <OptionSelect label="Filter by status" value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />
                  <OptionSelect label="Sort suppliers" value={sort} onValueChange={setSort} options={SORT_OPTIONS} />
                </ListToolbar>

                {visible.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No suppliers match"
                    description={
                      query.trim() ? `Nothing matches “${query.trim()}”.` : "No suppliers match the current filter."
                    }
                    action={
                      hasFilters && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setQuery("")
                            setStatus("all")
                          }}
                        >
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
                            <TableHead className="h-11 pl-4 text-muted-foreground">Supplier</TableHead>
                            <TableHead className="h-11 text-muted-foreground">Contact</TableHead>
                            <TableHead className="h-11 text-right text-muted-foreground">Items</TableHead>
                            <TableHead className="hidden h-11 text-muted-foreground xl:table-cell">Added</TableHead>
                            <TableHead className="h-11 text-muted-foreground">Active</TableHead>
                            <TableHead className="h-11 w-14 pr-4">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageRows.map((supplier) => (
                            <TableRow
                              key={supplier.id}
                              className={supplier.isActive ? undefined : "text-muted-foreground"}
                              data-testid={`supplier-row-${supplier.id}`}
                            >
                              <TableCell className="w-[38%] max-w-0 py-3 pl-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                                    {getInitials(supplier.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-foreground">{supplier.name}</p>
                                    <p className="truncate text-sm text-muted-foreground">
                                      {supplier.contactPerson || "No contact person"}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="w-[28%] max-w-0 py-3">
                                <ContactLinks email={supplier.email} phone={supplier.phone} />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(itemCount(supplier))}</TableCell>
                              <TableCell className="hidden text-muted-foreground xl:table-cell">
                                {formatDate(supplier.createdAt)}
                              </TableCell>
                              <TableCell>
                                <Switch
                                  checked={supplier.isActive}
                                  onCheckedChange={(checked) => toggleActive(supplier, checked)}
                                  disabled={pendingIds.has(supplier.id)}
                                  aria-label={`${supplier.name} is active`}
                                  data-testid={`supplier-active-switch-${supplier.id}`}
                                />
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <RowActions label={`Actions for ${supplier.name}`} actions={actionsFor(supplier)} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="md:hidden">
                      <SupplierMobileView
                        suppliers={pageRows}
                        onEditClick={openEdit}
                        onDeleteClick={isAdmin ? handleDelete : undefined}
                        onToggleStatus={toggleActive}
                        pendingIds={pendingIds}
                      />
                    </div>

                    <Pagination
                      page={page}
                      pageSize={PAGE_SIZE}
                      total={total}
                      onPageChange={setPage}
                      noun="suppliers"
                    />
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <AddSupplierDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        onSuccess={(supplier) => setSuppliers((prev) => [...prev, supplier])}
      />
      <EditSupplierDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={workspaceId}
        supplier={editing}
        onSuccess={(updated) => setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))}
      />
    </PageContainer>
  )
}
