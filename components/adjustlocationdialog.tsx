"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Plus, Minus, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { adjustLotQuantityApi } from "@/lib/api/lots.api"

interface AdjustingLocation {
    locationId: string
    locationCode: string
    currentQuantity: number
}

interface AdjustLocationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lotId: string
    adjustingLocation: AdjustingLocation | null
    onSuccess: () => void
}

export function AdjustLocationDialog({
    open,
    onOpenChange,
    lotId,
    adjustingLocation,
    onSuccess,
}: AdjustLocationDialogProps) {
    const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
    const [adjustmentNote, setAdjustmentNote] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Reset form when dialog opens with new location
    useEffect(() => {
        if (open && adjustingLocation) {
            setAdjustmentQuantity("")
            setAdjustmentNote("")
        }
    }, [open, adjustingLocation])

    const handleClose = () => {
        setAdjustmentQuantity("")
        setAdjustmentNote("")
        onOpenChange(false)
    }

    const handleAdjustLocation = async () => {
        if (!adjustingLocation || !adjustmentQuantity) {
            return
        }

        // Handle special cases
        if (adjustmentQuantity === "0" || adjustmentQuantity === "+" || adjustmentQuantity === "-") {
            toast.error("Please enter an adjustment amount")
            return
        }

        const quantity = parseInt(adjustmentQuantity)
        if (isNaN(quantity) || quantity === 0) {
            toast.error("Adjustment quantity cannot be zero")
            return
        }

        const isInput = quantity > 0
        const newQuantity = adjustingLocation.currentQuantity + quantity

        if (newQuantity < 0) {
            toast.error(`Cannot remove ${Math.abs(quantity)} units. Only ${adjustingLocation.currentQuantity} available.`)
            return
        }

        setIsSubmitting(true)
        try {
            await adjustLotQuantityApi(lotId, {
                type: isInput ? "INPUT" : "OUTPUT",
                quantity: Math.abs(quantity),
                reason: adjustmentNote || "Stock adjustment",
                locationId: adjustingLocation.locationId,
            })

            toast.success("Stock adjusted successfully")
            onSuccess()
            handleClose()
        } catch (error) {
            console.error("Failed to adjust stock:", error)
            toast.error(error instanceof Error ? error.message : "Failed to adjust stock")
        } finally {
            setIsSubmitting(false)
        }
    }

    const calculateNewQuantity = () => {
        if (!adjustingLocation) return 0
        if (adjustmentQuantity === "" || adjustmentQuantity === "+" || adjustmentQuantity === "-") {
            return adjustingLocation.currentQuantity
        }
        return adjustingLocation.currentQuantity + parseInt(adjustmentQuantity)
    }

    const newQuantity = calculateNewQuantity()
    const isInvalidQuantity = newQuantity < 0
    const isDisabled =
        !adjustmentQuantity ||
        adjustmentQuantity === "0" ||
        adjustmentQuantity === "+" ||
        adjustmentQuantity === "-" ||
        isInvalidQuantity ||
        isSubmitting

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="text-base">
                        Adjust Stock at {adjustingLocation?.locationCode}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Update the quantity for this lot at the selected location.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                    {/* Current Quantity Display */}
                    <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border">
                        <span className="text-xs text-muted-foreground">Current Quantity</span>
                        <span className="text-base font-bold">{adjustingLocation?.currentQuantity || 0}</span>
                    </div>

                    {/* Adjustment Amount with +/- Buttons */}
                    <div className="space-y-1">
                        <Label className="text-xs">Adjustment Amount</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    const current = parseInt(adjustmentQuantity) || 0
                                    setAdjustmentQuantity(String(current - 1))
                                }}
                                className="flex-shrink-0 h-9 w-9"
                                disabled={isSubmitting}
                            >
                                <Minus className="h-3.5 w-3.5" />
                            </Button>

                            <Input
                                type="text"
                                value={adjustmentQuantity > 0 ? `+${adjustmentQuantity}` : adjustmentQuantity === 0 ? "0" : `${adjustmentQuantity}`}
                                onChange={(e) => {
                                    const val = e.target.value
                                    if (val === "") {
                                        setAdjustmentQuantity("")
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
                                        const num = parseInt(finalValue)
                                        if (!isNaN(num)) {
                                            setAdjustmentQuantity(String(num))
                                        }
                                    }
                                }}
                                className="text-center font-semibold flex-1 min-w-0 h-9 text-sm"
                                placeholder="0"
                                disabled={isSubmitting}
                            />

                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                    const current = parseInt(adjustmentQuantity) || 0
                                    setAdjustmentQuantity(String(current + 1))
                                }}
                                className="flex-shrink-0 h-9 w-9"
                                disabled={isSubmitting}
                            >
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* New Quantity Display */}
                    <div className="space-y-1">
                        <Label htmlFor="newStock" className="text-xs">New Quantity</Label>
                        <Input
                            id="newStock"
                            type="number"
                            min="0"
                            value={newQuantity}
                            onChange={(e) => {
                                const newValue = parseInt(e.target.value)
                                if (!isNaN(newValue)) {
                                    const adjustment = newValue - (adjustingLocation?.currentQuantity || 0)
                                    setAdjustmentQuantity(String(adjustment))
                                }
                            }}
                            className="font-semibold h-9 text-sm"
                            disabled={isSubmitting}
                        />
                        {isInvalidQuantity && (
                            <Alert variant="destructive" className="py-1.5">
                                <AlertCircle className="h-3 w-3" />
                                <AlertDescription className="text-xs">Stock quantity cannot be negative.</AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Adjustment Note */}
                    <div className="space-y-1">
                        <Label htmlFor="note" className="text-xs">Note (Optional)</Label>
                        <Textarea
                            id="note"
                            placeholder="Reason for adjustment..."
                            value={adjustmentNote}
                            onChange={(e) => setAdjustmentNote(e.target.value)}
                            className="min-h-14 resize-none text-xs"
                            disabled={isSubmitting}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={handleClose}
                        size="sm"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleAdjustLocation}
                        disabled={isDisabled}
                        size="sm"
                    >
                        {isSubmitting ? "Updating..." : "Update Stock"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}