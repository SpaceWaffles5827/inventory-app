"use client"

import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Package, PackageCheck, Upload } from "lucide-react"
import type { ItemWithDetails } from "@/lib/api/items.api"
import type { ItemImage as APIItemImage } from "@/lib/api/itemImages.api"

interface ItemHeroSectionProps {
    item: ItemWithDetails
    isEditing: boolean
    formData: {
        name: string
    }
    lotTracking: boolean
    images: APIItemImage[]
    totalQuantity: number
    onFormDataChange: (formData: any) => void
    onImageClick: (imageUrl: string | null) => void
    onManageImagesOpen: () => void
}

export function ItemHeroSection({
    item,
    isEditing,
    formData,
    lotTracking,
    images,
    totalQuantity,
    onFormDataChange,
    onImageClick,
    onManageImagesOpen,
}: ItemHeroSectionProps) {
    const primaryImage = images.find((img) => img.isPrimary)
    const primaryImageUrl = primaryImage ? `/api/items/images/image/${primaryImage.id}` : null

    return (
        <div className="bg-card border rounded-lg overflow-hidden">
            <div className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    {/* Product Image */}
                    <div className="flex-shrink-0">
                        <div
                            className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center ${isEditing
                                    ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                    : primaryImageUrl
                                        ? "cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                                        : ""
                                }`}
                            onClick={() => {
                                if (isEditing) {
                                    onManageImagesOpen()
                                } else if (primaryImageUrl) {
                                    onImageClick(primaryImageUrl)
                                }
                            }}
                        >
                            {primaryImageUrl ? (
                                <>
                                    <img
                                        src={primaryImageUrl}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                    />
                                    {isEditing && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <Upload className="h-6 w-6 text-white" />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                    <Package className="h-8 w-8" />
                                    {isEditing && <span className="text-xs">Upload</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                        {isEditing ? (
                            <Input
                                value={formData.name}
                                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                                className="text-2xl font-bold h-auto py-2 mb-3 border-dashed"
                                placeholder="Enter item name"
                            />
                        ) : (
                            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{item.name}</h1>
                        )}

                        <div className="flex flex-wrap gap-2 mb-4">
                            <Badge
                                variant={
                                    item.status === "IN_STOCK" ? "default" : item.status === "LOW_STOCK" ? "secondary" : "destructive"
                                }
                            >
                                {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                            </Badge>
                            <Badge variant="outline">
                                {typeof item.category === 'string'
                                    ? item.category
                                    : item.category?.name || "Uncategorized"}
                            </Badge>
                            {lotTracking && (
                                <Badge className="bg-blue-500 hover:bg-blue-600">
                                    <PackageCheck className="h-3 w-3 mr-1" />
                                    Lot Tracked
                                </Badge>
                            )}
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">SKU</p>
                                <p className="text-sm font-semibold">{item.itemNumber}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Barcode</p>
                                <p className="text-sm font-semibold">{item.barcode || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Total Stock</p>
                                <p className="text-sm font-semibold text-primary">{totalQuantity} units</p>
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Unit Price</p>
                                <p className="text-sm font-semibold">${item.cost.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}