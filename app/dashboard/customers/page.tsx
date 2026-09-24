"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleCheck, Eye, Link2, Pencil, Plus, Power, SearchX, Trash2, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageContainer, PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton, StatsSkeleton } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { useConfirm } from "@/components/common/confirm-provider"
import { ListToolbar, OptionSelect, type Option } from "@/components/partners/list-toolbar"
import { RowActions, type RowAction } from "@/components/partners/row-actions"
import { ActiveBadge, ContactLinks } from "@/components/partners/contact-details"
import { Pagination, clampPage } from "@/components/partners/pagination"
import { AddCustomerDialog } from "@/components/addCustomerDialog"
import { EditCustomerDialog } from "@/components/editCustomerDialog"
import { CustomerMobileView } from "@/components/customerMobileView"
import { deleteCustomerApi, getCustomersApi, updateCustomerApi, type CustomerWithCount } from "@/lib/api/customers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatDate, formatNumber, getInitials } from "@/lib/format"

type StatusFilter = "all" | "ACTIVE" | "INACTIVE"
type SortKey = "name-asc" | "name-desc" | "items-desc" | "newest"

const STATUS_OPTIONS: Option<StatusFilter>[] = [
  { value: "all", label: "All customers" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
]

const SORT_OPTIONS: Option<SortKey>[] = [
  { value: "name-asc", label: "Name (A–Z)" },
  { value: "name-desc", label: "Name (Z–A)" },
  { value: "items-desc", label: "Most linked items" },
  { value: "newest", label: "Newest first" },
]

const PAGE_SIZE = 20
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

const linkedCount = (c: CustomerWithCount) => c._count?.items ?? 0

export default function CustomersPage() {
  const router = useRouter()
  const confirm = useConfirm()
  const { workspaceId, isAdmin } = useWorkspace()

  const [customers, setCustomers] = useState<CustomerWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Captured once per load so "new this month" stays pure during render */
  const [loadedAt, setLoadedAt] = useState(0)

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("name-asc")
  const [page, setPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<CustomerWithCount | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // fetch everything and filter locally so the stats always describe the whole workspace
      const res = await getCustomersApi({ workspaceId })
      setCustomers(res.data?.customers ?? [])
      setLoadedAt(Date.now())
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load customers"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const totals = useMemo(() => {
    const active = customers.filter((c) => c.status === "ACTIVE").length
    const linked = customers.reduce((sum, c) => sum + linkedCount(c), 0)
    const withLinks = customers.filter((c) => linkedCount(c) > 0).length
    const recent = customers.filter((c) => loadedAt - new Date(c.createdAt).getTime() <= THIRTY_DAYS).length
    return { active, inactive: customers.length - active, linked, withLinks, recent }
  }, [customers, loadedAt])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = customers.filter((c) => {
      if (status !== "all" && c.status !== status) return false
      if (!q) return true
      return [c.name, c.company, c.contactPerson, c.email, c.phone].some((v) => (v ?? "").toLowerCase().includes(q))
    })
    return list.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return b.name.localeCompare(a.name)
        case "items-desc":
          return linkedCount(b) - linkedCount(a) || a.name.localeCompare(b.name)
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        default:
          return a.name.localeCompare(b.name)
      }
    })
  }, [customers, query, status, sort])

  const currentPage = clampPage(page, filtered.length, PAGE_SIZE)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const changeQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }
  const changeStatus = (value: StatusFilter) => {
    setStatus(value)
    setPage(1)
  }
  const changeSort = (value: SortKey) => {
    setSort(value)
    setPage(1)
  }
  const clearFilters = () => {
    setQuery("")
    setStatus("all")
    setPage(1)
  }

  const openEdit = (customer: CustomerWithCount) => {
    setEditing(customer)
    setEditOpen(true)
  }

  const replaceCustomer = (updated: CustomerWithCount) =>
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? { ...updated, _count: updated._count ?? c._count } : c)))

  /** Optimistic status flip with rollback */
  const toggleStatus = async (customer: CustomerWithCount) => {
    const next = customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setCustomers((prev) => prev.map((c) => (c.id === customer.id ? { ...c, status: next } : c)))
    try {
      await updateCustomerApi(customer.id, { status: next, workspaceId })
      toast.success(`${customer.name} marked as ${next === "ACTIVE" ? "active" : "inactive"}`)
    } catch (err) {
      setCustomers((prev) => prev.map((c) => (c.id === customer.id ? { ...c, status: customer.status } : c)))
      toast.error(getErrorMessage(err, "Couldn't update the customer"))
    }
  }

  const handleDelete = async (customer: CustomerWithCount) => {
    const count = linkedCount(customer)
    if (count > 0) {
      toast.error(`Can't delete ${customer.name}`, {
        description: `${formatNumber(count)} ${count === 1 ? "item is" : "items are"} linked to this customer. Unlink them on the customer's page first, or mark the customer as inactive instead.`,
      })
      return
    }
    const deleted = await confirm({
      title: `Delete ${customer.name}?`,
      description:
        "The customer and their contact details are removed permanently. They have no linked items, so stock isn't affected. To keep the record, mark them as inactive instead.",
      destructive: true,
      confirmLabel: "Delete customer",
      action: async () => {
        try {
          await deleteCustomerApi(customer.id, workspaceId)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't delete customer"))
          throw err
        }
      },
    })
    if (deleted) {
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id))
      toast.success(`${customer.name} deleted`)
    }
  }

  const actionsFor = (customer: CustomerWithCount): RowAction[] => [
    { label: "View details", icon: Eye, href: `/dashboard/customers/${customer.id}` },
    { label: "Edit", icon: Pencil, onSelect: () => openEdit(customer) },
    {
      label: customer.status === "ACTIVE" ? "Mark as inactive" : "Mark as active",
      icon: Power,
      onSelect: () => toggleStatus(customer),
    },
    {
      label: "Delete",
      icon: Trash2,
      destructive: true,
      separated: true,
      hidden: !isAdmin,
      onSelect: () => handleDelete(customer),
    },
  ]

  const hasFilters = query.trim() !== "" || status !== "all"

  return (
    <PageContainer>
      <PageHeader
        title="Customers"
        description="The people and companies you supply, and the items linked to them."
        actions={
          <Button onClick={() => setCreateOpen(true)} data-testid="add-customer-button">
            <Plus /> Add customer
          </Button>
        }
      />

      <div className="space-y-6">
        {error ? (
          <ErrorState title="Couldn't load customers" message={error} onRetry={load} />
        ) : loading ? (
          <>
            <StatsSkeleton count={4} />
            <ListSkeleton rows={6} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard
                label="Customers"
                value={formatNumber(customers.length)}
                icon={Users}
                tone="primary"
                hint={totals.inactive > 0 ? `${formatNumber(totals.inactive)} inactive` : "All active"}
              />
              <StatCard label="Active" value={formatNumber(totals.active)} icon={CircleCheck} tone="success" hint="Currently supplied" />
              <StatCard
                label="Linked items"
                value={formatNumber(totals.linked)}
                icon={Link2}
                hint={`Across ${formatNumber(totals.withLinks)} ${totals.withLinks === 1 ? "customer" : "customers"}`}
              />
              <StatCard
                label="New this month"
                value={formatNumber(totals.recent)}
                icon={UserPlus}
                tone="info"
                hint="Added in the last 30 days"
              />
            </div>

            {customers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Add the people and companies you ship to, then link items to them from each item's page."
                action={
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus /> Add customer
                  </Button>
                }
              />
            ) : (
              <section className="space-y-4">
                <ListToolbar
                  search={
                    <SearchInput
                      value={query}
                      onValueChange={changeQuery}
                      placeholder="Search name, company, email…"
                      aria-label="Search customers"
                      data-testid="search-customers-input"
                    />
                  }
                >
                  <OptionSelect label="Filter by status" value={status} onValueChange={changeStatus} options={STATUS_OPTIONS} />
                  <OptionSelect label="Sort customers" value={sort} onValueChange={changeSort} options={SORT_OPTIONS} />
                </ListToolbar>

                {filtered.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No customers match"
                    description={
                      query.trim() ? `Nothing matches “${query.trim()}”.` : "No customers match the current filter."
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
                            <TableHead className="h-11 pl-4 text-muted-foreground">Customer</TableHead>
                            <TableHead className="h-11 text-muted-foreground">Contact</TableHead>
                            <TableHead className="h-11 text-right text-muted-foreground">Linked items</TableHead>
                            <TableHead className="h-11 text-muted-foreground">Status</TableHead>
                            <TableHead className="hidden h-11 text-muted-foreground xl:table-cell">Added</TableHead>
                            <TableHead className="h-11 w-14 pr-4">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageRows.map((customer) => {
                            const href = `/dashboard/customers/${customer.id}`
                            const subtitle =
                              customer.company && customer.company !== customer.name
                                ? customer.company
                                : customer.contactPerson || "No contact person"
                            return (
                              <TableRow
                                key={customer.id}
                                className="cursor-pointer"
                                onClick={() => router.push(href)}
                                data-testid={`customer-row-${customer.id}`}
                              >
                                <TableCell className="w-[36%] max-w-0 py-3 pl-4">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                      {getInitials(customer.name)}
                                    </div>
                                    <div className="min-w-0">
                                      <Link
                                        href={href}
                                        onClick={(e) => e.stopPropagation()}
                                        className="block truncate font-medium hover:underline"
                                      >
                                        {customer.name}
                                      </Link>
                                      <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="w-[28%] max-w-0 py-3">
                                  <ContactLinks email={customer.email} phone={customer.phone} />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{formatNumber(linkedCount(customer))}</TableCell>
                                <TableCell>
                                  <ActiveBadge active={customer.status === "ACTIVE"} />
                                </TableCell>
                                <TableCell className="hidden text-muted-foreground xl:table-cell">
                                  {formatDate(customer.createdAt)}
                                </TableCell>
                                <TableCell className="pr-4 text-right">
                                  <RowActions label={`Actions for ${customer.name}`} actions={actionsFor(customer)} />
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="md:hidden">
                      <CustomerMobileView
                        customers={pageRows}
                        onEditClick={openEdit}
                        onDeleteClick={isAdmin ? handleDelete : undefined}
                        onToggleStatus={toggleStatus}
                      />
                    </div>

                    <Pagination
                      page={currentPage}
                      pageSize={PAGE_SIZE}
                      total={filtered.length}
                      onPageChange={setPage}
                      noun="customers"
                    />
                  </>
                )}
              </section>
            )}
          </>
        )}
      </div>

      <AddCustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={workspaceId}
        onSuccess={(customer) => setCustomers((prev) => [...prev, customer])}
      />
      <EditCustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={workspaceId}
        customer={editing}
        onSuccess={replaceCustomer}
      />
    </PageContainer>
  )
}
