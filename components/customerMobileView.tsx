// components/customerMobileView.tsx
"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MoreVertical, Users, Mail, Phone } from "lucide-react"
import { CustomerWithCount } from "@/lib/api/customers.api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CustomerMobileViewProps {
    customers: CustomerWithCount[]
    onEditClick: (customer: CustomerWithCount) => void
    onDeleteClick: (customer: CustomerWithCount) => void
    onToggleStatus: (customer: CustomerWithCount) => void
}

export function CustomerMobileView({
    customers,
    onEditClick,
    onDeleteClick,
    onToggleStatus
}: CustomerMobileViewProps) {
    const router = useRouter()

    if (customers.length === 0) {
        return (
            <div className="text-center py-12 px-4 text-muted-foreground">
                No customers found. Create your first customer to get started.
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {customers.map((customer) => (
                <div
                    key={customer.id}
                    className="flex items-start gap-3 p-4 active:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                >
                    {/* Customer Icon */}
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                        <Users className="h-5 w-5 text-accent" />
                    </div>

                    {/* Customer Info */}
                    <div className="flex-1 min-w-0">
                        {/* Customer Name & Status */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="font-semibold text-base leading-tight">
                                {customer.name}
                            </h3>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onToggleStatus(customer)
                                }}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 transition-colors flex-shrink-0 ${customer.status === "ACTIVE"
                                    ? "bg-primary/10 text-primary ring-primary/20"
                                    : "bg-muted text-muted-foreground ring-border"
                                    }`}
                            >
                                {customer.status === "ACTIVE" ? "Active" : "Inactive"}
                            </button>
                        </div>

                        {/* Contact Person */}
                        {customer.contactPerson && (
                            <p className="text-sm text-muted-foreground mb-2">
                                {customer.contactPerson}
                            </p>
                        )}

                        {/* Contact Info */}
                        <div className="space-y-1 mb-2">
                            {customer.email && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{customer.email}</span>
                                </div>
                            )}
                            {customer.phone && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{customer.phone}</span>
                                </div>
                            )}
                        </div>

                        {/* Items Count */}
                        {customer._count?.items > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent ring-1 ring-accent/20">
                                    {customer._count.items} {customer._count.items === 1 ? 'item' : 'items'}
                                </span>
                            </div>
                        )}
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
                                router.push(`/dashboard/customers/${customer.id}`)
                            }}>
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                onEditClick(customer)
                            }}>
                                Edit Customer
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                onToggleStatus(customer)
                            }}>
                                {customer.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteClick(customer)
                                }}
                            >
                                Delete Customer
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ))}
        </div>
    )
}