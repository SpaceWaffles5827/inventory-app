"use client"

import { CategoryFormDialog } from "@/components/catalog/category-form-dialog"
import type { CategoryWithCount } from "@/lib/api/categories.api"

interface EditCategoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    category: CategoryWithCount | null
    onSuccess: (category: CategoryWithCount) => void
}

export function EditCategoryDialog({ open, onOpenChange, workspaceId, category, onSuccess }: EditCategoryDialogProps) {
    return (
        <CategoryFormDialog
            open={open && category !== null}
            onOpenChange={onOpenChange}
            workspaceId={workspaceId}
            category={category}
            onSuccess={onSuccess}
        />
    )
}
