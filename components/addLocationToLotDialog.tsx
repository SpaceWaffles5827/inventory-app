"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { adjustLotQuantityApi } from "@/lib/api/lots.api"
import { type LocationWithCount } from "@/lib/api/locations.api"

interface AddLocationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lotId: string
    availableLocations: LocationWithCount[]
    onSuccess: () => void
}

export function AddLocationToLotDialog({
    open,
    onOpenChange,
    lotId,
    availableLocations,
    onSuccess,
}: AddLocationDialogProps) {
    const [selectedLocationId, setSelectedLocationId] = useState("")
    const [locationQuantity, setLocationQuantity] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleClose = () => {
        setSelectedLocationId("")
        setLocationQuantity("")
        onOpenChange(false)
    }

    const handleAddLocation = async () => {
        if (!selectedLocationId || !locationQuantity) {
            toast.error("Please select a location and enter quantity")
            return
        }

        const quantity = parseInt(locationQuantity)
        if (quantity <= 0) {
            toast.error("Quantity must be greater than 0")
            return
        }

        setIsSubmitting(true)
        try {
            await adjustLotQuantityApi(lotId, {
                type: "INPUT",
                quantity: quantity,
                reason: "Added stock to new location",
                locationId: selectedLocationId,
            })

            toast.success("Location added successfully")
            onSuccess()
            handleClose()
        } catch (error) {
            console.error("Failed to add location:", error)
            toast.error(error instanceof Error ? error.message : "Failed to add location")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Location to Lot</DialogTitle>
                    <DialogDescription className="text-xs">
                        Assign this lot to a new storage location with an initial quantity.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="location" className="text-xs font-medium">
                            Storage Location <span className="text-red-500">*</span>
                        </Label>
                        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                            <SelectTrigger id="location" className="h-9">
                                <SelectValue placeholder="Select a location" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLocations.map((location) => (
                                    <SelectItem key={location.id} value={location.id}>
                                        <span className="font-mono font-semibold">{location.code}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="quantity" className="text-xs font-medium">
                            Initial Quantity <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="1"
                            value={locationQuantity}
                            onChange={(e) => setLocationQuantity(e.target.value)}
                            placeholder="Enter quantity"
                            className="h-9"
                        />
                        <p className="text-xs text-muted-foreground">
                            This will add {locationQuantity || 0} units to the selected location
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={handleClose} size="sm" disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAddLocation}
                        disabled={!selectedLocationId || !locationQuantity || isSubmitting}
                        size="sm"
                    >
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        {isSubmitting ? "Adding..." : "Add Location"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}