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
    const [newDestinationQuantity, setNewDestinationQuantity] = useState("")

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

                setTimeout(() => {
                    if (scrollContainerRef.current && focusedInputRef.current) {
                        const container = scrollContainerRef.current
                        const input = focusedInputRef.current

                        const containerRect = container.getBoundingClientRect()
                        const inputRect = input.getBoundingClientRect()

                        const scrollTop = container.scrollTop
                        const inputTop = inputRect.top - containerRect.top
                        const targetScroll = scrollTop + inputTop - 100

                        container.scrollTo({
                            top: Math.max(0, targetScroll),
                            behavior: 'smooth'
                        })
                    }
                }, 300)
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

    // Auto-select and skip steps when dialog opens
    useEffect(() => {
        if (!open || !item) return

        // Wait for lots to load if item is lot-tracked
        if (item.lotTracking && itemLots.length === 0) return

        // Get locations with stock
        const locationsWithStock = item.locations?.filter(loc => loc.quantity > 0) || []

        // If only one source location, auto-select it
        if (locationsWithStock.length === 1) {
            const singleSource = locationsWithStock[0]
            setSourceLocationId(singleSource.locationId)
            processSourceSelection(singleSource.locationId)
        }
    }, [open, item, itemLots])

    // Process source selection and auto-skip if needed
    const processSourceSelection = (sourceLocId: string) => {
        // Check for lots at this location
        const lotsAtLocation = itemLots.filter(lot =>
            lot.locations?.some((lotLoc: any) =>
                lotLoc.locationId === sourceLocId && lotLoc.quantity > 0
            )
        )

        // If only one lot, auto-select it
        if (lotsAtLocation.length === 1) {
            const singleLot = lotsAtLocation[0]
            setLotId(singleLot.id)
            // Skip directly to destination (or quantity if only one destination)
            processLotSelection(sourceLocId, singleLot.id)
        } else if (lotsAtLocation.length > 1) {
            // Multiple lots, show lot selection
            setCurrentStep("lot")
        } else {
            // No lots, check destinations
            processNoLotScenario(sourceLocId)
        }
    }

    // Process lot selection
    const processLotSelection = (sourceLocId: string, selectedLotId: string) => {
        const availableDestinations = locations.filter(loc => loc.id !== sourceLocId)

        // If only one destination, auto-select it and go to quantity
        if (availableDestinations.length === 1) {
            setDestinationLocationId(availableDestinations[0].id)
            setCurrentStep("quantity")
        } else {
            setCurrentStep("destination")
        }
    }

    // Process scenario with no lots
    const processNoLotScenario = (sourceLocId: string) => {
        const availableDestinations = locations.filter(loc => loc.id !== sourceLocId)

        // If only one destination, auto-select it and go to quantity
        if (availableDestinations.length === 1) {
            setDestinationLocationId(availableDestinations[0].id)
            setCurrentStep("quantity")
        } else {
            setCurrentStep("destination")
        }
    }

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

    // Get current quantity at destination
    const getCurrentDestinationQuantity = () => {
        if (!item || !destinationLocationId) return 0

        const itemLocation = item.locations?.find(
            loc => loc.locationId === destinationLocationId
        )
        return itemLocation?.quantity || 0
    }

    // Handle transfer quantity changes (similar to adjustment amount)
    const handleTransferQuantityChange = (value: string) => {
        setTransferQuantity(value)
        if (value) {
            const qty = Number.parseInt(value)
            if (!isNaN(qty) && qty > 0) {
                const currentDest = getCurrentDestinationQuantity()
                setNewDestinationQuantity(String(currentDest + qty))
            }
        } else {
            setNewDestinationQuantity(String(getCurrentDestinationQuantity()))
        }
    }

    // Handle new destination quantity changes
    const handleNewDestinationQuantityChange = (value: string) => {
        setNewDestinationQuantity(value)
        if (value) {
            const newQty = Number.parseInt(value)
            if (!isNaN(newQty)) {
                const currentDest = getCurrentDestinationQuantity()
                const transfer = newQty - currentDest
                setTransferQuantity(String(Math.max(0, transfer)))
            }
        } else {
            setTransferQuantity("")
        }
    }

    const incrementTransferQuantity = () => {
        const current = Number.parseInt(transferQuantity || "0")
        const max = getMaxTransferQuantity()
        if (current < max) {
            handleTransferQuantityChange(String(current + 1))
        }
    }

    const decrementTransferQuantity = () => {
        const current = Number.parseInt(transferQuantity || "0")
        if (current > 1) {
            handleTransferQuantityChange(String(current - 1))
        }
    }

    // Handle source location selection
    const handleSourceLocationSelected = () => {
        if (!sourceLocationId) {
            toast.error("Please select a source location")
            return
        }

        processSourceSelection(sourceLocationId)
    }

    // Handle lot selection
    const handleLotSelected = () => {
        if (!lotId) {
            toast.error("Please select a lot")
            return
        }

        processLotSelection(sourceLocationId, lotId)
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
    const locationsWithStock = item.locations?.filter(loc => loc.quantity > 0) || []
    const shouldShowSourceStep = locationsWithStock.length > 1
    const shouldShowDestinationStep = locations.filter(loc => loc.id !== sourceLocationId).length > 1

    const canSubmit = transferQuantity &&
        parseInt(transferQuantity) > 0 &&
        parseInt(transferQuantity) <= getMaxTransferQuantity()

    return (
        <>
            {/* Step 1: Select Source Location - Only show if multiple sources */}
            {shouldShowSourceStep && (
                <Dialog open={open && currentStep === "source"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                    <DialogContent
                        enableKeyboardAvoidance={true}
                        hideClose={true}
                        className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                        data-testid="transfer-stock-dialog-source"
                    >
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button variant="ghost" size="sm" onClick={onClose} className="h-9">Cancel</Button>
                                <DialogTitle className="text-base font-semibold flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    Transfer From
                                </DialogTitle>
                                <Button
                                    size="sm"
                                    onClick={handleSourceLocationSelected}
                                    disabled={!sourceLocationId}
                                    className="h-9"
                                    data-testid="transfer-stock-next-button"
                                >
                                    Next
                                </Button>
                            </div>
                            <div className="hidden sm:block">
                                <DialogTitle className="text-base flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    Transfer Stock - Select Source
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Select the source location to transfer stock from.
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="space-y-4">
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

                                <div className="space-y-2">
                                    <Label className="text-xs flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        Source Location (Transfer From)
                                    </Label>
                                    <RadioGroup value={sourceLocationId} onValueChange={setSourceLocationId}>
                                        <div className="space-y-1.5">
                                            {locationsWithStock.map((itemLocation) => (
                                                <div
                                                    key={itemLocation.id}
                                                    className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${sourceLocationId === itemLocation.locationId
                                                        ? "border-primary bg-primary/5"
                                                        : "border-border hover:border-primary/50"
                                                        }`}
                                                    onClick={() => setSourceLocationId(itemLocation.locationId)}
                                                    data-testid={`transfer-source-option-${itemLocation.location.code.toLowerCase().replace(/\s+/g, "-")}`}
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
                                            ))}
                                        </div>
                                    </RadioGroup>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0">
                            <Button variant="outline" onClick={onClose} size="sm">Cancel</Button>
                            <Button
                                onClick={handleSourceLocationSelected}
                                disabled={!sourceLocationId}
                                size="sm"
                                data-testid="transfer-stock-next-button"
                            >
                                Next →
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Step 2: Select Lot - Only show if multiple lots */}
            <Dialog open={open && currentStep === "lot"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent
                    enableKeyboardAvoidance={true}
                    hideClose={true}
                    className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                    data-testid="transfer-stock-dialog-lot"
                >
                    <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                        <div className="flex items-center justify-between gap-2 sm:hidden">
                            <Button variant="ghost" size="sm" onClick={shouldShowSourceStep ? goBackToSource : onClose} className="h-9">
                                {shouldShowSourceStep ? 'Back' : 'Cancel'}
                            </Button>
                            <DialogTitle className="text-base font-semibold">Select Lot</DialogTitle>
                            <Button
                                size="sm"
                                onClick={handleLotSelected}
                                disabled={!lotId}
                                className="h-9"
                                data-testid="transfer-stock-next-button"
                            >
                                Next
                            </Button>
                        </div>
                        <div className="hidden sm:block">
                            <DialogTitle className="text-base flex items-center gap-2">
                                <ArrowRightLeft className="h-4 w-4" />
                                Transfer Stock - Select Lot
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Select which lot/batch to transfer.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
                                <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs truncate">{item.name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        From: {item.locations?.find(l => l.locationId === sourceLocationId)?.location.code}
                                    </p>
                                </div>
                            </div>

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
                                                    if (!a.expirationDate) return 1
                                                    if (!b.expirationDate) return -1
                                                    return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime()
                                                })

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
                                                        data-testid={`transfer-lot-option-${lot.lotNumber.toLowerCase().replace(/\s+/g, "-")}`}
                                                    >
                                                        <RadioGroupItem value={lot.id} id={`transfer-lot-${lot.id}`} className="flex-shrink-0" />
                                                        <Label htmlFor={`transfer-lot-${lot.id}`} className="flex-1 cursor-pointer min-w-0">
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
                    </div>

                    <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0">
                        {shouldShowSourceStep && (
                            <Button variant="outline" onClick={goBackToSource} size="sm">← Back</Button>
                        )}
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setLotId("")
                                processNoLotScenario(sourceLocationId)
                            }}
                            size="sm"
                            className="text-xs"
                        >
                            Skip (Transfer Non-Lotted)
                        </Button>
                        <Button
                            onClick={handleLotSelected}
                            disabled={!lotId}
                            size="sm"
                            data-testid="transfer-stock-next-button"
                        >
                            Next →
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Step 3: Select Destination - Only show if multiple destinations */}
            {shouldShowDestinationStep && (
                <Dialog open={open && currentStep === "destination"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                    <DialogContent
                        enableKeyboardAvoidance={true}
                        hideClose={true}
                        className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                        data-testid="transfer-stock-dialog-destination"
                    >
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button variant="ghost" size="sm" onClick={() => {
                                    if (hasLots && lotId) {
                                        goBackToLot()
                                    } else if (shouldShowSourceStep) {
                                        goBackToSource()
                                    } else {
                                        onClose()
                                    }
                                }} className="h-9">Back</Button>
                                <DialogTitle className="text-base font-semibold">Transfer To</DialogTitle>
                                <Button
                                    size="sm"
                                    onClick={handleDestinationLocationSelected}
                                    disabled={!destinationLocationId}
                                    className="h-9"
                                    data-testid="transfer-stock-next-button"
                                >
                                    Next
                                </Button>
                            </div>
                            <div className="hidden sm:block">
                                <DialogTitle className="text-base flex items-center gap-2">
                                    <ArrowRightLeft className="h-4 w-4" />
                                    Transfer Stock - Select Destination
                                </DialogTitle>
                                <DialogDescription className="text-xs">
                                    Select the destination location to transfer stock to.
                                </DialogDescription>
                            </div>
                        </DialogHeader>

                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="space-y-4">
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

                                <div className="space-y-2">
                                    <Label className="text-xs flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        Destination Location (Transfer To)
                                    </Label>
                                    <RadioGroup value={destinationLocationId} onValueChange={setDestinationLocationId}>
                                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                                            {locations
                                                .filter(loc => loc.id !== sourceLocationId)
                                                .map((location) => {
                                                    const itemLocation = item.locations?.find(il => il.locationId === location.id)
                                                    const currentQty = itemLocation?.quantity || 0

                                                    return (
                                                        <div
                                                            key={location.id}
                                                            className={`flex items-center space-x-2 p-2.5 rounded-lg border transition-colors cursor-pointer ${destinationLocationId === location.id
                                                                ? "border-primary bg-primary/5"
                                                                : "border-border hover:border-primary/50"
                                                                }`}
                                                            onClick={() => setDestinationLocationId(location.id)}
                                                            data-testid={`transfer-destination-option-${location.code.toLowerCase().replace(/\s+/g, "-")}`}
                                                        >
                                                            <RadioGroupItem value={location.id} id={`transfer-dest-${location.id}`} className="flex-shrink-0" />
                                                            <Label htmlFor={`transfer-dest-${location.id}`} className="flex-1 cursor-pointer min-w-0">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-mono font-semibold text-xs truncate">{location.code}</p>
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
                                                })}
                                        </div>
                                    </RadioGroup>
                                </div>

                                {destinationLocationId && (
                                    <Alert className="py-2">
                                        <AlertCircle className="h-3.5 w-3.5 text-blue-600" />
                                        <AlertDescription className="text-xs text-blue-800">
                                            {(() => {
                                                const destLocation = item.locations?.find(il => il.locationId === destinationLocationId)
                                                return destLocation
                                                    ? `This item currently has ${destLocation.quantity} units at this location.`
                                                    : "This location will be added to the item's storage locations."
                                            })()}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </div>

                        <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0">
                            <Button variant="outline" onClick={() => {
                                if (hasLots && lotId) {
                                    goBackToLot()
                                } else if (shouldShowSourceStep) {
                                    goBackToSource()
                                }
                            }} size="sm">← Back</Button>
                            <Button
                                onClick={handleDestinationLocationSelected}
                                disabled={!destinationLocationId}
                                size="sm"
                                data-testid="transfer-stock-next-button"
                            >
                                Next →
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Step 4: Enter Quantity */}
            <Dialog open={open && currentStep === "quantity"} onOpenChange={(isOpen) => !isOpen && onClose()}>
                <DialogContent
                    enableKeyboardAvoidance={true}
                    hideClose={true}
                    className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                    data-testid="transfer-stock-dialog-quantity"
                >
                    <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                        <div className="flex items-center justify-between gap-2 sm:hidden">
                            <Button variant="ghost" size="sm" onClick={() => {
                                if (shouldShowDestinationStep) {
                                    goBackToDestination()
                                } else if (hasLots && lotId) {
                                    goBackToLot()
                                } else if (shouldShowSourceStep) {
                                    goBackToSource()
                                } else {
                                    onClose()
                                }
                            }} className="h-9">Back</Button>
                            <DialogTitle className="text-base font-semibold">Transfer Qty</DialogTitle>
                            <Button
                                size="sm"
                                onClick={handleTransferStock}
                                disabled={!canSubmit}
                                className="h-9 bg-blue-600 hover:bg-blue-700"
                                data-testid="transfer-stock-submit-button"
                            >
                                Transfer
                            </Button>
                        </div>
                        <div className="hidden sm:block">
                            <DialogTitle className="text-base flex items-center gap-2">
                                <ArrowRightLeft className="h-4 w-4" />
                                Transfer Stock - Enter Quantity
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Enter the quantity to transfer.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="space-y-3">
                            {/* Context Info */}
                            <div className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg border">
                                <ArrowRightLeft className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-xs truncate">{item.name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {item.locations?.find(l => l.locationId === sourceLocationId)?.location.code}
                                        {" → "}
                                        {locations.find(l => l.id === destinationLocationId)?.code}
                                        {lotId && <> | Lot: {itemLots.find(l => l.id === lotId)?.lotNumber}</>}
                                    </p>
                                </div>
                            </div>

                            {/* Available Quantity */}
                            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border">
                                <span className="text-xs text-muted-foreground">Available to Transfer</span>
                                <span className="text-base font-bold">{getMaxTransferQuantity()}</span>
                            </div>

                            {/* Transfer Quantity with +/- Buttons */}
                            <div className="space-y-1">
                                <Label className="text-xs">Transfer Quantity</Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={decrementTransferQuantity}
                                        disabled={!transferQuantity || parseInt(transferQuantity) <= 1}
                                        className="flex-shrink-0 h-9 w-9"
                                    >
                                        <span className="text-lg">−</span>
                                    </Button>

                                    <Input
                                        type="text"
                                        value={transferQuantity}
                                        onChange={(e) => {
                                            const val = e.target.value
                                            if (val === "") {
                                                setTransferQuantity("")
                                                setNewDestinationQuantity(String(getCurrentDestinationQuantity()))
                                                return
                                            }
                                            const cleaned = val.replace(/[^0-9]/g, "")
                                            const num = Number.parseInt(cleaned)
                                            if (!isNaN(num) && num >= 0) {
                                                handleTransferQuantityChange(cleaned)
                                            }
                                        }}
                                        placeholder="0"
                                        className="text-center font-semibold flex-1 min-w-0 h-9 text-sm"
                                        autoComplete="off"
                                        inputMode="numeric"
                                        data-testid="transfer-stock-quantity-input"
                                    />

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={incrementTransferQuantity}
                                        disabled={transferQuantity && parseInt(transferQuantity) >= getMaxTransferQuantity()}
                                        className="flex-shrink-0 h-9 w-9"
                                    >
                                        <span className="text-lg">+</span>
                                    </Button>
                                </div>
                                {transferQuantity && parseInt(transferQuantity) > getMaxTransferQuantity() && (
                                    <Alert variant="destructive" className="py-1.5">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        <AlertDescription className="text-xs">
                                            Cannot transfer more than {getMaxTransferQuantity()} units.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>

                            {/* New Destination Quantity Input */}
                            <div className="space-y-1">
                                <Label htmlFor="newDestQty" className="text-xs">New Quantity at Destination</Label>
                                <Input
                                    id="newDestQty"
                                    type="number"
                                    min={getCurrentDestinationQuantity()}
                                    value={newDestinationQuantity}
                                    onChange={(e) => handleNewDestinationQuantityChange(e.target.value)}
                                    className="font-semibold h-9 text-sm"
                                    autoComplete="off"
                                    inputMode="numeric"
                                    data-testid="transfer-stock-new-destination-input"
                                />
                                {newDestinationQuantity && Number.parseInt(newDestinationQuantity) < getCurrentDestinationQuantity() && (
                                    <Alert variant="destructive" className="py-1.5">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        <AlertDescription className="text-xs">
                                            Destination quantity cannot be less than current ({getCurrentDestinationQuantity()}).
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>

                            {/* Transaction Note */}
                            <div className="space-y-1">
                                <Label htmlFor="transferNote" className="text-xs">Transaction Note (Optional)</Label>
                                <Textarea
                                    id="transferNote"
                                    placeholder="Reason for transfer..."
                                    value={transferNote}
                                    onChange={(e) => setTransferNote(e.target.value)}
                                    className="min-h-14 resize-none text-xs"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    data-testid="transfer-stock-note-input"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0">
                        <Button variant="outline" onClick={goBackToDestination} size="sm">← Back</Button>
                        <Button
                            onClick={handleTransferStock}
                            disabled={!canSubmit}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            data-testid="transfer-stock-submit-button"
                        >
                            Transfer Stock
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
