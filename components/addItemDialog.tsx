"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { createItemApi } from "@/lib/api/items.api"
import type { CategoryWithCount } from "@/lib/api/categories.api"
import type { LocationWithCount } from "@/lib/api/locations.api"
import type { SupplierWithCount } from "@/lib/api/suppliers.api"

interface AddItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
    categories: CategoryWithCount[]
    locations: LocationWithCount[]
    suppliers: SupplierWithCount[]
    onSuccess?: () => void
}

interface ItemFormData {
    name: string
    unit: string
    category: string
    description: string
    supplier: string
    onHand: string
    storageLocation: string
    cost: string
}

const initialFormState: ItemFormData = {
    name: "",
    unit: "",
    category: "",
    description: "",
    supplier: "",
    onHand: "",
    storageLocation: "",
    cost: "",
}

export function AddItemDialog({
    open,
    onOpenChange,
    workspaceId,
    categories,
    locations,
    suppliers,
    onSuccess,
}: AddItemDialogProps) {
    const [formData, setFormData] = useState<ItemFormData>(initialFormState)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState("")

    // Reset form when dialog closes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setFormData(initialFormState)
            setError("")
        }
        onOpenChange(newOpen)
    }

    const updateFormField = (field: keyof ItemFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }))
        // Clear error when user starts typing
        if (error) setError("")
    }

    const validateForm = (): boolean => {
        if (!formData.name.trim()) {
            setError("Item name is required")
            return false
        }
        if (!formData.onHand) {
            setError("Initial stock is required")
            return false
        }
        if (!formData.cost) {
            setError("Unit cost is required")
            return false
        }

        // If they have inventory, they must specify a location
        const onHand = Number.parseInt(formData.onHand)
        if (onHand > 0 && !formData.storageLocation) {
            setError("Storage location is required when initial stock is greater than 0")
            return false
        }

        return true
    }

    const handleSubmit = async () => {
        if (!validateForm()) {
            return
        }

        if (!workspaceId) {
            setError("No workspace selected. Please select a workspace first.")
            return
        }

        setIsCreating(true)
        setError("")

        try {
            const onHand = Number.parseInt(formData.onHand)
            const cost = Number.parseFloat(formData.cost)

            if (isNaN(onHand) || onHand < 0) {
                setError("Initial stock must be a valid positive number")
                return
            }

            if (isNaN(cost) || cost < 0) {
                setError("Unit cost must be a valid positive number")
                return
            }

            const response = await createItemApi({
                workspaceId: workspaceId,
                name: formData.name,
                barcode: undefined,
                unit: formData.unit || undefined,
                description: formData.description || undefined,
                onHand: onHand,
                cost: cost,
                categoryId: formData.category || undefined,
                locationId: formData.storageLocation || undefined,
                supplierId: formData.supplier || undefined,
            })

            if (response.data?.item) {
                toast.success("Item created successfully")
                setFormData(initialFormState)
                onSuccess?.()
                onOpenChange(false)
            }
        } catch (err) {
            console.error("Create item error:", err)
            setError(err instanceof Error ? err.message : "Failed to create item")
        } finally {
            setIsCreating(false)
        }
    }

    const isFormValid =
        formData.name.trim() &&
        formData.onHand &&
        formData.cost

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add New Item</DialogTitle>
                    <DialogDescription>
                        Add a new item to your inventory with all required details.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Item Name & Unit */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="item-name">
                                Item Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="item-name"
                                placeholder="e.g., Wireless Mouse"
                                value={formData.name}
                                onChange={(e) => updateFormField("name", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-unit">Unit</Label>
                            <Input
                                id="item-unit"
                                placeholder="e.g., EA, BOX, LB, KG, GAL"
                                value={formData.unit}
                                onChange={(e) => updateFormField("unit", e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Initial Stock, Cost, Location */}
                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="item-onhand">
                                Initial Stock <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="item-onhand"
                                type="number"
                                min="0"
                                placeholder="0"
                                value={formData.onHand}
                                onChange={(e) => updateFormField("onHand", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-cost">
                                Unit Cost <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="item-cost"
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={formData.cost}
                                onChange={(e) => updateFormField("cost", e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-location">
                                Storage Location
                                {formData.onHand && Number.parseInt(formData.onHand) > 0 && (
                                    <span className="text-destructive">*</span>
                                )}
                            </Label>
                            <Select
                                value={formData.storageLocation}
                                onValueChange={(value) => updateFormField("storageLocation", value)}
                            >
                                <SelectTrigger id="item-location">
                                    <SelectValue placeholder="Select location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations.length > 0 ? (
                                        locations.map((location) => (
                                            <SelectItem key={location.id} value={location.id}>
                                                {location.code}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-sm text-muted-foreground">
                                            No locations available
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Category & Supplier */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="item-category">
                                Category
                            </Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value) => updateFormField("category", value)}
                            >
                                <SelectTrigger id="item-category">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.length > 0 ? (
                                        categories.map((category) => (
                                            <SelectItem key={category.id} value={category.id}>
                                                {category.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-sm text-muted-foreground">
                                            No categories available
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-supplier">
                                Supplier
                            </Label>
                            <Select
                                value={formData.supplier}
                                onValueChange={(value) => updateFormField("supplier", value)}
                            >
                                <SelectTrigger id="item-supplier">
                                    <SelectValue placeholder="Select supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.length > 0 ? (
                                        suppliers.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <div className="p-2 text-sm text-muted-foreground">
                                            No suppliers available
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="item-description">Description</Label>
                        <Textarea
                            id="item-description"
                            placeholder="Brief description of the item..."
                            value={formData.description}
                            onChange={(e) => updateFormField("description", e.target.value)}
                            rows={3}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            {error}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isCreating}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isCreating || !isFormValid}
                    >
                        {isCreating ? "Creating..." : "Add Item"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}