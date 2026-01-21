"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, Trash2, Loader2, ImageIcon } from "lucide-react"
import { adjustStockApi } from "@/lib/api/items.api"
import { toast } from "sonner"

// Helper component for item images
const ItemImage = ({ itemId, alt, className }: { itemId: string; alt: string; className?: string }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useState(() => {
        const loadPrimaryImage = async () => {
            try {
                setLoading(true)
                setError(false)

                const response = await fetch(`/api/items/images/${itemId}`, {
                    credentials: 'include',
                })

                if (!response.ok) {
                    setError(true)
                    return
                }

                const data = await response.json()
                const primaryImage = data.data?.images?.find((img: any) => img.isPrimary)

                if (primaryImage) {
                    setImageUrl(`/api/items/images/image/${primaryImage.id}`)
                } else {
                    setError(true)
                }
            } catch (err) {
                console.error('Failed to load image:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        loadPrimaryImage()
    })

    if (loading) {
        return (
            <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !imageUrl) {
        return (
            <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
        )
    }

    return (
        <img
            src={imageUrl}
            alt={alt}
            className={className}
            onError={() => setError(true)}
        />
    )
}

interface RemoveFromLocationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: any | null
    locationCode: string
    locationId: string
    onSuccess: () => void
}

export function RemoveFromLocationDialog({
    open,
    onOpenChange,
    item,
    locationCode,
    locationId,
    onSuccess,
}: RemoveFromLocationDialogProps) {
    const [isRemoving, setIsRemoving] = useState(false)

    const handleRemoveFromLocation = async () => {
        if (!item) return

        setIsRemoving(true)
        try {
            const currentQuantity = item.quantity || 0

            await adjustStockApi(item.id, {
                type: "OUTPUT",
                quantity: currentQuantity,
                reason: `Removed from location ${locationCode}`,
                locationId: locationId,
            })

            toast.success("Item removed from location")
            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to remove item:", error)
            toast.error(error instanceof Error ? error.message : "Failed to remove item")
        } finally {
            setIsRemoving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        Remove Item from Location
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to remove this item from {locationCode}? This will set the quantity at this location to 0.
                    </DialogDescription>
                </DialogHeader>

                {item && (
                    <div className="py-4">
                        <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0">
                                    <ItemImage
                                        itemId={item.id}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Item #: {item.itemNumber}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Current Quantity: {item.quantity} {item.unit || 'units'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isRemoving}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRemoveFromLocation}
                        disabled={isRemoving}
                    >
                        {isRemoving ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Removing...
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove from Location
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}