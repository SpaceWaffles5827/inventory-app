"use client"

import { CustomerFormDialog } from "@/components/partners/customer-form-dialog"
import type { CustomerWithCount } from "@/lib/api/customers.api"

interface AddCustomerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    onSuccess: (customer: CustomerWithCount) => void
}

export function AddCustomerDialog({ open, onOpenChange, workspaceId, onSuccess }: AddCustomerDialogProps) {
    return (
        <CustomerFormDialog
            open={open}
            onOpenChange={onOpenChange}
            workspaceId={workspaceId}
            customer={null}
            onSuccess={onSuccess}
        />
    )
}
