"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { MapPin, Plus, Trash2, Save, Loader2 } from "lucide-react"
import { updateItemApi, getItemByIdApi, type ItemWithDetails } from "@/lib/api/items.api"
import { type LocationWithCount } from "@/lib/api/locations.api"
import { toast } from "sonner"

interface ManageLocationsDialogProps {
    isOpen: boolean
    onClose: () => void
    itemId: string
    currentLocationIds: string[]
    locations: LocationWithCount[]
    onSuccess: (updatedItem: ItemWithDetails) => void
}

export function ManageLocationsDialog({
    isOpen,
    onClose,
    itemId,
    currentLocationIds,
    locations,
    onSuccess,
}: ManageLocationsDialogProps) {
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(currentLocationIds)
    const [newLocationId, setNewLocationId] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    // Update state when dialog opens with new location IDs
    useState(() => {
        if (isOpen) {
            setSelectedLocationIds(currentLocationIds)
            setNewLocationId("")
        }
    })

    const handleAddLocation = () => {
        if (newLocationId && !selectedLocationIds.includes(newLocationId)) {
            setSelectedLocationIds([...selectedLocationIds, newLocationId])
            setNewLocationId("")
        }
    }

    const handleRemoveLocation = (locationId: string) => {
        setSelectedLocationIds(selectedLocationIds.filter((id) => id !== locationId))
    }

    const handleUpdateLocations = async () => {
        setIsSaving(true)
        try {
            const updateData = {
                locationIds: selectedLocationIds,
            }

            const response = await updateItemApi(itemId, updateData)

            if (response.data?.item) {
                // Reload the full item data with all relationships including transactions
                const refreshResponse = await getItemByIdApi(itemId)
                if (refreshResponse.data?.item) {
                    onSuccess(refreshResponse.data.item as ItemWithDetails)
                }
                onClose()
                toast.success("Locations updated successfully!")
            }
        } catch (error) {
            console.error("Failed to update locations:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update locations")
        } finally {
            setIsSaving(false)
        }
    }

    const selectedLocations = locations.filter((l) => selectedLocationIds.includes(l.id))

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]" data-testid="manage-locations-dialog">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                            <MapPin className="h-4 w-4 text-accent" />
                        </div>
                        Manage Storage Locations
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Assign this item to one or more warehouse locations. This helps organize inventory and track where items are stored.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Assigned Locations ({selectedLocationIds.length})</Label>
                        {selectedLocationIds.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-3 text-center border border-dashed rounded-lg">
                                No locations assigned yet
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {selectedLocations.map((location) => (
                                    <div
                                        key={location.id}
                                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/30"
                                        data-testid={`manage-location-row-${location.code.toLowerCase().replace(/\s+/g, "-")}`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                            <div>
                                                <span className="font-medium font-mono text-sm">{location.code}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleRemoveLocation(location.id)}
                                            data-testid={`manage-location-remove-${location.code.toLowerCase().replace(/\s+/g, "-")}`}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="addLocation" className="text-xs font-medium">
                            Add Location
                        </Label>
                        <div className="flex gap-2">
                            <Select value={newLocationId} onValueChange={(value) => setNewLocationId(value)}>
                                <SelectTrigger
                                    id="addLocation"
                                    className="flex-1 h-8"
                                    data-testid="manage-location-select-trigger"
                                >
                                    <SelectValue placeholder="Select a location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations
                                        .filter((l) => !selectedLocationIds.includes(l.id))
                                        .map((location) => (
                                            <SelectItem
                                                key={location.id}
                                                value={location.id}
                                                data-testid={`manage-location-option-${location.code.toLowerCase().replace(/\s+/g, "-")}`}
                                            >
                                                <div className="font-mono text-sm">{location.code}</div>
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={handleAddLocation}
                                disabled={!newLocationId}
                                size="sm"
                                className="h-8"
                                data-testid="manage-location-add-button"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Select from existing locations or create new ones in the Locations page
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSaving}
                        size="sm"
                        data-testid="manage-location-cancel-button"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpdateLocations}
                        disabled={isSaving}
                        size="sm"
                        data-testid="manage-location-save-button"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-3.5 w-3.5 mr-1.5" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
