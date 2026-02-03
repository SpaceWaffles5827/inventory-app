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
    const [isCreating, setIsCreating] = useState(false)

    // Prevent body scroll when dialog is open on mobile
    useEffect(() => {
        if (open) {
            // Save original styles
            const originalOverflow = document.body.style.overflow
            const originalPosition = document.body.style.position
            const originalWidth = document.body.style.width

            // Lock body scroll
            document.body.style.overflow = 'hidden'
            document.body.style.position = 'fixed'
            document.body.style.width = '100%'

            return () => {
                // Restore original styles
                document.body.style.overflow = originalOverflow
                document.body.style.position = originalPosition
                document.body.style.width = originalWidth
            }
        }
    }, [open])

    const handleCreate = async () => {
        if (!formData.name.trim()) return

        setIsCreating(true)

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
        } finally {
            setIsCreating(false)
        }
    }

    const isFormValid = formData.name.trim()

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                enableKeyboardAvoidance={true}
                hideClose={true}
                className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                data-testid="add-category-dialog"
            >
                {/* Header */}
                <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                    {/* Mobile Header with Actions */}
                    <div className="flex items-center justify-between gap-2 sm:hidden relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            disabled={isCreating}
                            className="h-9"
                            data-testid="cancel-button-mobile"
                        >
                            Cancel
                        </Button>
                        <DialogTitle className="text-base font-semibold absolute left-1/2 -translate-x-1/2">Create Category</DialogTitle>
                        <Button
                            size="sm"
                            onClick={handleCreate}
                            disabled={!isFormValid || isCreating}
                            className="h-9"
                            data-testid="submit-button-mobile"
                        >
                            {isCreating ? "Creating..." : "Create"}
                        </Button>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden sm:block">
                        <DialogTitle>Create New Category</DialogTitle>
                        <DialogDescription className="mt-1.5">
                            Add a new category to organize your inventory items.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Scrollable Form Content */}
                <div
                    className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                Category Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="e.g., Electronics, Furniture"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-testid="category-name-input"
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
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                data-testid="category-description-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer - Desktop Only */}
                <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isCreating}
                        data-testid="cancel-button-desktop"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={!isFormValid || isCreating}
                        data-testid="submit-button-desktop"
                    >
                        {isCreating ? "Creating..." : "Create Category"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
