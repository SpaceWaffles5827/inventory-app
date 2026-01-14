"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { AlertCircle, Trash2, Loader2 } from "lucide-react"
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

    const handleDelete = async () => {
        if (!item) return

        setIsDeleting(true)
        try {
            await deleteItemApi(item.id)
            toast.success("Item deleted successfully")
            onSuccess?.()
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to delete item:", error)
            toast.error(error instanceof Error ? error.message : "Failed to delete item")
        } finally {
            setIsDeleting(false)
        }
    }

    if (!item) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        Delete Item
                    </DialogTitle>
                    <DialogDescription>
                        Are you sure you want to delete this item? This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
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
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isDeleting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Deleting...
                            </>
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