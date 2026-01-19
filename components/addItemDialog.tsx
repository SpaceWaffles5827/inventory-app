"use client"

import { useState, useEffect, useRef } from "react"
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
import { Check, ChevronsUpDown, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { createItemApi } from "@/lib/api/items.api"
import { getCategoriesApi, type CategoryWithCount } from "@/lib/api/categories.api"
import { getLocationsApi, getWorkspaceStructureApi, type LocationWithCount, type LocationTemplate } from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"
import { AddCategoryDialog } from "@/components/addCategoryDialog"
import { AddSupplierDialog } from "@/components/addSupplierDialog"
import { AddLocationDialog } from "@/components/addLocationDialog"

interface AddItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workspaceId: string
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
    onSuccess,
}: AddItemDialogProps) {
    const [formData, setFormData] = useState<ItemFormData>(initialFormState)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState("")
    const [categoryOpen, setCategoryOpen] = useState(false)
    const [supplierOpen, setSupplierOpen] = useState(false)
    const [locationOpen, setLocationOpen] = useState(false)

    // Self-managed data
    const [categories, setCategories] = useState<CategoryWithCount[]>([])
    const [locations, setLocations] = useState<LocationWithCount[]>([])
    const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])
    const [defaultLocationStructure, setDefaultLocationStructure] = useState<LocationTemplate | null>(null)
    const [isLoadingData, setIsLoadingData] = useState(false)

    // Sub-dialog states
    const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
    const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false)
    const [isAddLocationOpen, setIsAddLocationOpen] = useState(false)

    // Refs
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const focusedInputRef = useRef<HTMLElement | null>(null)

    // Handle focused input tracking and scrolling
    useEffect(() => {
        if (!open) return

        const handleFocus = (e: FocusEvent) => {
            const target = e.target as HTMLElement
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                focusedInputRef.current = target

                // On mobile, scroll the input into view after a short delay
                setTimeout(() => {
                    if (scrollContainerRef.current && focusedInputRef.current) {
                        const container = scrollContainerRef.current
                        const input = focusedInputRef.current

                        const containerRect = container.getBoundingClientRect()
                        const inputRect = input.getBoundingClientRect()

                        // Calculate how much to scroll
                        const scrollTop = container.scrollTop
                        const inputTop = inputRect.top - containerRect.top
                        const targetScroll = scrollTop + inputTop - 100 // 100px from top

                        container.scrollTo({
                            top: Math.max(0, targetScroll),
                            behavior: 'smooth'
                        })
                    }
                }, 300) // Wait for keyboard to appear
            }
        }

        const handleBlur = () => {
            setTimeout(() => {
                if (document.activeElement?.tagName !== 'INPUT' &&
                    document.activeElement?.tagName !== 'TEXTAREA') {
                    focusedInputRef.current = null
                }
            }, 100)
        }

        document.addEventListener('focusin', handleFocus, true)
        document.addEventListener('focusout', handleBlur, true)

        return () => {
            document.removeEventListener('focusin', handleFocus, true)
            document.removeEventListener('focusout', handleBlur, true)
        }
    }, [open])

    // Load all data when dialog opens
    useEffect(() => {
        if (open && workspaceId) {
            loadAllData()
        }
    }, [open, workspaceId])

    const loadAllData = async () => {
        if (!workspaceId) return

        setIsLoadingData(true)
        try {
            await Promise.all([
                loadCategories(),
                loadLocations(),
                loadSuppliers(),
                loadLocationStructure(),
            ])
        } catch (error) {
            console.error("Failed to load data:", error)
        } finally {
            setIsLoadingData(false)
        }
    }

    const loadCategories = async () => {
        try {
            const response = await getCategoriesApi(workspaceId)
            if (response.data?.categories) {
                setCategories(response.data.categories)
            }
        } catch (err) {
            console.error("Failed to load categories:", err)
        }
    }

    const loadLocations = async () => {
        try {
            const response = await getLocationsApi(workspaceId)
            if (response.data?.locations) {
                setLocations(response.data.locations)
            }
        } catch (err) {
            console.error("Failed to load locations:", err)
        }
    }

    const loadSuppliers = async () => {
        try {
            const response = await getSuppliersApi(workspaceId)
            if (response.data?.suppliers) {
                setSuppliers(response.data.suppliers)
            }
        } catch (err) {
            console.error("Failed to load suppliers:", err)
        }
    }

    const loadLocationStructure = async () => {
        try {
            const response = await getWorkspaceStructureApi(workspaceId)
            if (response.data?.structure) {
                setDefaultLocationStructure(response.data.structure)
            }
        } catch (err) {
            console.error("Failed to load location structure:", err)
        }
    }

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

        const onHand = Number.parseInt(formData.onHand)
        if (onHand > 0 && !formData.storageLocation) {
            setError("Storage location is required when initial stock is greater than 0")
            return false
        }

        return true
    }

    const handleSubmit = async () => {
        if (!validateForm()) return
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

    const handleCategoryCreated = async (category: CategoryWithCount) => {
        await loadCategories()
        updateFormField("category", category.id)
        setCategoryOpen(false)
    }

    const handleSupplierCreated = async (supplier: SupplierWithCount) => {
        await loadSuppliers()
        updateFormField("supplier", supplier.id)
        setSupplierOpen(false)
    }

    const handleLocationCreated = async (location: LocationWithCount) => {
        await loadLocations()
        updateFormField("storageLocation", location.id)
        setLocationOpen(false)
    }

    const handleLocationStructureUpdate = async (structure: LocationTemplate) => {
        setDefaultLocationStructure(structure)
    }

    const isFormValid = formData.name.trim() && formData.onHand && formData.cost

    return (
        <>
            <Dialog open={open} onOpenChange={handleOpenChange}>
                <DialogContent
                    enableKeyboardAvoidance={true}
                    hideClose={true}
                    className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                >
                    {/* Header */}
                    <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                        {/* Mobile Header with Actions */}
                        <div className="flex items-center justify-between gap-2 sm:hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenChange(false)}
                                disabled={isCreating}
                                className="h-9"
                            >
                                Cancel
                            </Button>
                            <DialogTitle className="text-base font-semibold">Add New Item</DialogTitle>
                            <Button
                                size="sm"
                                onClick={handleSubmit}
                                disabled={isCreating || !isFormValid || isLoadingData}
                                className="h-9"
                            >
                                {isCreating ? "Adding..." : "Add"}
                            </Button>
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden sm:block">
                            <DialogTitle>Add New Item</DialogTitle>
                            <DialogDescription className="mt-1.5">
                                Add a new item to your inventory with all required details.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    {/* Scrollable Form Content */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                        style={{
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
                        <div className="space-y-4">
                            {/* Item Name & Unit */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="item-name">
                                        Item Name <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="item-name"
                                        placeholder="e.g., Wireless Mouse"
                                        value={formData.name}
                                        onChange={(e) => updateFormField("name", e.target.value)}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="item-unit">Unit</Label>
                                    <Input
                                        id="item-unit"
                                        placeholder="e.g., EA, BOX, LB, KG, GAL"
                                        value={formData.unit}
                                        onChange={(e) => updateFormField("unit", e.target.value)}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                    />
                                </div>
                            </div>

                            {/* Category & Supplier */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="item-category">Category</Label>
                                    <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={categoryOpen}
                                                className="w-full justify-between h-9 font-normal bg-transparent"
                                                disabled={isLoadingData}
                                            >
                                                {formData.category
                                                    ? categories.find((category) => category.id === formData.category)?.name
                                                    : "Search categories..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search category..." className="h-9" />
                                                <CommandList>
                                                    <CommandEmpty>No category found.</CommandEmpty>
                                                    <CommandGroup>
                                                        <CommandItem
                                                            onSelect={() => {
                                                                setCategoryOpen(false)
                                                                setIsAddCategoryOpen(true)
                                                            }}
                                                            className="bg-primary/5 border-b"
                                                        >
                                                            <Plus className="mr-2 h-4 w-4 text-primary" />
                                                            <span className="font-medium text-primary">Create new category</span>
                                                        </CommandItem>
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
                                    <Label htmlFor="item-supplier">Supplier</Label>
                                    <Popover open={supplierOpen} onOpenChange={setSupplierOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={supplierOpen}
                                                className="w-full justify-between h-9 font-normal bg-transparent"
                                                disabled={isLoadingData}
                                            >
                                                {formData.supplier
                                                    ? suppliers.find((supplier) => supplier.id === formData.supplier)?.name
                                                    : "Search suppliers..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search supplier..." className="h-9" />
                                                <CommandList>
                                                    <CommandEmpty>No supplier found.</CommandEmpty>
                                                    <CommandGroup>
                                                        <CommandItem
                                                            onSelect={() => {
                                                                setSupplierOpen(false)
                                                                setIsAddSupplierOpen(true)
                                                            }}
                                                            className="bg-primary/5 border-b"
                                                        >
                                                            <Plus className="mr-2 h-4 w-4 text-primary" />
                                                            <span className="font-medium text-primary">Create new supplier</span>
                                                        </CommandItem>
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
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                />
                            </div>

                            {/* Initial Stock, Cost, Location */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                                        autoComplete="off"
                                        inputMode="numeric"
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
                                        autoComplete="off"
                                        inputMode="decimal"
                                    />
                                </div>
                                <div className="space-y-2 col-span-2 md:col-span-1">
                                    <Label htmlFor="item-location">Storage Location</Label>
                                    <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={locationOpen}
                                                className="w-full justify-between h-9 font-normal bg-transparent"
                                                disabled={isLoadingData}
                                            >
                                                {formData.storageLocation
                                                    ? locations.find((location) => location.id === formData.storageLocation)?.code
                                                    : "Search locations..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search location..." className="h-9" />
                                                <CommandList>
                                                    <CommandEmpty>No location found.</CommandEmpty>
                                                    <CommandGroup>
                                                        <CommandItem
                                                            onSelect={() => {
                                                                setLocationOpen(false)
                                                                setIsAddLocationOpen(true)
                                                            }}
                                                            className="bg-primary/5 border-b"
                                                        >
                                                            <Plus className="mr-2 h-4 w-4 text-primary" />
                                                            <span className="font-medium text-primary">Create new location</span>
                                                        </CommandItem>
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
                    </div>

                    {/* Footer - Desktop Only */}
                    <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                        <Button
                            variant="outline"
                            onClick={() => handleOpenChange(false)}
                            disabled={isCreating}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isCreating || !isFormValid || isLoadingData}
                        >
                            {isCreating ? "Creating..." : "Add Item"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Nested Dialogs */}
            <AddCategoryDialog
                open={isAddCategoryOpen}
                onOpenChange={setIsAddCategoryOpen}
                workspaceId={workspaceId}
                onSuccess={handleCategoryCreated}
            />

            <AddSupplierDialog
                open={isAddSupplierOpen}
                onOpenChange={setIsAddSupplierOpen}
                workspaceId={workspaceId}
                onSuccess={handleSupplierCreated}
            />

            <AddLocationDialog
                open={isAddLocationOpen}
                onOpenChange={setIsAddLocationOpen}
                workspaceId={workspaceId}
                defaultStructure={defaultLocationStructure}
                onSuccess={handleLocationCreated}
                onStructureUpdate={handleLocationStructureUpdate}
            />
        </>
    )
}