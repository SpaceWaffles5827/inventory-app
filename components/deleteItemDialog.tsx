"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, Trash2 } from "lucide-react"
import { deleteItemApi, type ItemWithRelations } from "@/lib/api/items.api"

interface DeleteItemDialogProps {
    item: ItemWithRelations | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function DeleteItemDialog({
    item,
    open,
    onOpenChange,
    onSuccess,
}: DeleteItemDialogProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [confirmStock, setConfirmStock] = useState("")

    const handleDelete = async () => {
        if (!item) return

        // Validate stock confirmation
        if (confirmStock !== item.onHand.toString()) {
            toast.error("Stock number does not match", {
                description: "Please enter the correct number of units in stock to confirm deletion."
            })
            return
        }

        setIsDeleting(true)
        try {
            await deleteItemApi(item.id)
            toast.success("Item deleted successfully")
            setConfirmStock("")
            onSuccess?.()
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to delete item:", error)
            toast.error(error instanceof Error ? error.message : "Failed to delete item")
        } finally {
            setIsDeleting(false)
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setConfirmStock("")
        }
        onOpenChange(newOpen)
    }

    const isDeleteEnabled = confirmStock === item?.onHand.toString()

    if (!item) return null

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                enableKeyboardAvoidance={true}
                hideClose={true}
                className="sm:max-w-[425px] max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
                data-testid="delete-item-dialog"
            >
                {/* Header */}
                <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                    {/* Mobile Header with Actions */}
                    <div className="flex items-center justify-between gap-2 sm:hidden relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenChange(false)}
                            disabled={isDeleting}
                            className="h-9"
                            data-testid="cancel-button-mobile"
                        >
                            Cancel
                        </Button>
                        <DialogTitle className="text-base font-semibold absolute left-1/2 -translate-x-1/2">Delete Item</DialogTitle>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting || !isDeleteEnabled}
                            className="h-9"
                            data-testid="submit-button-mobile"
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </Button>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden sm:block">
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Delete Item
                        </DialogTitle>
                        <DialogDescription className="mt-1.5">
                            Are you sure you want to delete this item? This action cannot be undone.
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Scrollable Content */}
                <div
                    className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                    style={{
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                            <p className="font-semibold text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Item #: {item.itemNumber}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Current Stock: {item.onHand} units
                            </p>
                            {item.onHand > 0 && (
                                <p className="text-xs text-destructive mt-2 font-medium">
                                    Warning: This item has {item.onHand} units in stock
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm-stock" className="text-sm font-medium">
                                Confirm Stock Quantity <span className="text-destructive">*</span>
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                To confirm deletion, please enter the current stock quantity: <span className="font-semibold">{item.onHand}</span>
                            </p>
                            <Input
                                id="confirm-stock"
                                type="number"
                                placeholder={`Enter ${item.onHand} to confirm`}
                                value={confirmStock}
                                onChange={(e) => setConfirmStock(e.target.value)}
                                autoComplete="off"
                                inputMode="numeric"
                                className={confirmStock && !isDeleteEnabled ? "border-destructive" : ""}
                                data-testid="confirm-stock-input"
                            />
                            {confirmStock && !isDeleteEnabled && (
                                <p className="text-xs text-destructive flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Stock quantity does not match
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer - Desktop Only */}
                <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isDeleting}
                        data-testid="cancel-button-desktop"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting || !isDeleteEnabled}
                        data-testid="submit-button-desktop"
                    >
                        {isDeleting ? (
                            <>Deleting...</>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Item
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
