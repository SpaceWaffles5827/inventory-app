"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { ImageIcon, Upload, Plus, Star, Trash2, Loader2 } from "lucide-react"
import {
    smartUploadImageApi,
    setPrimaryImageApi,
    deleteItemImageApi,
    getItemImagesApi,
    type ItemImage as APIItemImage
} from "@/lib/api/itemImages.api"
import { toast } from "sonner"

interface ManageImagesDialogProps {
    isOpen: boolean
    onClose: () => void
    itemId: string
    images: APIItemImage[]
    onImagesChange: (images: APIItemImage[]) => void
    onImageClick: (imageUrl: string) => void
}

export function ManageImagesDialog({
    isOpen,
    onClose,
    itemId,
    images,
    onImagesChange,
    onImageClick,
}: ManageImagesDialogProps) {
    const [isUploadingImage, setIsUploadingImage] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)

    const handleSetPrimaryImage = async (imageId: string) => {
        try {
            await setPrimaryImageApi(imageId)
            onImagesChange(
                images.map((img) => ({
                    ...img,
                    isPrimary: img.id === imageId,
                }))
            )
            toast.success("Primary image updated")
        } catch (error) {
            console.error("Failed to set primary image:", error)
            toast.error("Failed to set primary image")
        }
    }

    const handleDeleteImage = async (imageId: string) => {
        try {
            await deleteItemImageApi(imageId)
            onImagesChange(images.filter((img) => img.id !== imageId))
            toast.success("Image deleted")
        } catch (error) {
            console.error("Failed to delete image:", error)
            toast.error("Failed to delete image")
        }
    }

    const handleUploadImages = () => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = "image/jpeg,image/png,image/gif,image/webp"
        input.multiple = true
        input.onchange = async (e) => {
            const files = (e.target as HTMLInputElement).files
            if (!files || files.length === 0) return

            setIsUploadingImage(true)
            setUploadProgress(0)

            try {
                const isPrimary = images.length === 0

                for (let i = 0; i < files.length; i++) {
                    const file = files[i]
                    const isFirst = i === 0

                    await smartUploadImageApi(
                        itemId,
                        file,
                        isPrimary && isFirst,
                        (progress) => {
                            setUploadProgress(Math.round(((i + progress / 100) / files.length) * 100))
                        }
                    )
                }

                // Reload images
                const response = await getItemImagesApi(itemId)
                if (response.data?.images) {
                    onImagesChange(response.data.images as APIItemImage[])
                }

                toast.success(`${files.length} image(s) uploaded successfully`)
            } catch (error) {
                console.error("Failed to upload images:", error)
                toast.error("Failed to upload images")
            } finally {
                setIsUploadingImage(false)
                setUploadProgress(0)
            }
        }
        input.click()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[650px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <ImageIcon className="h-4 w-4 text-primary" />
                        </div>
                        Product Images
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Upload and manage photos. The primary image appears on the item card.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-3">
                    <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed rounded-xl hover:border-primary/50 hover:bg-muted/30 transition-all">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center mb-1.5">
                            <Upload className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground mb-2 text-center">
                            Drag and drop images or click to browse
                        </p>
                        <Button
                            onClick={handleUploadImages}
                            variant="outline"
                            size="sm"
                            className="gap-1.5 h-7"
                            disabled={isUploadingImage}
                        >
                            {isUploadingImage ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Uploading... {uploadProgress}%
                                </>
                            ) : (
                                <>
                                    <Plus className="h-3.5 w-3.5" />
                                    Select Images
                                </>
                            )}
                        </Button>
                    </div>

                    {images.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                                <ImageIcon className="h-5 w-5 opacity-30" />
                            </div>
                            <p className="text-xs font-medium">No images yet</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Upload your first product image</p>
                        </div>
                    ) : (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Gallery ({images.length})
                                </h3>
                            </div>
                            <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto pr-1">
                                {images.map((image) => (
                                    <div
                                        key={image.id}
                                        className="relative group aspect-square rounded-lg overflow-hidden border-2 hover:border-primary/50 transition-all bg-muted cursor-pointer"
                                        onClick={() => onImageClick(`/api/items/images/image/${image.id}`)}
                                    >
                                        <img
                                            src={`/api/items/images/image/${image.id}`}
                                            alt="Product"
                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                        />

                                        {image.isPrimary && (
                                            <div className="absolute top-1.5 left-1.5">
                                                <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white shadow-lg border-0 text-xs py-0 px-1">
                                                    <Star className="h-2 w-2 mr-0.5 fill-current" />
                                                    Primary
                                                </Badge>
                                            </div>
                                        )}

                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-200">
                                            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1">
                                                {!image.isPrimary ? (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        className="flex-1 bg-white/90 hover:bg-white backdrop-blur-sm h-6 text-xs"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleSetPrimaryImage(image.id)
                                                        }}
                                                    >
                                                        <Star className="h-2.5 w-2.5 mr-0.5" />
                                                        Set Primary
                                                    </Button>
                                                ) : (
                                                    <div className="flex-1" />
                                                )}
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="shadow-lg h-6 w-6 p-0"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDeleteImage(image.id)
                                                    }}
                                                >
                                                    <Trash2 className="h-2.5 w-2.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {images.length > 0 && (
                        <div className="bg-muted/50 rounded-lg p-2.5">
                            <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Tip:</span> Click to preview • Hover to set primary or delete
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={onClose} className="w-full sm:w-auto" size="sm">
                        Done
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}