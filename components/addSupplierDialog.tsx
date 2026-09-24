"use client"

import { SupplierFormDialog } from "@/components/partners/supplier-form-dialog"
import type { SupplierWithCount } from "@/lib/api/suppliers.api"

interface AddSupplierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    onSuccess: (supplier: SupplierWithCount) => void
}

/** Create a supplier. Also used inline from the Add item dialog. */
export function AddSupplierDialog({ open, onOpenChange, workspaceId, onSuccess }: AddSupplierDialogProps) {
    return (
        <SupplierFormDialog
            open={open}
            onOpenChange={onOpenChange}
            workspaceId={workspaceId}
            supplier={null}
            onSuccess={onSuccess}
        />
    )
}
