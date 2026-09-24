"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Clock,
  DollarSign,
  Layers,
  Link2,
  Mail,
  MapPin,
  Package,
  Pencil,
  Phone,
  Power,
  SearchX,
  Trash2,
  Unlink,
  User,
  Users,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageContainer, PageHeader, SectionHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { StockStatusBadge } from "@/components/common/status-badge"
import { useConfirm } from "@/components/common/confirm-provider"
import { ActiveBadge } from "@/components/partners/contact-details"
import { RowActions } from "@/components/partners/row-actions"
import { Pagination, clampPage } from "@/components/partners/pagination"
import { EditCustomerDialog } from "@/components/editCustomerDialog"
import {
  deleteCustomerApi,
  detachItemFromCustomerApi,
  getCustomerByIdApi,
  updateCustomerApi,
  type CustomerWithCount,
  type CustomerWithItems,
} from "@/lib/api/customers.api"
import { ApiError, getErrorMessage } from "@/lib/api/client"
import { useWorkspace } from "@/lib/workspace-context"
import { formatCurrency, formatCurrencyCompact, formatDate, formatNumber, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import CustomerDetailLoading from "./loading"

type LinkedItem = CustomerWithItems["items"][number]

const PAGE_SIZE = 10

export default function CustomerDetailPage() {
  const params = useParams<{ customerId: string }>()
  const customerId = params.customerId
  const router = useRouter()
  const confirm = useConfirm()
  const { workspaceId, isAdmin } = useWorkspace()

  const [customer, setCustomer] = useState<CustomerWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [query, setQuery] = useState("")
  const [page, setPage] = useState(1)
  const [editOpen, setEditOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setNotFound(false)
    try {
      const res = await getCustomerByIdApi(customerId, workspaceId)
      const found = res.data?.customer as CustomerWithItems | undefined
      if (!found) setNotFound(true)
      else setCustomer({ ...found, items: found.items ?? [] })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else setError(getErrorMessage(err, "Couldn't load this customer"))
    } finally {
      setLoading(false)
    }
  }, [customerId, workspaceId])

  useEffect(() => {
    load()
  }, [load])

  const linked = useMemo(() => customer?.items ?? [], [customer])

  const stats = useMemo(() => {
    let units = 0
    let value = 0
    let low = 0
    for (const link of linked) {
      units += link.item.onHand
      value += link.item.onHand * link.item.cost
      if (link.item.status === "LOW_STOCK" || link.item.status === "OUT_OF_STOCK") low += 1
    }
    return { units, value, low }
  }, [linked])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return linked
    return linked.filter(
      (link) => link.item.name.toLowerCase().includes(q) || link.item.itemNumber.toLowerCase().includes(q)
    )
  }, [linked, query])

  const currentPage = clampPage(page, filtered.length, PAGE_SIZE)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleEdited = (updated: CustomerWithCount) => {
    setCustomer((prev) => (prev ? { ...prev, ...updated, items: prev.items, _count: prev._count } : prev))
  }

  const toggleStatus = async () => {
    if (!customer) return
    const previous = customer.status
    const next = previous === "ACTIVE" ? "INACTIVE" : "ACTIVE"
    setCustomer((prev) => (prev ? { ...prev, status: next } : prev))
    try {
      await updateCustomerApi(customer.id, { status: next, workspaceId })
      toast.success(`${customer.name} marked as ${next === "ACTIVE" ? "active" : "inactive"}`)
    } catch (err) {
      setCustomer((prev) => (prev ? { ...prev, status: previous } : prev))
      toast.error(getErrorMessage(err, "Couldn't update the customer"))
    }
  }

  const handleDelete = async () => {
    if (!customer) return
    if (linked.length > 0) {
      toast.error(`Can't delete ${customer.name}`, {
        description: `${formatNumber(linked.length)} ${linked.length === 1 ? "item is" : "items are"} linked to this customer. Unlink them below first, or mark the customer as inactive instead.`,
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
      toast.success(`${customer.name} deleted`)
      router.push("/dashboard/customers")
    }
  }

  const handleUnlink = async (link: LinkedItem) => {
    if (!customer) return
    const unlinked = await confirm({
      title: `Unlink ${link.item.name}?`,
      description: `It will no longer be listed under ${customer.name}. The item itself and its stock aren't changed, and you can link it again from the item's page.`,
      confirmLabel: "Unlink item",
      destructive: true,
      action: async () => {
        try {
          await detachItemFromCustomerApi(customer.id, link.item.id)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't unlink the item"))
          throw err
        }
      },
    })
    if (unlinked) {
      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((l) => l.id !== link.id),
              _count: { ...prev._count, items: Math.max(0, prev._count.items - 1) },
            }
          : prev
      )
      toast.success(`${link.item.name} unlinked`)
    }
  }

  const back = { href: "/dashboard/customers", label: "All customers" }

  if (loading) return <CustomerDetailLoading />

  if (notFound) {
    return (
      <PageContainer>
        <PageHeader title="Customer not found" back={back} />
        <EmptyState
          icon={Users}
          title="This customer doesn't exist"
          description="They may have been deleted, or the link points to a different workspace."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/customers">Back to customers</Link>
            </Button>
          }
        />
      </PageContainer>
    )
  }

  if (error || !customer) {
    return (
      <PageContainer>
        <PageHeader title="Customer" back={back} />
        <ErrorState title="Couldn't load this customer" message={error ?? undefined} onRetry={load} />
      </PageContainer>
    )
  }

  const active = customer.status === "ACTIVE"
  const company = customer.company && customer.company !== customer.name ? customer.company : null
  const hasManualHistory = customer.orderCount > 0 || customer.totalSpent > 0

  return (
    <PageContainer>
      <PageHeader
        back={back}
        title={<span className="break-words">{customer.name}</span>}
        description={company ?? customer.contactPerson ?? undefined}
        meta={
          <>
            <ActiveBadge active={active} />
            <span className="text-xs text-muted-foreground">Customer since {formatDate(customer.createdAt)}</span>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)} data-testid="edit-customer-button">
              <Pencil /> Edit
            </Button>
            <RowActions
              className="border bg-background"
              label="More actions"
              data-testid="customer-more-actions"
              actions={[
                { label: active ? "Mark as inactive" : "Mark as active", icon: Power, onSelect: toggleStatus },
                {
                  label: "Delete customer",
                  icon: Trash2,
                  destructive: true,
                  separated: true,
                  hidden: !isAdmin,
                  onSelect: handleDelete,
                },
              ]}
            />
          </>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <StatCard
            label="Linked items"
            value={formatNumber(linked.length)}
            icon={Link2}
            tone="primary"
            hint="Items associated with this customer"
          />
          <StatCard label="Units on hand" value={formatNumber(stats.units)} icon={Layers} hint="Of the linked items" />
          <StatCard
            label="Stock value"
            value={formatCurrencyCompact(stats.value)}
            icon={DollarSign}
            tone="success"
            hint="On hand × unit cost"
          />
          <StatCard
            label="Low stock"
            value={formatNumber(stats.low)}
            icon={AlertTriangle}
            tone={stats.low > 0 ? "warning" : "default"}
            hint={stats.low > 0 ? "Linked items to restock" : "Everything is stocked"}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Contact card first in the DOM so it sits above the items on phones */}
          <section className="h-fit overflow-hidden rounded-xl border bg-card lg:col-start-3 lg:row-start-1">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <h2 className="text-base font-semibold tracking-tight">Contact details</h2>
              <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil /> Edit
              </Button>
            </div>
            <dl className="divide-y">
              <DetailRow icon={User} label="Contact person" value={customer.contactPerson} />
              {company && <DetailRow icon={Building2} label="Company" value={company} />}
              <DetailRow
                icon={Mail}
                label="Email"
                value={
                  customer.email && (
                    <a href={`mailto:${customer.email}`} className="break-all text-primary hover:underline">
                      {customer.email}
                    </a>
                  )
                }
              />
              <DetailRow
                icon={Phone}
                label="Phone"
                value={
                  customer.phone && (
                    <a
                      href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`}
                      className="text-primary tabular-nums hover:underline"
                    >
                      {customer.phone}
                    </a>
                  )
                }
              />
              <DetailRow
                icon={MapPin}
                label="Address"
                value={customer.address && <span className="whitespace-pre-line">{customer.address}</span>}
              />
              <DetailRow icon={CalendarDays} label="Customer since" value={formatDate(customer.createdAt)} />
              <DetailRow icon={Clock} label="Last updated" value={formatRelativeTime(customer.updatedAt)} />
            </dl>
            {hasManualHistory && (
              <div className="border-t bg-muted/30 px-5 py-4">
                <p className="text-sm font-medium">Recorded order history</p>
                <p className="text-xs text-muted-foreground">Entered manually — not calculated from stock movements.</p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Orders</dt>
                    <dd className="font-medium tabular-nums">{formatNumber(customer.orderCount)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total spent</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(customer.totalSpent)}</dd>
                  </div>
                </dl>
              </div>
            )}
          </section>

          <section className="min-w-0 space-y-4 lg:col-span-2 lg:row-start-1">
            <SectionHeader
              title="Linked items"
              description="Link or unlink customers from an item's page."
              actions={linked.length > 0 && <Badge variant="secondary">{formatNumber(linked.length)}</Badge>}
            />

            {linked.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No linked items yet"
                description={`Open an item and add ${customer.name} under Customers to track what you supply them.`}
                action={
                  <Button asChild variant="outline">
                    <Link href="/dashboard/items">Browse items</Link>
                  </Button>
                }
              />
            ) : (
              <>
                {linked.length > PAGE_SIZE && (
                  <SearchInput
                    value={query}
                    onValueChange={(value) => {
                      setQuery(value)
                      setPage(1)
                    }}
                    placeholder="Search linked items…"
                    aria-label="Search linked items"
                    className="sm:max-w-sm"
                  />
                )}

                {filtered.length === 0 ? (
                  <EmptyState
                    icon={SearchX}
                    title="No linked items match"
                    description={`Nothing matches “${query.trim()}”.`}
                    action={
                      <Button variant="outline" onClick={() => setQuery("")}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  <>
                    <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="h-11 pl-4 text-muted-foreground">Item</TableHead>
                            <TableHead className="h-11 text-muted-foreground">Status</TableHead>
                            <TableHead className="h-11 text-right text-muted-foreground">On hand</TableHead>
                            <TableHead className="hidden h-11 text-right text-muted-foreground xl:table-cell">
                              Unit cost
                            </TableHead>
                            <TableHead className="h-11 text-right text-muted-foreground">Value</TableHead>
                            <TableHead className="h-11 w-14 pr-4">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pageRows.map((link) => (
                            <TableRow
                              key={link.id}
                              className="cursor-pointer"
                              onClick={() => router.push(`/dashboard/items/${link.item.id}`)}
                            >
                              <TableCell className="w-full max-w-0 py-3 pl-4">
                                <Link
                                  href={`/dashboard/items/${link.item.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="block truncate font-medium hover:underline"
                                >
                                  {link.item.name}
                                </Link>
                                <p className="truncate font-mono text-xs text-muted-foreground">{link.item.itemNumber}</p>
                              </TableCell>
                              <TableCell>
                                <StockStatusBadge status={link.item.status} />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{formatNumber(link.item.onHand)}</TableCell>
                              <TableCell className="hidden text-right tabular-nums xl:table-cell">
                                {formatCurrency(link.item.cost)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(link.item.onHand * link.item.cost)}
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <UnlinkButton name={link.item.name} onClick={() => handleUnlink(link)} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <ul className="divide-y overflow-hidden rounded-xl border bg-card md:hidden">
                      {pageRows.map((link) => (
                        <li key={link.id} className="relative flex items-center gap-3 p-4 active:bg-accent/60">
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/dashboard/items/${link.item.id}`}
                              className="block truncate font-medium after:absolute after:inset-0 after:content-['']"
                            >
                              {link.item.name}
                            </Link>
                            <p className="truncate font-mono text-xs text-muted-foreground">{link.item.itemNumber}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <StockStatusBadge status={link.item.status} />
                              <span className="tabular-nums text-muted-foreground">
                                {formatNumber(link.item.onHand)} on hand · {formatCurrency(link.item.onHand * link.item.cost)}
                              </span>
                            </div>
                          </div>
                          <UnlinkButton name={link.item.name} onClick={() => handleUnlink(link)} className="relative z-10" />
                        </li>
                      ))}
                    </ul>

                    <Pagination
                      page={currentPage}
                      pageSize={PAGE_SIZE}
                      total={filtered.length}
                      onPageChange={setPage}
                      noun="items"
                    />
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      <EditCustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        workspaceId={workspaceId}
        customer={customer}
        onSuccess={handleEdited}
      />
    </PageContainer>
  )
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-5 py-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm">{value || <span className="text-muted-foreground">Not provided</span>}</dd>
      </div>
    </div>
  )
}

function UnlinkButton({ name, onClick, className }: { name: string; onClick: () => void; className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-10 text-muted-foreground hover:text-destructive md:size-9", className)}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      aria-label={`Unlink ${name}`}
      title="Unlink from this customer"
    >
      <Unlink />
    </Button>
  )
}
