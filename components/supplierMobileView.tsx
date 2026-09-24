"use client"

import { Pencil, Power, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { ActiveBadge, ContactLinks } from "@/components/partners/contact-details"
import { RowActions } from "@/components/partners/row-actions"
import type { SupplierWithCount } from "@/lib/api/suppliers.api"
import { formatNumber, getInitials } from "@/lib/format"

interface SupplierMobileViewProps {
    suppliers: SupplierWithCount[]
    onEditClick: (supplier: SupplierWithCount) => void
    /** Omit to hide the delete action (non-admins) */
    onDeleteClick?: (supplier: SupplierWithCount) => void
    onToggleStatus: (supplier: SupplierWithCount, active: boolean) => void
    /** Suppliers whose active toggle is being saved */
    pendingIds?: ReadonlySet<string>
}

/** Stacked card list of suppliers for phones (the page shows a table from `md` up). */
export function SupplierMobileView({
    suppliers,
    onEditClick,
    onDeleteClick,
    onToggleStatus,
    pendingIds,
}: SupplierMobileViewProps) {
    return (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {suppliers.map((supplier) => {
                const items = supplier._count?.items ?? 0
                const switchId = `supplier-active-mobile-${supplier.id}`
                return (
                    <li key={supplier.id} className="p-4" data-testid={`supplier-row-${supplier.id}`}>
                        <div className="flex items-start gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                                {getInitials(supplier.name)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex min-w-0 items-center gap-2">
                                    <p className="min-w-0 truncate font-medium">{supplier.name}</p>
                                    {!supplier.isActive && <ActiveBadge active={false} />}
                                </div>
                                {supplier.contactPerson && (
                                    <p className="truncate text-sm text-muted-foreground">{supplier.contactPerson}</p>
                                )}
                                <ContactLinks email={supplier.email} phone={supplier.phone} className="mt-1.5" />
                            </div>
                            <RowActions
                                className="-mr-2 -mt-2"
                                label={`Actions for ${supplier.name}`}
                                actions={[
                                    { label: "Edit", icon: Pencil, onSelect: () => onEditClick(supplier) },
                                    {
                                        label: supplier.isActive ? "Mark as inactive" : "Mark as active",
                                        icon: Power,
                                        onSelect: () => onToggleStatus(supplier, !supplier.isActive),
                                    },
                                    {
                                        label: "Delete",
                                        icon: Trash2,
                                        destructive: true,
                                        separated: true,
                                        hidden: !onDeleteClick,
                                        onSelect: () => onDeleteClick?.(supplier),
                                    },
                                ]}
                            />
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 pl-[52px]">
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {formatNumber(items)} {items === 1 ? "item" : "items"} supplied
                            </span>
                            <label
                                htmlFor={switchId}
                                className="-my-2 flex cursor-pointer items-center gap-2 py-2 text-sm text-muted-foreground"
                            >
                                Active
                                <Switch
                                    id={switchId}
                                    checked={supplier.isActive}
                                    onCheckedChange={(checked) => onToggleStatus(supplier, checked)}
                                    disabled={pendingIds?.has(supplier.id)}
                                    aria-label={`${supplier.name} is active`}
                                />
                            </label>
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
