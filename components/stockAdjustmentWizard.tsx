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
import { Package, MapPin, AlertCircle } from "lucide-react"
import { getLotsByItemApi } from "@/lib/api/lots.api"
import { adjustStockApi, type ItemWithRelations } from "@/lib/api/items.api"

interface StockAdjustmentWizardProps {
    item: ItemWithRelations | null
    open: boolean
    onClose: () => void
    onSuccess?: () => void
}

export function StockAdjustmentWizard({
    item,
    open,
    onClose,
    onSuccess,
}: StockAdjustmentWizardProps) {
    // State for wizard steps
    const [currentStep, setCurrentStep] = useState<"location" | "lot" | "quantity">("location")
    const [selectedLocationId, setSelectedLocationId] = useState<string>("")
    const [selectedLotId, setSelectedLotId] = useState<string>("")
    const [itemLots, setItemLots] = useState<any[]>([])

    // State for quantity adjustment
    const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
    const [newStockAmount, setNewStockAmount] = useState("")
    const [adjustmentNote, setAdjustmentNote] = useState("")

    // Reset state when dialog opens/closes or item changes
    useEffect(() => {
        if (!open || !item) {
            setCurrentStep("location")
            setSelectedLocationId("")
            setSelectedLotId("")
            setItemLots([])
            setAdjustmentQuantity("")
            setNewStockAmount("")
            setAdjustmentNote("")
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

    // Get current stock for selected location (and lot if selected)
    const getCurrentLocationStock = () => {
        if (!item || !selectedLocationId) return 0

        // If a lot is selected, get quantity from that specific lot at this location
        if (selectedLotId) {
            const selectedLot = itemLots.find(lot => lot.id === selectedLotId)
            if (selectedLot) {
                const lotLocation = selectedLot.locations?.find(
                    (loc: any) => loc.locationId === selectedLocationId
                )
                return lotLocation?.quantity || 0
            }
            return 0
        }

        // Otherwise, get total item quantity at this location
        const itemLocation = item.locations?.find(
            loc => loc.locationId === selectedLocationId
        )

        return itemLocation?.quantity || 0
    }

    // Handle location selection
    const handleLocationSelected = () => {
        if (!selectedLocationId) {
            toast.error("Please select a location")
            return
        }

        // Check if there are lots available at the selected location
        const lotsAtLocation = itemLots.filter(lot =>
            lot.locations?.some((lotLoc: any) =>
                lotLoc.locationId === selectedLocationId && lotLoc.quantity > 0
            )
        )

        // If there are lots at this location, show lot selection
        if (lotsAtLocation.length > 0) {
            setCurrentStep("lot")
        } else {
            // No lots at this location, go straight to quantity adjustment
            const locationStock = getCurrentLocationStock()
            setNewStockAmount(String(locationStock))
            setCurrentStep("quantity")
        }
    }

    // Handle lot selection
    const handleLotSelected = () => {
        if (!selectedLotId) {
            toast.error("Please select a lot")
            return
        }

        const locationStock = getCurrentLocationStock()
        setNewStockAmount(String(locationStock))
        setCurrentStep("quantity")
    }

    // Handle adjustment quantity changes
    const handleAdjustmentQuantityChange = (value: string) => {
        setAdjustmentQuantity(value)
        if (value && value !== "-" && value !== "+") {
            const qty = Number.parseInt(value)
            if (!isNaN(qty)) {
                const currentStock = getCurrentLocationStock()
                setNewStockAmount(String(currentStock + qty))
            }
        }
    }

    // Handle new stock amount changes
    const handleNewStockAmountChange = (value: string) => {
        setNewStockAmount(value)
        if (value) {
            const newStock = Number.parseInt(value)
            if (!isNaN(newStock)) {
                const currentStock = getCurrentLocationStock()
                const adjustment = newStock - currentStock
                setAdjustmentQuantity(String(adjustment))
            }
        } else {
            setAdjustmentQuantity("")
        }
    }

    // Handle stock adjustment submission
    const handleStockAdjustment = async () => {
        if (
            !item ||
            !adjustmentQuantity ||
            adjustmentQuantity === "0" ||
            !selectedLocationId
        ) {
            return
        }

        const quantity = Number.parseInt(adjustmentQuantity)
        const isInput = quantity > 0

        try {
            // Use lot-specific endpoint if lot is selected
            if (selectedLotId) {
                const response = await fetch(`/api/lots/${selectedLotId}/adjust`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        type: isInput ? "INPUT" : "OUTPUT",
                        quantity: Math.abs(quantity),
                        reason: adjustmentNote || "Stock adjustment",
                        locationId: selectedLocationId,
                    }),
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || 'Failed to adjust lot stock')
                }
            } else {
                // Regular stock adjustment (non-lot-tracked items)
                await adjustStockApi(item.id, {
                    type: isInput ? "INPUT" : "OUTPUT",
                    quantity: Math.abs(quantity),
                    reason: adjustmentNote || "Stock adjustment",
                    locationId: selectedLocationId,
                })
            }

            toast.success("Stock adjusted successfully")
            onSuccess?.()
            onClose()
        } catch (error) {
            console.error("Failed to adjust stock:", error)
            toast.error(error instanceof Error ? error.message : "Failed to adjust stock")
        }
    }

    // Navigation helpers
    const goBackToLocation = () => {
        setCurrentStep("location")
        setSelectedLotId("")
        setAdjustmentQuantity("")
        setNewStockAmount("")
    }

    const goBackToLot = () => {
        setCurrentStep("lot")
        setAdjustmentQuantity("")
        setNewStockAmount("")
    }

    const incrementQuantity = () => {
        const current = Number.parseInt(adjustmentQuantity || "0")
        handleAdjustmentQuantityChange(String(current + 1))
    }

    const decrementQuantity = () => {
        const current = Number.parseInt(adjustmentQuantity || "0")
        handleAdjustmentQuantityChange(String(current - 1))
    }

    if (!item) return null

    const hasLots = itemLots.length > 0
    const totalSteps = hasLots ? 3 : 2

    return (
        <>
            {/* Step 1: Select Location */}
            <Dialog open={open && currentStep === "location"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            Select Location (Step 1 of {totalSteps})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Choose which location to adjust stock for.
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
                                    Total: {item.onHand} units | ${(item.cost * item.onHand).toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {/* Location Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                Select Location
                            </Label>
                            <RadioGroup value={selectedLocationId} onValueChange={setSelectedLocationId}>
                                <div className="space-y-1.5">
                                    {item.locations && item.locations.length > 0 ? (
                                        item.locations.map((itemLocation) => (
                                            <div
                                                key={itemLocation.id}
                                                className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${selectedLocationId === itemLocation.locationId
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50"
                                                    }`}
                                                onClick={() => setSelectedLocationId(itemLocation.locationId)}
                                            >
                                                <RadioGroupItem
                                                    value={itemLocation.locationId}
                                                    id={`location-${itemLocation.locationId}`}
                                                    className="flex-shrink-0"
                                                />
                                                <Label
                                                    htmlFor={`location-${itemLocation.locationId}`}
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
                                                No locations assigned to this item.
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
                        <Button onClick={handleLocationSelected} disabled={!selectedLocationId} size="sm">
                            Next: {hasLots ? 'Select Lot' : 'Adjust Quantity'} →
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 2: Select Lot (only for lot-tracked items) */}
            <Dialog open={open && currentStep === "lot"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base">Select Lot (Step 2 of 3)</DialogTitle>
                        <DialogDescription className="text-xs">
                            Choose which lot to adjust at the selected location.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-3">
                        {/* Item & Location Info */}
                        <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
                            <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    Location: {item.locations?.find(l => l.locationId === selectedLocationId)?.location.code}
                                </p>
                            </div>
                        </div>

                        {/* Lot Selection */}
                        <div className="space-y-2">
                            <Label className="text-xs">Select Lot/Batch</Label>
                            <RadioGroup value={selectedLotId} onValueChange={setSelectedLotId}>
                                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                    {(() => {
                                        const lotsAtLocation = itemLots
                                            .filter(lot => {
                                                const lotLocation = lot.locations?.find((lotLoc: any) =>
                                                    lotLoc.locationId === selectedLocationId
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
                                                        No lots available at this location.
                                                    </AlertDescription>
                                                </Alert>
                                            )
                                        }

                                        return lotsAtLocation.map((lot) => {
                                            const lotLocation = lot.locations?.find((l: any) => l.locationId === selectedLocationId)
                                            const daysUntilExpiration = lot.expirationDate
                                                ? Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                                                : null

                                            return (
                                                <div
                                                    key={lot.id}
                                                    className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${selectedLotId === lot.id
                                                            ? "border-primary bg-primary/5"
                                                            : "border-border hover:border-primary/50"
                                                        }`}
                                                    onClick={() => setSelectedLotId(lot.id)}
                                                >
                                                    <RadioGroupItem
                                                        value={lot.id}
                                                        id={`lot-${lot.id}`}
                                                        className="flex-shrink-0"
                                                    />
                                                    <Label
                                                        htmlFor={`lot-${lot.id}`}
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
                                                            <p className="font-semibold text-sm flex-shrink-0 whitespace-nowrap">
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
                        <Button variant="outline" onClick={goBackToLocation} size="sm">
                            ← Back
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setSelectedLotId("")
                                const locationStock = getCurrentLocationStock()
                                setNewStockAmount(String(locationStock))
                                setCurrentStep("quantity")
                            }}
                            size="sm"
                            className="text-xs"
                        >
                            Skip (Adjust Non-Lotted)
                        </Button>
                        <Button onClick={handleLotSelected} disabled={!selectedLotId} size="sm">
                            Next: Adjust Quantity →
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 3: Adjust Quantity */}
            <Dialog open={open && currentStep === "quantity"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            Adjust Quantity (Step {hasLots ? '3 of 3' : '2 of 2'})
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Update the stock quantity at the selected location{selectedLotId ? ' for the selected lot' : ''}.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        {/* Context Info */}
                        <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
                            <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-xs truncate">{item.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                    Location: {item.locations?.find(l => l.locationId === selectedLocationId)?.location.code}
                                    {selectedLotId && (
                                        <> | Lot: {itemLots.find(l => l.id === selectedLotId)?.lotNumber}</>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Current Stock */}
                        <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border">
                            <span className="text-xs text-muted-foreground">Current Quantity</span>
                            <span className="text-base font-bold">{getCurrentLocationStock()}</span>
                        </div>

                        {/* Adjustment Amount with +/- Buttons */}
                        <div className="space-y-1">
                            <Label className="text-xs">Adjustment Amount</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={decrementQuantity}
                                    className="flex-shrink-0 h-9 w-9"
                                >
                                    <span className="text-lg">−</span>
                                </Button>

                                <Input
                                    type="text"
                                    value={
                                        adjustmentQuantity > 0
                                            ? `+${adjustmentQuantity}`
                                            : adjustmentQuantity === 0
                                                ? "0"
                                                : `${adjustmentQuantity}`
                                    }
                                    onChange={(e) => {
                                        const val = e.target.value
                                        if (val === "") {
                                            setAdjustmentQuantity("")
                                            setNewStockAmount(String(getCurrentLocationStock()))
                                            return
                                        }
                                        if (val === "-" || val === "+") {
                                            setAdjustmentQuantity(val)
                                            return
                                        }
                                        const cleaned = val.replace(/[^0-9-+]/g, "")
                                        const hasSign = cleaned.startsWith("-") || cleaned.startsWith("+")
                                        const numbers = cleaned.replace(/[-+]/g, "")
                                        const finalValue = hasSign ? cleaned.charAt(0) + numbers : numbers
                                        if (finalValue === "-" || finalValue === "+") {
                                            setAdjustmentQuantity(finalValue)
                                        } else {
                                            const num = Number.parseInt(finalValue)
                                            if (!isNaN(num)) {
                                                handleAdjustmentQuantityChange(String(num))
                                            }
                                        }
                                    }}
                                    className="text-center font-semibold flex-1 min-w-0 h-9 text-sm"
                                    placeholder="0"
                                />

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={incrementQuantity}
                                    className="flex-shrink-0 h-9 w-9"
                                >
                                    <span className="text-lg">+</span>
                                </Button>
                            </div>
                        </div>

                        {/* New Quantity Input */}
                        <div className="space-y-1">
                            <Label htmlFor="newStock" className="text-xs">New Quantity</Label>
                            <Input
                                id="newStock"
                                type="number"
                                min="0"
                                value={newStockAmount}
                                onChange={(e) => handleNewStockAmountChange(e.target.value)}
                                className="font-semibold h-9 text-sm"
                            />
                            {Number.parseInt(newStockAmount) < 0 && (
                                <Alert variant="destructive" className="py-1.5">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    <AlertDescription className="text-xs">
                                        Stock quantity cannot be negative.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>

                        {/* Transaction Note */}
                        <div className="space-y-1">
                            <Label htmlFor="note" className="text-xs">Transaction Note (Optional)</Label>
                            <Textarea
                                id="note"
                                placeholder="Reason for adjustment..."
                                value={adjustmentNote}
                                onChange={(e) => setAdjustmentNote(e.target.value)}
                                className="min-h-14 resize-none text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (hasLots && selectedLotId) {
                                    goBackToLot()
                                } else {
                                    goBackToLocation()
                                }
                            }}
                            size="sm"
                        >
                            ← Back
                        </Button>
                        <Button
                            onClick={handleStockAdjustment}
                            disabled={
                                !adjustmentQuantity ||
                                adjustmentQuantity === "0" ||
                                adjustmentQuantity === "+" ||
                                adjustmentQuantity === "-" ||
                                Number.parseInt(newStockAmount) < 0
                            }
                            size="sm"
                        >
                            Update Stock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}