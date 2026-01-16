"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { updateCategoryApi, type CategoryWithCount } from "@/lib/api/categories.api"

interface EditCategoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    category: CategoryWithCount | null
    onSuccess: (category: CategoryWithCount) => void
}

export function EditCategoryDialog({
    open,
    onOpenChange,
    workspaceId,
    category,
    onSuccess,
}: EditCategoryDialogProps) {
    const [formData, setFormData] = useState({ name: "", description: "" })

    // Update form data when category changes
    useEffect(() => {
        if (category) {
            setFormData({ name: category.name, description: category.description || "" })
        }
    }, [category])

    const handleEdit = async () => {
        if (!category || !formData.name.trim()) return

        try {
            const response = await updateCategoryApi(category.id, {
                name: formData.name,
                description: formData.description,
                workspaceId: workspaceId,
            })

            const updatedCategory = response.data?.category
            if (updatedCategory) {
                onSuccess(updatedCategory)
                setFormData({ name: "", description: "" })
                onOpenChange(false)
            }
        } catch (error) {
            console.error("Failed to update category:", error)
            alert(error instanceof Error ? error.message : "Failed to update category")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Category</DialogTitle>
                    <DialogDescription>Update the category name and description.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Category Name</Label>
                        <Input
                            id="edit-name"
                            placeholder="e.g., Electronics, Furniture"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-description">Description</Label>
                        <Textarea
                            id="edit-description"
                            placeholder="Brief description of this category..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleEdit}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}