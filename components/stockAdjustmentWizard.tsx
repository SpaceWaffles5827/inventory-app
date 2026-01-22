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
    defaultLocationId?: string
}

export function StockAdjustmentWizard({
    item,
    open,
    onClose,
    onSuccess,
    defaultLocationId,
}: StockAdjustmentWizardProps) {
    // State for wizard steps - start at different step if location is pre-selected
    const [currentStep, setCurrentStep] = useState<"location" | "lot" | "quantity">(
        defaultLocationId ? "lot" : "location"
    )
    const [selectedLocationId, setSelectedLocationId] = useState<string>("")
    const [selectedLotId, setSelectedLotId] = useState<string>("")
    const [itemLots, setItemLots] = useState<any[]>([])

    // State for quantity adjustment
    const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
    const [newStockAmount, setNewStockAmount] = useState("")
    const [adjustmentNote, setAdjustmentNote] = useState("")

    // Refs for keyboard handling
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

    // Reset state when dialog opens/closes or item changes
    useEffect(() => {
        if (!open || !item) {
            setCurrentStep(defaultLocationId ? "lot" : "location")
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
    }, [open, item, defaultLocationId])

    // Auto-select and skip steps when dialog opens with data loaded
    useEffect(() => {
        if (!open || !item || itemLots === null) return

        // If there's only one location and no defaultLocationId, auto-select it
        if (!defaultLocationId && item.locations && item.locations.length === 1) {
            const singleLocation = item.locations[0]
            handleLocationSelected(singleLocation.locationId)
            return
        }

        // If defaultLocationId is provided, process it
        if (defaultLocationId) {
            setSelectedLocationId(defaultLocationId)
            handleLocationSelected(defaultLocationId)
        }
    }, [open, item, itemLots, defaultLocationId])

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

    // Handle location selection with auto-skip logic
    const handleLocationSelected = (locationId?: string) => {
        const locId = locationId || selectedLocationId

        if (!locId) {
            toast.error("Please select a location")
            return
        }

        // Update selected location if passed in
        if (locationId) {
            setSelectedLocationId(locationId)
        }

        // Check if there are lots available at the selected location
        const lotsAtLocation = itemLots.filter(lot =>
            lot.locations?.some((lotLoc: any) =>
                lotLoc.locationId === locId && lotLoc.quantity > 0
            )
        )

        // If there's only one lot at this location, auto-select it and skip to quantity
        if (lotsAtLocation.length === 1) {
            const singleLot = lotsAtLocation[0]
            setSelectedLotId(singleLot.id)

            // Get the lot location quantity
            const lotLocation = singleLot.locations?.find((l: any) => l.locationId === locId)
            const lotStock = lotLocation?.quantity || 0
            setNewStockAmount(String(lotStock))
            setCurrentStep("quantity")
        } else if (lotsAtLocation.length > 1) {
            // Multiple lots, show lot selection
            setCurrentStep("lot")
        } else {
            // No lots at this location, go straight to quantity adjustment
            const itemLocation = item?.locations?.find(loc => loc.locationId === locId)
            const locationStock = itemLocation?.quantity || 0
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
    const isLocationPreSelected = !!defaultLocationId
    const hasMultipleLocations = item.locations && item.locations.length > 1

    // Calculate actual steps shown (accounting for auto-skipped steps)
    const totalSteps = (() => {
        if (isLocationPreSelected || !hasMultipleLocations) {
            // Location step is skipped
            return hasLots ? 2 : 1
        } else {
            // Location step is shown
            return hasLots ? 3 : 2
        }
    })()

    const canSubmit = adjustmentQuantity &&
        adjustmentQuantity !== "0" &&
        adjustmentQuantity !== "+" &&
        adjustmentQuantity !== "-" &&
        Number.parseInt(newStockAmount) >= 0

    // Don't render location step if only one location and not pre-selected
    const shouldShowLocationStep = !defaultLocationId && hasMultipleLocations

    return (
        <>
            {/* Step 1: Select Location (only shown if multiple locations and no defaultLocationId) */}
            {shouldShowLocationStep && (
                <Dialog open={open && currentStep === "location"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                    <DialogContent
                        enableKeyboardAvoidance={true}
                        hideClose={true}
                        className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                    >
                        {/* Header */}
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            {/* Mobile Header */}
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onClose}
                                    className="h-9"
                                >
                                    Cancel
                                </Button>
                                <DialogTitle className="text-base font-semibold">
                                    Select Location
                                </DialogTitle>
                                <Button
                                    size="sm"
                                    onClick={() => handleLocationSelected()}
                                    disabled={!selectedLocationId}
                                    className="h-9"
                                >
                                    Next
                                </Button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden sm:block">
                                <DialogTitle className="text-base">
                                    Select Location (Step 1 of {totalSteps})
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Choose which location to adjust stock for.
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        {/* Scrollable Content */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="space-y-4">
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
                        </div>

                        {/* Desktop Footer */}
                        <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0">
                            <Button variant="outline" onClick={onClose} size="sm">
                                Cancel
                            </Button>
                            <Button onClick={() => handleLocationSelected()} disabled={!selectedLocationId} size="sm">
                                Next →
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Step 2: Select Lot (only for lot-tracked items with multiple lots) */}
            <Dialog open={open && currentStep === "lot"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent
                    enableKeyboardAvoidance={true}
                    hideClose={true}
                    className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                >
                    {/* Header */}
                    <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                        {/* Mobile Header */}
                        <div className="flex items-center justify-between gap-2 sm:hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={shouldShowLocationStep ? goBackToLocation : onClose}
                                className="h-9"
                            >
                                {shouldShowLocationStep ? 'Back' : 'Cancel'}
                            </Button>
                            <DialogTitle className="text-base font-semibold">
                                Select Lot
                            </DialogTitle>
                            <Button
                                size="sm"
                                onClick={handleLotSelected}
                                disabled={!selectedLotId}
                                className="h-9"
                            >
                                Next
                            </Button>
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden sm:block">
                            <DialogTitle className="text-base">
                                Select Lot
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Choose which lot to adjust at the selected location.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    {/* Scrollable Content */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="space-y-4">
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
                    </div>

                    {/* Desktop Footer */}
                    <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0">
                        {shouldShowLocationStep && (
                            <Button variant="outline" onClick={goBackToLocation} size="sm">
                                ← Back
                            </Button>
                        )}
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
                <DialogContent
                    enableKeyboardAvoidance={true}
                    hideClose={true}
                    className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                >
                    {/* Header */}
                    <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                        {/* Mobile Header */}
                        <div className="flex items-center justify-between gap-2 sm:hidden">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    if (hasLots && selectedLotId) {
                                        goBackToLot()
                                    } else if (shouldShowLocationStep) {
                                        goBackToLocation()
                                    } else {
                                        onClose()
                                    }
                                }}
                                className="h-9"
                            >
                                Back
                            </Button>
                            <DialogTitle className="text-base font-semibold">
                                Adjust Quantity
                            </DialogTitle>
                            <Button
                                size="sm"
                                onClick={handleStockAdjustment}
                                disabled={!canSubmit}
                                className="h-9"
                            >
                                Update
                            </Button>
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden sm:block">
                            <DialogTitle className="text-base">
                                Adjust Quantity
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Update the stock quantity at the selected location{selectedLotId ? ' for the selected lot' : ''}.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    {/* Scrollable Content */}
                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="space-y-3">
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
                                        autoComplete="off"
                                        inputMode="numeric"
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
                                    autoComplete="off"
                                    inputMode="numeric"
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
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Desktop Footer */}
                    <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (hasLots && selectedLotId) {
                                    goBackToLot()
                                } else if (shouldShowLocationStep) {
                                    goBackToLocation()
                                } else {
                                    onClose()
                                }
                            }}
                            size="sm"
                        >
                            ← Back
                        </Button>
                        <Button
                            onClick={handleStockAdjustment}
                            disabled={!canSubmit}
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