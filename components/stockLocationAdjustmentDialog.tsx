"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Minus, Plus } from "lucide-react"
import { adjustStockApi } from "@/lib/api/items.api"
import { adjustLotQuantityApi, type LotWithRelations } from "@/lib/api/lots.api"
import { toast } from "sonner"

interface StockLocationAdjustmentDialogProps {
    isOpen: boolean
    onClose: () => void
    itemId: string
    locationId: string | null
    currentQuantity: number
    lotTracking: boolean
    lots: LotWithRelations[]
    onSuccess: () => void
}

export function StockLocationAdjustmentDialog({
    isOpen,
    onClose,
    itemId,
    locationId,
    currentQuantity,
    lotTracking,
    lots,
    onSuccess,
}: StockLocationAdjustmentDialogProps) {
    const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
    const [newStockAmount, setNewStockAmount] = useState(String(currentQuantity))
    const [adjustmentNote, setAdjustmentNote] = useState("")
    const [selectedLotForAdjustment, setSelectedLotForAdjustment] = useState<string>("")
    const [lotsAtLocation, setLotsAtLocation] = useState<LotWithRelations[]>([])
    const [currentLotQuantity, setCurrentLotQuantity] = useState(currentQuantity)
    const [isSaving, setIsSaving] = useState(false)

    // Reset state when dialog opens/closes or when props change
    useEffect(() => {
        if (isOpen && locationId) {
            setAdjustmentQuantity("")
            setNewStockAmount(String(currentQuantity))
            setAdjustmentNote("")
            setSelectedLotForAdjustment("")
            setCurrentLotQuantity(currentQuantity)

            // If lot tracking is enabled, get lots at this location
            if (lotTracking && lots.length > 0) {
                const lotsHere = lots.filter((lot) =>
                    lot.locations.some((loc) => loc.locationId === locationId)
                )
                setLotsAtLocation(lotsHere)

                // Auto-select first lot
                if (lotsHere.length > 0) {
                    setSelectedLotForAdjustment(lotsHere[0].id)
                    const lotAtLocation = lotsHere[0].locations.find(
                        (loc) => loc.locationId === locationId
                    )
                    if (lotAtLocation) {
                        setCurrentLotQuantity(lotAtLocation.quantity)
                        setNewStockAmount(String(lotAtLocation.quantity))
                    }
                }
            }
        }
    }, [isOpen, locationId, currentQuantity, lotTracking, lots])

    const handleLotSelectionChange = (lotId: string) => {
        setSelectedLotForAdjustment(lotId)

        // Update current quantity based on selected lot
        const selectedLot = lotsAtLocation.find((l) => l.id === lotId)
        if (selectedLot && locationId) {
            const lotLocation = selectedLot.locations.find(
                (loc) => loc.locationId === locationId
            )
            if (lotLocation) {
                setCurrentLotQuantity(lotLocation.quantity)
                setNewStockAmount(String(lotLocation.quantity))
                setAdjustmentQuantity("")
            }
        }
    }

    const handleAdjustmentQuantityChange = (value: string) => {
        setAdjustmentQuantity(value)
        if (value && value !== "-" && value !== "+") {
            const qty = Number.parseInt(value)
            if (!isNaN(qty)) {
                const currentStock = currentLotQuantity
                setNewStockAmount(String(currentStock + qty))
            }
        }
    }

    const handleNewStockAmountChange = (value: string) => {
        setNewStockAmount(value)
        if (value) {
            const newStock = Number.parseInt(value)
            if (!isNaN(newStock)) {
                const currentStock = currentLotQuantity
                const adjustment = newStock - currentStock
                setAdjustmentQuantity(String(adjustment))
            }
        } else {
            setAdjustmentQuantity("")
        }
    }

    const incrementQuantity = () => {
        const current = Number.parseInt(adjustmentQuantity || "0")
        handleAdjustmentQuantityChange(String(current + 1))
    }

    const decrementQuantity = () => {
        const current = Number.parseInt(adjustmentQuantity || "0")
        handleAdjustmentQuantityChange(String(current - 1))
    }

    const handleStockAdjustment = async () => {
        if (!locationId || !adjustmentQuantity || adjustmentQuantity === "0") {
            return
        }

        const quantity = Number.parseInt(adjustmentQuantity)
        const isInput = quantity > 0

        setIsSaving(true)
        try {
            // If lot tracking is enabled and a lot is selected, adjust lot quantity
            if (lotTracking && selectedLotForAdjustment) {
                await adjustLotQuantityApi(selectedLotForAdjustment, {
                    type: isInput ? "INPUT" : "OUTPUT",
                    quantity: Math.abs(quantity),
                    reason: adjustmentNote || "Lot adjustment",
                    locationId: locationId,
                })
            } else {
                // Regular stock adjustment (non-lot-tracked items)
                await adjustStockApi(itemId, {
                    type: isInput ? "INPUT" : "OUTPUT",
                    quantity: Math.abs(quantity),
                    reason: adjustmentNote || "Stock adjustment",
                    locationId: locationId,
                })
            }

            toast.success("Stock updated successfully")
            onSuccess()
            onClose()
        } catch (error) {
            console.error("Failed to adjust stock:", error)
            toast.error(error instanceof Error ? error.message : "Failed to adjust stock")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        {lotTracking ? "Adjust Lot Stock at Location" : "Adjust Stock at Location"}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {lotTracking
                            ? "Select a lot and update the quantity for this location."
                            : "Update the quantity for this item at the selected location."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                    {/* Lot Selection (only shown if lot tracking is enabled) */}
                    {lotTracking && lotsAtLocation.length > 0 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Select Lot to Adjust</Label>
                            <Select value={selectedLotForAdjustment} onValueChange={handleLotSelectionChange}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select a lot" />
                                </SelectTrigger>
                                <SelectContent>
                                    {lotsAtLocation
                                        .sort((a, b) => {
                                            // Sort by expiration date (FIFO), but prioritize lots with quantity > 0
                                            const aHasQty =
                                                a.locations.find((loc) => loc.locationId === locationId)?.quantity || 0
                                            const bHasQty =
                                                b.locations.find((loc) => loc.locationId === locationId)?.quantity || 0

                                            // Lots with quantity come first
                                            if (aHasQty > 0 && bHasQty === 0) return -1
                                            if (aHasQty === 0 && bHasQty > 0) return 1

                                            // Then sort by expiration date (FIFO)
                                            if (a.expirationDate && b.expirationDate) {
                                                return (
                                                    new Date(a.expirationDate).getTime() -
                                                    new Date(b.expirationDate).getTime()
                                                )
                                            }
                                            if (a.expirationDate) return -1
                                            if (b.expirationDate) return 1
                                            return (
                                                new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()
                                            )
                                        })
                                        .map((lot) => {
                                            const lotLocation = lot.locations.find(
                                                (loc) => loc.locationId === locationId
                                            )
                                            const daysToExpiry = lot.expirationDate
                                                ? Math.ceil(
                                                    (new Date(lot.expirationDate).getTime() - new Date().getTime()) /
                                                    (1000 * 60 * 60 * 24)
                                                )
                                                : null

                                            return (
                                                <SelectItem key={lot.id} value={lot.id}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-semibold">{lot.lotNumber}</span>
                                                        <span
                                                            className={
                                                                lotLocation?.quantity === 0
                                                                    ? "text-muted-foreground line-through"
                                                                    : "text-muted-foreground"
                                                            }
                                                        >
                                                            ({lotLocation?.quantity || 0} units)
                                                        </span>
                                                        {lotLocation?.quantity === 0 && (
                                                            <Badge variant="outline" className="text-muted-foreground">
                                                                Depleted
                                                            </Badge>
                                                        )}
                                                        {daysToExpiry !== null &&
                                                            daysToExpiry <= 30 &&
                                                            lotLocation &&
                                                            lotLocation.quantity > 0 && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className={
                                                                        daysToExpiry < 0
                                                                            ? "text-red-600 border-red-600"
                                                                            : daysToExpiry <= 7
                                                                                ? "text-orange-500 border-orange-500"
                                                                                : "text-yellow-600 border-yellow-600"
                                                                    }
                                                                >
                                                                    {daysToExpiry < 0 ? "Expired" : `${daysToExpiry}d`}
                                                                </Badge>
                                                            )}
                                                    </div>
                                                </SelectItem>
                                            )
                                        })}
                                </SelectContent>
                            </Select>
                            {lotsAtLocation.length > 1 && (
                                <p className="text-xs text-muted-foreground">
                                    Lots sorted by expiration (FIFO) - adjust oldest first
                                </p>
                            )}
                        </div>
                    )}

                    {lotTracking && lotsAtLocation.length === 0 && (
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                                No lots available at this location. Create a new lot to add stock.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Current Quantity Display */}
                    {(!lotTracking || selectedLotForAdjustment) && (
                        <>
                            <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border">
                                <span className="text-xs text-muted-foreground">Current Quantity</span>
                                <span className="text-base font-bold">{currentLotQuantity}</span>
                            </div>

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
                                        <Minus className="h-3.5 w-3.5" />
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
                                                setNewStockAmount(String(currentLotQuantity))
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
                                    />

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={incrementQuantity}
                                        className="flex-shrink-0 h-9 w-9"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="newStock" className="text-xs">
                                    New Quantity
                                </Label>
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
                                        <AlertCircle className="h-3 w-3" />
                                        <AlertDescription className="text-xs">
                                            Stock quantity cannot be negative.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="note" className="text-xs">
                                    Note (Optional)
                                </Label>
                                <Textarea
                                    id="note"
                                    placeholder="Reason for adjustment..."
                                    value={adjustmentNote}
                                    onChange={(e) => setAdjustmentNote(e.target.value)}
                                    className="min-h-14 resize-none text-xs"
                                />
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} size="sm" disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleStockAdjustment}
                        disabled={
                            !adjustmentQuantity ||
                            adjustmentQuantity === "0" ||
                            Number.parseInt(newStockAmount) < 0 ||
                            (lotTracking && !selectedLotForAdjustment) ||
                            isSaving
                        }
                        size="sm"
                    >
                        Update Stock
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}