"use client"

import { SupplierFormDialog } from "@/components/partners/supplier-form-dialog"
import type { SupplierWithCount } from "@/lib/api/suppliers.api"

interface EditSupplierDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    supplier: SupplierWithCount | null
    onSuccess: (supplier: SupplierWithCount) => void
}

export function EditSupplierDialog({ open, onOpenChange, workspaceId, supplier, onSuccess }: EditSupplierDialogProps) {
    return (
        <SupplierFormDialog
            open={open && supplier !== null}
            onOpenChange={onOpenChange}
            workspaceId={workspaceId}
            supplier={supplier}
            onSuccess={onSuccess}
        />
    )
}
