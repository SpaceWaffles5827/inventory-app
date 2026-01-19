// components/supplierMobileView.tsx
"use client"

import { Button } from "@/components/ui/button"
import { MoreVertical, Users, Mail, Phone } from "lucide-react"
import { SupplierWithCount } from "@/lib/api/suppliers.api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SupplierMobileViewProps {
    suppliers: SupplierWithCount[]
    onEditClick: (supplier: SupplierWithCount) => void
    onDeleteClick: (id: string) => void
    onToggleStatus: (supplier: SupplierWithCount) => void
}

export function SupplierMobileView({
    suppliers,
    onEditClick,
    onDeleteClick,
    onToggleStatus
}: SupplierMobileViewProps) {
    if (suppliers.length === 0) {
        return (
            <div className="text-center py-12 px-4 text-muted-foreground">
                No suppliers found. Create your first supplier to get started.
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {suppliers.map((supplier) => (
                <div
                    key={supplier.id}
                    className="flex items-start gap-3 p-4 active:bg-muted/50 transition-colors"
                >
                    {/* Supplier Icon */}
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-accent" />
                    </div>

                    {/* Supplier Info */}
                    <div className="flex-1 min-w-0">
                        {/* Supplier Name & Status */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-semibold text-base leading-tight">
                                {supplier.name}
                            </h3>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleStatus(supplier)
                                }}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 transition-colors flex-shrink-0 ${supplier.isActive
                                    ? "bg-primary/10 text-primary ring-primary/20"
                                    : "bg-muted text-muted-foreground ring-border"
                                    }`}
                            >
                                {supplier.isActive ? "Active" : "Inactive"}
                            </button>
                        </div>

                        {/* Contact Person */}
                        {supplier.contactPerson && (
                            <p className="text-sm text-muted-foreground mb-2">
                                {supplier.contactPerson}
                            </p>
                        )}

                        {/* Contact Info */}
                        <div className="space-y-1 mb-2">
                            {supplier.email && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{supplier.email}</span>
                                </div>
                            )}
                            {supplier.phone && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{supplier.phone}</span>
                                </div>
                            )}
                        </div>

                        {/* Items Count */}
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent ring-1 ring-accent/20">
                                {supplier._count?.items || 0} items
                            </span>
                        </div>
                    </div>

                    {/* Actions Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-10 w-10"
                            >
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                onEditClick(supplier)
                            }}>
                                Edit Supplier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                onToggleStatus(supplier)
                            }}>
                                {supplier.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteClick(supplier.id)
                                }}
                            >
                                Delete Supplier
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ))}
        </div>
    )
}