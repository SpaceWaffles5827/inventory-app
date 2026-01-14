"use client"

import { useState, useEffect } from "react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Package, MapPin, AlertCircle, ArrowRightLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getLotsByItemApi } from "@/lib/api/lots.api"
import type { ItemWithRelations } from "@/lib/api/items.api"
import type { LocationWithCount } from "@/lib/api/locations.api"

interface TransferStockWizardProps {
    item: ItemWithRelations | null
    open: boolean
    onClose: () => void
    onSuccess?: () => void
    locations: LocationWithCount[] // All available locations in workspace
}

export function TransferStockWizard({
    item,
    open,
    onClose,
    onSuccess,
    locations,
}: TransferStockWizardProps) {
    // State for wizard steps
    const [currentStep, setCurrentStep] = useState<"source" | "lot" | "destination" | "quantity">("source")
    const [sourceLocationId, setSourceLocationId] = useState<string>("")
    const [destinationLocationId, setDestinationLocationId] = useState<string>("")
    const [lotId, setLotId] = useState<string>("")
    const [itemLots, setItemLots] = useState<any[]>([])

    // State for transfer
    const [transferQuantity, setTransferQuantity] = useState("")
    const [transferNote, setTransferNote] = useState("")

    // Reset state when dialog opens/closes or item changes
    useEffect(() => {
        if (!open || !item) {
            setCurrentStep("source")
            setSourceLocationId("")
            setDestinationLocationId("")
            setLotId("")
            setItemLots([])
            setTransferQuantity("")
            setTransferNote("")
            return
        }

        // Load lots when dialog opens
        const loadLots = async () => {
            try {
                const response = await getLotsByItemApi(item.id)
                if (response.data?.lots) {
                    setItemLots(response.data.lots)
                }
            } catch (err) {
                console.error("Failed to load lots:", err)
            }
        }

        loadLots()
    }, [open, item])

    // Get max quantity available for transfer
    const getMaxTransferQuantity = () => {
        if (!item || !sourceLocationId) return 0

        if (lotId) {
            const selectedLot = itemLots.find(lot => lot.id === lotId)
            if (selectedLot) {
                const lotLocation = selectedLot.locations?.find(
                    (loc: any) => loc.locationId === sourceLocationId
                )
                return lotLocation?.quantity || 0
            }
            return 0
        }

        const itemLocation = item.locations?.find(
            loc => loc.locationId === sourceLocationId
        )
        return itemLocation?.quantity || 0
    }

    // Handle source location selection
    const handleSourceLocationSelected = () => {
        if (!sourceLocationId) {
            toast.error("Please select a source location")
            return
        }

        // Check if there are lots at this location
        const lotsAtLocation = itemLots.filter(lot =>
            lot.locations?.some((lotLoc: any) =>
                lotLoc.locationId === sourceLocationId && lotLoc.quantity > 0
            )
        )

        // If lots exist, show lot selection
        if (lotsAtLocation.length > 0) {
            setCurrentStep("lot")
        } else {
            // No lots, skip to destination
            setCurrentStep("destination")
        }
    }

    // Handle lot selection
    const handleLotSelected = () => {
        if (!lotId) {
            toast.error("Please select a lot")
            return
        }

        setCurrentStep("destination")
    }

    // Handle destination location selection
    const handleDestinationLocationSelected = () => {
        if (!destinationLocationId) {
            toast.error("Please select a destination location")
            return
        }

        if (destinationLocationId === sourceLocationId) {
            toast.error("Destination must be different from source")
            return
        }

        setCurrentStep("quantity")
    }

    // Handle transfer submission
    const handleTransferStock = async () => {
        if (
            !item ||
            !transferQuantity ||
            !sourceLocationId ||
            !destinationLocationId
        ) {
            return
        }

        const quantity = Number.parseInt(transferQuantity)
        const maxQty = getMaxTransferQuantity()

        if (quantity <= 0 || quantity > maxQty) {
            toast.error(`Quantity must be between 1 and ${maxQty}`)
            return
        }

        try {
            const response = await fetch(`/api/items/${item.id}/transfer-stock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    quantity: quantity,
                    fromLocationId: sourceLocationId,
                    toLocationId: destinationLocationId,
                    lotId: lotId || undefined,
                    reason: transferNote || "Stock transfer",
                }),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.message || 'Failed to transfer stock')
            }

            toast.success("Stock transferred successfully")
            onSuccess?.()
            onClose()
        } catch (error) {
            console.error("Failed to transfer stock:", error)
            toast.error(error instanceof Error ? error.message : "Failed to transfer stock")
        }
    }

    // Navigation helpers
    const goBackToSource = () => {
        setCurrentStep("source")
        setLotId("")
        setDestinationLocationId("")
        setTransferQuantity("")
    }

    const goBackToLot = () => {
        setCurrentStep("lot")
        setDestinationLocationId("")
        setTransferQuantity("")
    }

    const goBackToDestination = () => {
        setCurrentStep("destination")
        setTransferQuantity("")
    }

    if (!item) return null

    const hasLots = itemLots.length > 0
    const totalSteps = hasLots ? 4 : 3

    return (
        <>
            {/* Step 1: Select Source Location */}
            <Dialog open={open && currentStep === "source"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4" />
                            Transfer Stock (Step 1 of {totalSteps})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Select the source location to transfer stock from.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        {/* Item Info */}
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
                                <Package className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm truncate">{item.name}</h3>
                                <p className="text-xs text-muted-foreground truncate">
                                    Total: {item.onHand} units
                                </p>
                            </div>
                        </div>

                        {/* Source Location Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                Source Location (Transfer From)
                            </Label>
                            <RadioGroup value={sourceLocationId} onValueChange={setSourceLocationId}>
                                <div className="space-y-1.5">
                                    {item.locations && item.locations.length > 0 ? (
                                        item.locations.filter(loc => loc.quantity > 0).map((itemLocation) => (
                                            <div
                                                key={itemLocation.id}
                                                className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${sourceLocationId === itemLocation.locationId
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50"
                                                    }`}
                                                onClick={() => setSourceLocationId(itemLocation.locationId)}
                                            >
                                                <RadioGroupItem
                                                    value={itemLocation.locationId}
                                                    id={`transfer-source-${itemLocation.locationId}`}
                                                    className="flex-shrink-0"
                                                />
                                                <Label
                                                    htmlFor={`transfer-source-${itemLocation.locationId}`}
                                                    className="flex-1 cursor-pointer min-w-0"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-mono font-semibold text-xs truncate">
                                                                {itemLocation.location.code}
                                                            </p>
                                                        </div>
                                                        <p className="font-semibold text-sm flex-shrink-0 whitespace-nowrap">
                                                            {itemLocation.quantity} units
                                                        </p>
                                                    </div>
                                                </Label>
                                            </div>
                                        ))
                                    ) : (
                                        <Alert className="py-2">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <AlertDescription className="text-xs">
                                                No locations with stock available.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={onClose} size="sm">
                            Cancel
                        </Button>
                        <Button onClick={handleSourceLocationSelected} disabled={!sourceLocationId} size="sm">
                            Next: {hasLots ? 'Select Lot' : 'Select Destination'} →
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 2: Select Lot (only for lot-tracked items) */}
            <Dialog open={open && currentStep === "lot"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4" />
                            Transfer Stock (Step 2 of 4)
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Select which lot/batch to transfer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        {/* Context Info */}
                        <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
                            <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    From: {item.locations?.find(l => l.locationId === sourceLocationId)?.location.code}
                                </p>
                            </div>
                        </div>

                        {/* Lot Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs">Select Lot/Batch to Transfer</Label>
                            <RadioGroup value={lotId} onValueChange={setLotId}>
                                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                    {(() => {
                                        const lotsAtLocation = itemLots
                                            .filter(lot => {
                                                const lotLocation = lot.locations?.find((lotLoc: any) =>
                                                    lotLoc.locationId === sourceLocationId
                                                )
                                                return lotLocation && lotLocation.quantity > 0
                                            })
                                            .sort((a, b) => {
                                                // FIFO: sort by expiration date (earliest first)
                                                if (!a.expirationDate) return 1
                                                if (!b.expirationDate) return -1
                                                return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
                                            })

                                        if (lotsAtLocation.length === 0) {
                                            return (
                                                <Alert className="py-2">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    <AlertDescription className="text-xs">
                                                        No lots at this location.
                                                    </AlertDescription>
                                                </Alert>
                                            )
                                        }

                                        return lotsAtLocation.map((lot) => {
                                            const lotLocation = lot.locations?.find((l: any) => l.locationId === sourceLocationId)
                                            const daysUntilExpiration = lot.expirationDate
                                                ? Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                                : null

                                            return (
                                                <div
                                                    key={lot.id}
                                                    className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${lotId === lot.id
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border hover:border-primary/50"
                                                        }`}
                                                    onClick={() => setLotId(lot.id)}
                                                >
                                                    <RadioGroupItem
                                                        value={lot.id}
                                                        id={`transfer-lot-${lot.id}`}
                                                        className="flex-shrink-0"
                                                    />
                                                    <Label
                                                        htmlFor={`transfer-lot-${lot.id}`}
                                                        className="flex-1 cursor-pointer min-w-0"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="font-mono font-semibold text-xs truncate">{lot.lotNumber}</p>
                                                                {lot.expirationDate && (
                                                                    <span className={`text-[10px] ${daysUntilExpiration !== null && daysUntilExpiration < 0
                                                                            ? "text-red-600"
                                                                            : daysUntilExpiration !== null && daysUntilExpiration <= 7
                                                                                ? "text-orange-600"
                                                                                : "text-muted-foreground"
                                                                        }`}>
                                                                        Exp: {new Date(lot.expirationDate).toLocaleDateString()}
                                                                        {daysUntilExpiration !== null && daysUntilExpiration < 0 && " (Expired)"}
                                                                        {daysUntilExpiration !== null && daysUntilExpiration >= 0 && daysUntilExpiration <= 7 && ` (${daysUntilExpiration}d)`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="font-semibold text-sm flex-shrink-0">
                                                                {lotLocation?.quantity || 0} units
                                                            </p>
                                                        </div>
                                                    </Label>
                                                </div>
                                            )
                                        })
                                    })()}
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={goBackToSource} size="sm">
                            ← Back
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setLotId("")
                                setCurrentStep("destination")
                            }}
                            size="sm"
                            className="text-xs"
                        >
                            Skip (Transfer Non-Lotted)
                        </Button>
                        <Button onClick={handleLotSelected} disabled={!lotId} size="sm">
                            Next: Select Destination →
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 3: Select Destination Location */}
            <Dialog open={open && currentStep === "destination"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4" />
                            Transfer Stock (Step {hasLots ? '3 of 4' : '2 of 3'})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Select the destination location to transfer stock to.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        {/* Context Info */}
                        <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
                            <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    From: {item.locations?.find(l => l.locationId === sourceLocationId)?.location.code}
                                    {lotId && <> | Lot: {itemLots.find(l => l.id === lotId)?.lotNumber}</>}
                                </p>
                            </div>
                        </div>

                        {/* Destination Location Selection - ALL LOCATIONS */}
                        <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                Destination Location (Transfer To)
                            </Label>
                            <RadioGroup value={destinationLocationId} onValueChange={setDestinationLocationId}>
                                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                    {locations.length > 0 ? (
                                        locations
                                            .filter(loc => loc.id !== sourceLocationId)
                                            .map((location) => {
                                                // Check if item already has stock at this location
                                                const itemLocation = item.locations?.find(
                                                    il => il.locationId === location.id
                                                )
                                                const currentQty = itemLocation?.quantity || 0

                                                return (
                                                    <div
                                                        key={location.id}
                                                        className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${destinationLocationId === location.id
                                                                ? "border-primary bg-primary/5"
                                                                : "border-border hover:border-primary/50"
                                                            }`}
                                                        onClick={() => setDestinationLocationId(location.id)}
                                                    >
                                                        <RadioGroupItem
                                                            value={location.id}
                                                            id={`transfer-dest-${location.id}`}
                                                            className="flex-shrink-0"
                                                        />
                                                        <Label
                                                            htmlFor={`transfer-dest-${location.id}`}
                                                            className="flex-1 cursor-pointer min-w-0"
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="font-mono font-semibold text-xs truncate">
                                                                        {location.code}
                                                                    </p>
                                                                </div>
                                                                <div className="text-right flex-shrink-0">
                                                                    {currentQty > 0 ? (
                                                                        <p className="text-sm text-muted-foreground">{currentQty} units</p>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-xs">Empty</Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </Label>
                                                    </div>
                                                )
                                            })
                                    ) : (
                                        <Alert className="py-2">
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <AlertDescription className="text-xs">
                                                No other locations available.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </RadioGroup>
                        </div>

                        {destinationLocationId && (
                            <Alert className="py-2">
                                <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
                                <AlertDescription className="text-xs text-blue-800">
                                    {(() => {
                                        const destLocation = item.locations?.find(
                                            il => il.locationId === destinationLocationId
                                        )
                                        return destLocation
                                            ? `This item currently has ${destLocation.quantity} units at this location.`
                                            : "This location will be added to the item's storage locations."
                                    })()}
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (hasLots && lotId) {
                                    goBackToLot()
                                } else {
                                    goBackToSource()
                                }
                            }}
                            size="sm"
                        >
                            ← Back
                        </Button>
                        <Button onClick={handleDestinationLocationSelected} disabled={!destinationLocationId} size="sm">
                            Next: Enter Quantity →
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 4: Enter Quantity */}
            <Dialog open={open && currentStep === "quantity"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base flex items-center gap-2">
                            <ArrowRightLeft className="h-4 w-4" />
                            Transfer Stock (Step {hasLots ? '4 of 4' : '3 of 3'})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Enter the quantity to transfer.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        {/* Transfer Summary */}
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-950/30 dark:border-blue-900/50">
                            <div className="flex items-center gap-2 mb-2">
                                <ArrowRightLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                <p className="font-semibold text-sm text-blue-900 dark:text-blue-100">Transfer Summary</p>
                            </div>
                            <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                                <p><span className="font-medium">Item:</span> {item.name}</p>
                                <p>
                                    <span className="font-medium">From:</span>{" "}
                                    {item.locations?.find(l => l.locationId === sourceLocationId)?.location.code}
                                </p>
                                <p>
                                    <span className="font-medium">To:</span>{" "}
                                    {locations.find(l => l.id === destinationLocationId)?.code}
                                </p>
                                {lotId && (
                                    <p>
                                        <span className="font-medium">Lot:</span>{" "}
                                        {itemLots.find(l => l.id === lotId)?.lotNumber}
                                    </p>
                                )}
                                <p>
                                    <span className="font-medium">Available:</span> {getMaxTransferQuantity()} units
                                </p>
                            </div>
                        </div>

                        {/* Quantity Input */}
                        <div className="space-y-1">
                            <Label htmlFor="transferQty" className="text-xs">Transfer Quantity</Label>
                            <Input
                                id="transferQty"
                                type="number"
                                min="1"
                                max={getMaxTransferQuantity()}
                                value={transferQuantity}
                                onChange={(e) => setTransferQuantity(e.target.value)}
                                placeholder={`Max: ${getMaxTransferQuantity()}`}
                                className="font-semibold h-9"
                            />
                            {transferQuantity && parseInt(transferQuantity) > getMaxTransferQuantity() && (
                                <Alert variant="destructive" className="py-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <AlertDescription className="text-xs">
                                        Cannot transfer more than {getMaxTransferQuantity()} units.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Transfer Note */}
                        <div className="space-y-1">
                            <Label htmlFor="transferNote" className="text-xs">Note (Optional)</Label>
                            <Textarea
                                id="transferNote"
                                placeholder="Reason for transfer..."
                                value={transferNote}
                                onChange={(e) => setTransferNote(e.target.value)}
                                className="min-h-14 resize-none text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={goBackToDestination} size="sm">
                            ← Back
                        </Button>
                        <Button
                            onClick={handleTransferStock}
                            disabled={
                                !transferQuantity ||
                                parseInt(transferQuantity) <= 0 ||
                                parseInt(transferQuantity) > getMaxTransferQuantity()
                            }
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            Transfer Stock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}