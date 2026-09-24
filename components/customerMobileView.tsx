"use client"

import Link from "next/link"
import { Eye, Pencil, Power, Trash2 } from "lucide-react"
import { ActiveBadge, ContactLinks } from "@/components/partners/contact-details"
import { RowActions } from "@/components/partners/row-actions"
import type { CustomerWithCount } from "@/lib/api/customers.api"
import { formatNumber, getInitials } from "@/lib/format"

interface CustomerMobileViewProps {
    customers: CustomerWithCount[]
    onEditClick: (customer: CustomerWithCount) => void
    /** Omit to hide the delete action (non-admins) */
    onDeleteClick?: (customer: CustomerWithCount) => void
    onToggleStatus: (customer: CustomerWithCount) => void
}

/** Stacked card list of customers for phones (the page shows a table from `md` up). */
export function CustomerMobileView({ customers, onEditClick, onDeleteClick, onToggleStatus }: CustomerMobileViewProps) {
    return (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {customers.map((customer) => {
                const href = `/dashboard/customers/${customer.id}`
                const items = customer._count?.items ?? 0
                const active = customer.status === "ACTIVE"
                const subtitle = customer.company && customer.company !== customer.name ? customer.company : customer.contactPerson
                return (
                    <li
                        key={customer.id}
                        className="relative flex items-start gap-3 p-4 transition-colors active:bg-accent/60"
                        data-testid={`customer-row-${customer.id}`}
                    >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {getInitials(customer.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <Link
                                    href={href}
                                    className="min-w-0 truncate font-medium after:absolute after:inset-0 after:content-['']"
                                >
                                    {customer.name}
                                </Link>
                                {!active && <ActiveBadge active={false} />}
                            </div>
                            {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
                            <ContactLinks
                                email={customer.email}
                                phone={customer.phone}
                                className="relative z-10 mt-1.5 w-fit max-w-full"
                            />
                            <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                                {formatNumber(items)} linked {items === 1 ? "item" : "items"}
                            </p>
                        </div>
                        <RowActions
                            className="relative z-10 -mr-2 -mt-2"
                            label={`Actions for ${customer.name}`}
                            actions={[
                                { label: "View details", icon: Eye, href },
                                { label: "Edit", icon: Pencil, onSelect: () => onEditClick(customer) },
                                {
                                    label: active ? "Mark as inactive" : "Mark as active",
                                    icon: Power,
                                    onSelect: () => onToggleStatus(customer),
                                },
                                {
                                    label: "Delete",
                                    icon: Trash2,
                                    destructive: true,
                                    separated: true,
                                    hidden: !onDeleteClick,
                                    onSelect: () => onDeleteClick?.(customer),
                                },
                            ]}
                        />
                    </li>
                )
            })}
        </ul>
    )
}
