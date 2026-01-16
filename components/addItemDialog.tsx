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
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
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
    const [categoryOpen, setCategoryOpen] = useState(false)
    const [supplierOpen, setSupplierOpen] = useState(false)
    const [locationOpen, setLocationOpen] = useState(false)

    // Reset form when dialog closes
    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setFormData(initialFormState)
            setError("")
            setCategoryOpen(false)
            setSupplierOpen(false)
            setLocationOpen(false)
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

                    {/* Category & Supplier */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="item-category">
                                Category
                            </Label>
                            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={categoryOpen}
                                        className="w-full justify-between h-9 font-normal bg-transparent"
                                    >
                                        {formData.category
                                            ? categories.find((category) => category.id === formData.category)?.name
                                            : "Search categories..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search category..." />
                                        <CommandList>
                                            <CommandEmpty>No category found.</CommandEmpty>
                                            <CommandGroup>
                                                {categories.map((category) => (
                                                    <CommandItem
                                                        key={category.id}
                                                        value={category.name}
                                                        onSelect={() => {
                                                            updateFormField("category", category.id)
                                                            setCategoryOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.category === category.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {category.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="item-supplier">
                                Supplier
                            </Label>
                            <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={supplierOpen}
                                        className="w-full justify-between h-9 font-normal bg-transparent"
                                    >
                                        {formData.supplier
                                            ? suppliers.find((supplier) => supplier.id === formData.supplier)?.name
                                            : "Search suppliers..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search supplier..." />
                                        <CommandList>
                                            <CommandEmpty>No supplier found.</CommandEmpty>
                                            <CommandGroup>
                                                {suppliers.map((supplier) => (
                                                    <CommandItem
                                                        key={supplier.id}
                                                        value={supplier.name}
                                                        onSelect={() => {
                                                            updateFormField("supplier", supplier.id)
                                                            setSupplierOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.supplier === supplier.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {supplier.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
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
                            <Label htmlFor="item-location">Storage Location</Label>
                            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={locationOpen}
                                        className="w-full justify-between h-9 font-normal bg-transparent"
                                    >
                                        {formData.storageLocation
                                            ? locations.find((location) => location.id === formData.storageLocation)?.code
                                            : "Search locations..."}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search location..." />
                                        <CommandList>
                                            <CommandEmpty>No location found.</CommandEmpty>
                                            <CommandGroup>
                                                {locations.map((location) => (
                                                    <CommandItem
                                                        key={location.id}
                                                        value={location.code}
                                                        onSelect={() => {
                                                            updateFormField("storageLocation", location.id)
                                                            setLocationOpen(false)
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 h-4 w-4",
                                                                formData.storageLocation === location.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {location.code}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
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