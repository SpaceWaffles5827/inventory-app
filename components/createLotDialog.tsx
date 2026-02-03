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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { MapPin, PackageCheck, Loader2 } from "lucide-react"
import { getItemByIdApi, type ItemWithDetails } from "@/lib/api/items.api"
import { createLotApi } from "@/lib/api/lots.api"
import { type SupplierWithCount } from "@/lib/api/suppliers.api"
import { type LocationWithCount } from "@/lib/api/locations.api"
import { toast } from "sonner"

interface CreateLotDialogProps {
    isOpen: boolean
    onClose: () => void
    itemId: string
    itemLocations: Array<{ locationId: string }>
    suppliers: SupplierWithCount[]
    locations: LocationWithCount[]
    onSuccess: (updatedItem: ItemWithDetails) => void
    onLotsReload: () => Promise<void>
}

export function CreateLotDialog({
    isOpen,
    onClose,
    itemId,
    itemLocations,
    suppliers,
    locations,
    onSuccess,
    onLotsReload,
}: CreateLotDialogProps) {
    const [isSaving, setIsSaving] = useState(false)
    const [isStep2Open, setIsStep2Open] = useState(false)

    const [lotFormData, setLotFormData] = useState({
        lotNumber: "",
        quantity: "",
        receivedDate: new Date().toISOString().split('T')[0],
        manufactureDate: "",
        expirationDate: "",
        supplierId: "",
        poNumber: "",
        notes: "",
    })

    const [locationAssignments, setLocationAssignments] = useState<Array<{
        locationId: string
        quantity: number
    }>>([])

    const handleStep1Continue = () => {
        if (!lotFormData.lotNumber || !lotFormData.quantity) {
            toast.error("Lot number and quantity are required")
            return
        }

        if (!itemLocations || itemLocations.length === 0) {
            toast.error("Please assign at least one location to this item first", {
                description: "Go to the Locations tab and add a storage location before creating lots.",
                duration: 5000,
            })
            return
        }

        // Initialize location assignments with all item locations set to 0
        setLocationAssignments(
            itemLocations.map((loc) => ({
                locationId: loc.locationId,
                quantity: 0,
            }))
        )

        // Close step 1, open step 2
        setIsStep2Open(true)
    }

    const handleCreateLot = async () => {
        // Validate that location assignments match total quantity
        const totalAssigned = locationAssignments.reduce((sum, loc) => sum + loc.quantity, 0)
        const totalRequired = parseInt(lotFormData.quantity)

        if (totalAssigned !== totalRequired) {
            toast.error(`Location quantities (${totalAssigned}) must equal total quantity (${totalRequired})`)
            return
        }

        // Filter out locations with 0 quantity
        const finalLocationAssignments = locationAssignments.filter(loc => loc.quantity > 0)

        if (finalLocationAssignments.length === 0) {
            toast.error("Please assign quantity to at least one location")
            return
        }

        setIsSaving(true)
        try {
            await createLotApi(itemId, {
                lotNumber: lotFormData.lotNumber,
                quantity: parseInt(lotFormData.quantity),
                receivedDate: lotFormData.receivedDate || undefined,
                manufactureDate: lotFormData.manufactureDate || undefined,
                expirationDate: lotFormData.expirationDate || undefined,
                supplierId: lotFormData.supplierId || undefined,
                poNumber: lotFormData.poNumber || undefined,
                notes: lotFormData.notes || undefined,
                locationAssignments: finalLocationAssignments,
            })

            // Reload item data to refresh totals
            const refreshResponse = await getItemByIdApi(itemId)
            if (refreshResponse.data?.item) {
                onSuccess(refreshResponse.data.item as ItemWithDetails)
            }

            // Reload lots
            await onLotsReload()

            // Reset form
            setLotFormData({
                lotNumber: "",
                quantity: "",
                receivedDate: new Date().toISOString().split('T')[0],
                manufactureDate: "",
                expirationDate: "",
                supplierId: "",
                poNumber: "",
                notes: "",
            })
            setLocationAssignments([])

            setIsStep2Open(false)
            onClose()
            toast.success("Lot created successfully!")
        } catch (error) {
            console.error("Failed to create lot:", error)
            toast.error(error instanceof Error ? error.message : "Failed to create lot")
        } finally {
            setIsSaving(false)
        }
    }

    const handleClose = () => {
        if (!isSaving) {
            setIsStep2Open(false)
            onClose()
        }
    }

    return (
        <>
            {/* Step 1: Lot Information */}
            <Dialog open={isOpen && !isStep2Open} onOpenChange={handleClose}>
                <DialogContent
                    className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
                    data-testid="create-lot-dialog-step1"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <PackageCheck className="h-4 w-4 text-blue-600" />
                            </div>
                            Create New Lot (Step 1 of 2)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Enter lot information. You&apos;ll distribute quantities across locations in the next step.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="lotNumber" className="text-xs font-medium">
                                    Lot Number <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="lotNumber"
                                    value={lotFormData.lotNumber}
                                    onChange={(e) => setLotFormData({ ...lotFormData, lotNumber: e.target.value })}
                                    placeholder="LOT-2024-001"
                                    className="h-8"
                                    data-testid="lot-number-input"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="quantity" className="text-xs font-medium">
                                    Total Quantity <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="quantity"
                                    type="number"
                                    min="1"
                                    value={lotFormData.quantity}
                                    onChange={(e) => setLotFormData({ ...lotFormData, quantity: e.target.value })}
                                    placeholder="1000"
                                    className="h-8"
                                    data-testid="lot-quantity-input"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="receivedDate" className="text-xs font-medium">
                                    Received Date
                                </Label>
                                <Input
                                    id="receivedDate"
                                    type="date"
                                    value={lotFormData.receivedDate}
                                    onChange={(e) => setLotFormData({ ...lotFormData, receivedDate: e.target.value })}
                                    className="h-8"
                                    data-testid="lot-received-date-input"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="manufactureDate" className="text-xs font-medium">
                                    Manufacture Date
                                </Label>
                                <Input
                                    id="manufactureDate"
                                    type="date"
                                    value={lotFormData.manufactureDate}
                                    onChange={(e) => setLotFormData({ ...lotFormData, manufactureDate: e.target.value })}
                                    className="h-8"
                                    data-testid="lot-manufacture-date-input"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="expirationDate" className="text-xs font-medium">
                                    Expiration Date
                                </Label>
                                <Input
                                    id="expirationDate"
                                    type="date"
                                    value={lotFormData.expirationDate}
                                    onChange={(e) => setLotFormData({ ...lotFormData, expirationDate: e.target.value })}
                                    className="h-8"
                                    data-testid="lot-expiration-date-input"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="lotSupplier" className="text-xs font-medium">
                                    Supplier
                                </Label>
                                <Select value={lotFormData.supplierId} onValueChange={(value) => setLotFormData({ ...lotFormData, supplierId: value })}>
                                    <SelectTrigger id="lotSupplier" className="h-8">
                                        <SelectValue placeholder="Select supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.id} value={supplier.id}>
                                                {supplier.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="poNumber" className="text-xs font-medium">
                                    PO Number
                                </Label>
                                <Input
                                    id="poNumber"
                                    value={lotFormData.poNumber}
                                    onChange={(e) => setLotFormData({ ...lotFormData, poNumber: e.target.value })}
                                    placeholder="PO-12345"
                                    className="h-8"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="lotNotes" className="text-xs font-medium">
                                Notes
                            </Label>
                            <Textarea
                                id="lotNotes"
                                value={lotFormData.notes}
                                onChange={(e) => setLotFormData({ ...lotFormData, notes: e.target.value })}
                                placeholder="Any additional information about this lot..."
                                className="min-h-16 resize-none text-xs"
                                data-testid="lot-notes-input"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            size="sm"
                            data-testid="lot-cancel-button"
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleStep1Continue} size="sm" data-testid="lot-step1-next-button">
                            Next: Distribute Stock →
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 2: Location Distribution */}
            <Dialog open={isStep2Open} onOpenChange={(open) => !isSaving && setIsStep2Open(open)}>
                <DialogContent
                    className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
                    data-testid="create-lot-dialog-step2"
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <MapPin className="h-4 w-4 text-blue-600" />
                            </div>
                            Distribute Stock (Step 2 of 2)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Assign quantities to storage locations. Total must equal {lotFormData.quantity} units.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        {/* Lot Summary */}
                        <div className="p-3 bg-muted/50 rounded-lg border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-muted-foreground">Lot Number</span>
                                <span className="font-mono font-semibold text-sm">{lotFormData.lotNumber}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Total Quantity</span>
                                <span className="font-bold text-lg text-primary">{lotFormData.quantity} units</span>
                            </div>
                        </div>

                        {/* Location Distribution */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium">Distribute Across Locations</Label>
                            {locationAssignments.map((assignment) => {
                                const location = locations.find(l => l.id === assignment.locationId)
                                return (
                                    <div key={assignment.locationId} className="flex items-center gap-2 p-2 bg-background rounded-lg border">
                                        <span className="font-mono text-xs font-semibold min-w-[100px]">
                                            {location?.code || assignment.locationId}
                                        </span>
                                        <Input
                                            type="number"
                                            min="0"
                                            value={assignment.quantity}
                                            onChange={(e) => {
                                                const newQty = parseInt(e.target.value) || 0
                                                setLocationAssignments(prev =>
                                                    prev.map(loc =>
                                                        loc.locationId === assignment.locationId
                                                            ? { ...loc, quantity: newQty }
                                                            : loc
                                                    )
                                                )
                                            }}
                                            className="h-8 text-sm"
                                            placeholder="0"
                                            data-testid={`lot-location-quantity-${(location?.code || assignment.locationId).toLowerCase().replace(/\s+/g, "-")}`}
                                        />
                                        <span className="text-xs text-muted-foreground whitespace-nowrap">units</span>
                                    </div>
                                )
                            })}
                        </div>

                        {/* Quick Distribute Options */}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const totalQty = parseInt(lotFormData.quantity) || 0
                                    const numLocations = locationAssignments.length
                                    const qtyPerLocation = Math.floor(totalQty / numLocations)
                                    const remainder = totalQty % numLocations

                                    setLocationAssignments(prev =>
                                        prev.map((loc, index) => ({
                                            ...loc,
                                            quantity: index === 0 ? qtyPerLocation + remainder : qtyPerLocation
                                        }))
                                    )
                                }}
                                className="flex-1 text-xs"
                            >
                                Distribute Evenly
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    const totalQty = parseInt(lotFormData.quantity) || 0
                                    setLocationAssignments(prev =>
                                        prev.map((loc, index) => ({
                                            ...loc,
                                            quantity: index === 0 ? totalQty : 0
                                        }))
                                    )
                                }}
                                className="flex-1 text-xs"
                            >
                                All to First Location
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setLocationAssignments(prev =>
                                        prev.map(loc => ({ ...loc, quantity: 0 }))
                                    )
                                }}
                                className="flex-1 text-xs"
                            >
                                Clear All
                            </Button>
                        </div>

                        {/* Total Validation */}
                        {(() => {
                            const totalAssigned = locationAssignments.reduce((sum, loc) => sum + loc.quantity, 0)
                            const totalRequired = parseInt(lotFormData.quantity) || 0
                            const isValid = totalAssigned === totalRequired
                            const difference = totalRequired - totalAssigned

                            return (
                                <div className={`text-xs p-3 rounded-lg font-medium border ${isValid
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-orange-50 text-orange-700 border-orange-200'
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <span>{isValid ? '✓ Perfect!' : '⚠️ Adjust quantities'}</span>
                                        <span className="font-bold">
                                            {totalAssigned} / {totalRequired} units
                                            {!isValid && difference !== 0 && (
                                                <span className="ml-2 text-xs">
                                                    ({difference > 0 ? `${difference} remaining` : `${Math.abs(difference)} over`})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setIsStep2Open(false)
                            }}
                            size="sm"
                            disabled={isSaving}
                            data-testid="lot-step2-back-button"
                        >
                            ← Back
                        </Button>
                        <Button
                            onClick={handleCreateLot}
                            disabled={
                                isSaving ||
                                locationAssignments.reduce((sum, loc) => sum + loc.quantity, 0) !== parseInt(lotFormData.quantity)
                            }
                            size="sm"
                            data-testid="lot-create-button"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                    Creating...
                                </>
                            ) : (
                                <>
                                    <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
                                    Create Lot
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
