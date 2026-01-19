"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MapPin, Plus, Trash2, ExternalLink, Diff } from "lucide-react"
import { updateItemApi, type ItemWithDetails } from "@/lib/api/items.api"
import { type LocationWithCount } from "@/lib/api/locations.api"
import { toast } from "sonner"

interface ItemLocation {
    id: string
    locationId: string
    quantity: number | null
    notes: string | null
    minStock: number
    maxStock: number
    location: {
        id: string
        code: string
        name?: string | null
    }
}

interface ItemLocationsTabProps {
    itemId: string
    itemLocations: ItemLocation[]
    locations: LocationWithCount[]
    itemUnit?: string | null
    onManageLocations: () => void
    onAdjustStock: (locationId: string, currentQuantity: number) => void
    onItemUpdate: (updatedItem: ItemWithDetails) => void
    onNavigateToLocation: (locationId: string) => void
}

export function ItemLocationsTab({
    itemId,
    itemLocations,
    locations,
    itemUnit,
    onManageLocations,
    onAdjustStock,
    onItemUpdate,
    onNavigateToLocation,
}: ItemLocationsTabProps) {

    const itemLocationsWithDetails = itemLocations.map(itemLoc => {
        const locationDetails = locations.find(l => l.id === itemLoc.locationId)
        return {
            ...itemLoc,
            location: locationDetails || itemLoc.location
        }
    })

    const handleRemoveLocation = async (locationId: string, locationCode: string) => {
        if (!confirm(`Remove this item from location ${locationCode}? This action cannot be undone.`)) {
            return
        }

        try {
            const updatedLocationIds = itemLocations
                .map(loc => loc.locationId)
                .filter(id => id !== locationId)

            const response = await updateItemApi(itemId, {
                locationIds: updatedLocationIds,
            })

            if (response.data?.item) {
                onItemUpdate(response.data.item as ItemWithDetails)
                toast.success(`Item removed from location ${locationCode}`)
            }
        } catch (error) {
            console.error("Failed to remove location:", error)
            toast.error("Failed to remove location")
        }
    }

    return (
        <div className="bg-card p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">Storage Locations</h3>
                <Button variant="outline" size="sm" onClick={onManageLocations} className="gap-2 h-7">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Manage</span>
                </Button>
            </div>

            {itemLocationsWithDetails.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed rounded-lg">
                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium text-muted-foreground">No locations assigned</p>
                    <p className="text-xs text-muted-foreground mt-1">Click Manage to assign storage locations</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {itemLocationsWithDetails
                        .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
                        .map((itemLocation) => (
                            <div
                                key={itemLocation.id}
                                className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 hover:border-accent/50 transition-all"
                            >
                                <div
                                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                                    onClick={() => onNavigateToLocation(itemLocation.locationId)}
                                >
                                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="h-5 w-5 text-accent" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <h3 className="font-semibold font-mono text-sm truncate">
                                                {itemLocation.location.code}
                                            </h3>
                                            {(itemLocation.quantity || 0) === 0 && (
                                                <Badge variant="secondary" className="text-xs py-0">Empty</Badge>
                                            )}
                                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        {itemLocation.notes && (
                                            <p className="text-xs text-muted-foreground truncate">{itemLocation.notes}</p>
                                        )}
                                        {(itemLocation.minStock > 0 || itemLocation.maxStock > 0) && (
                                            <div className="flex items-center gap-2 mt-1">
                                                {itemLocation.minStock > 0 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Min: {itemLocation.minStock}
                                                    </span>
                                                )}
                                                {itemLocation.maxStock > 0 && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Max: {itemLocation.maxStock}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-right">
                                        <p className="text-xs text-muted-foreground mb-0">Quantity</p>
                                        <p className="text-xl font-bold text-accent">
                                            {itemLocation.quantity || 0}
                                            {itemUnit && <span className="text-xs text-muted-foreground ml-1">{itemUnit}</span>}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-accent/10 hover:text-accent hover:border-accent/50"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onAdjustStock(itemLocation.locationId, itemLocation.quantity || 0)
                                            }}
                                        >
                                            <Diff className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleRemoveLocation(itemLocation.locationId, itemLocation.location.code)
                                            }}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>
            )}
        </div>
    )
}