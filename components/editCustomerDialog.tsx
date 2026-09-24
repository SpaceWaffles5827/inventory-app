"use client"

import { CustomerFormDialog } from "@/components/partners/customer-form-dialog"
import type { CustomerWithCount } from "@/lib/api/customers.api"

interface EditCustomerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    customer: CustomerWithCount | null
    workspaceId: string
    onSuccess: (customer: CustomerWithCount) => void
}

export function EditCustomerDialog({ open, onOpenChange, customer, workspaceId, onSuccess }: EditCustomerDialogProps) {
    return (
        <CustomerFormDialog
            open={open && customer !== null}
            onOpenChange={onOpenChange}
            workspaceId={workspaceId}
            customer={customer}
            onSuccess={onSuccess}
        />
    )
}
