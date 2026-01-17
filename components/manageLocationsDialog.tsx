"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Save, Trash2, Plus, MapPin } from "lucide-react"
import type { LocationWithCount } from "@/lib/api/locations.api"

interface ManageLocationsDialogProps {
    isOpen: boolean
    onClose: () => void
    locations: LocationWithCount[]
    currentLocationIds: string[]
    onUpdate: (locationIds: string[]) => Promise<void>
    isSaving: boolean
}

export function ManageLocationsDialog({
    isOpen,
    onClose,
    locations,
    currentLocationIds,
    onUpdate,
    isSaving
}: ManageLocationsDialogProps) {
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(currentLocationIds)
    const [newLocationId, setNewLocationId] = useState("")

    useEffect(() => {
        if (isOpen) {
            setSelectedLocationIds(currentLocationIds)
            setNewLocationId("")
        }
    }, [isOpen, currentLocationIds])

    const handleAddLocation = () => {
        if (newLocationId && !selectedLocationIds.includes(newLocationId)) {
            const updatedIds = [...selectedLocationIds, newLocationId]
            setSelectedLocationIds(updatedIds)
            setNewLocationId("")
        }
    }

    const handleRemoveLocation = (locationId: string) => {
        const updatedIds = selectedLocationIds.filter((id) => id !== locationId)
        setSelectedLocationIds(updatedIds)
    }

    const handleSubmit = async () => {
        await onUpdate(selectedLocationIds)
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
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
                                {locations.filter(l => selectedLocationIds.includes(l.id)).map((location) => (
                                    <div
                                        key={location.id}
                                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/30"
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
                                <SelectTrigger id="addLocation" className="flex-1 h-8">
                                    <SelectValue placeholder="Select a location" />
                                </SelectTrigger>
                                <SelectContent>
                                    {locations
                                        .filter((l) => !selectedLocationIds.includes(l.id))
                                        .map((location) => (
                                            <SelectItem key={location.id} value={location.id}>
                                                <div className="font-mono text-sm">{location.code}</div>
                                            </SelectItem>
                                        ))}
                                </SelectContent>
                            </Select>
                            <Button onClick={handleAddLocation} disabled={!newLocationId} size="sm" className="h-8">
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
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={isSaving} size="sm">
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