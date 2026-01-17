"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { X } from "lucide-react"

interface ImagePreviewDialogProps {
    imageUrl: string | null
    onClose: () => void
}

export function ImagePreviewDialog({ imageUrl, onClose }: ImagePreviewDialogProps) {
    return (
        <Dialog open={!!imageUrl} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl p-0">
                <div className="relative">
                    <img
                        src={imageUrl || ""}
                        alt="Selected Product Image"
                        className="w-full max-h-[80vh] object-contain"
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}