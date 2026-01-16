"use client"

import { useState } from "react"
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
import { createCategoryApi, type CategoryWithCount } from "@/lib/api/categories.api"

interface AddCategoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    onSuccess: (category: CategoryWithCount) => void
}

export function AddCategoryDialog({
    open,
    onOpenChange,
    workspaceId,
    onSuccess,
}: AddCategoryDialogProps) {
    const [formData, setFormData] = useState({ name: "", description: "" })

    const handleCreate = async () => {
        if (!formData.name.trim()) return

        try {
            const response = await createCategoryApi({
                name: formData.name,
                description: formData.description,
                workspaceId: workspaceId,
            })

            if (response.data?.category) {
                onSuccess(response.data.category)
                setFormData({ name: "", description: "" })
                onOpenChange(false)
            }
        } catch (error) {
            console.error("Failed to create category:", error)
            alert(error instanceof Error ? error.message : "Failed to create category")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Category</DialogTitle>
                    <DialogDescription>Add a new category to organize your inventory items.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Category Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g., Electronics, Furniture"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
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
                    <Button onClick={handleCreate}>Create Category</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}