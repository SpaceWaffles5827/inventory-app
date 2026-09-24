"use client"

import { CategoryFormDialog } from "@/components/catalog/category-form-dialog"
import type { CategoryWithCount } from "@/lib/api/categories.api"

interface AddCategoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    onSuccess: (category: CategoryWithCount) => void
}

/** Create a category. Also used inline from the Add item dialog. */
export function AddCategoryDialog({ open, onOpenChange, workspaceId, onSuccess }: AddCategoryDialogProps) {
    return (
        <CategoryFormDialog
            open={open}
            onOpenChange={onOpenChange}
            workspaceId={workspaceId}
            category={null}
            onSuccess={onSuccess}
        />
    )
}
