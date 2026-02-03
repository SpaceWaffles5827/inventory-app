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
    itemLocationsCount: number
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
    itemLocationsCount,
    onFormDataChange,
    onImageClick,
    onManageImagesOpen,
}: ItemHeroSectionProps) {
    const primaryImage = images.find((img) => img.isPrimary)
    const primaryImageUrl = primaryImage ? `/api/items/images/image/${primaryImage.id}` : null

    return (
        <div className="bg-card sm:border sm:rounded-lg overflow-hidden">
            {/* Large Product Image - Mobile Only */}
            <div
                className="sm:hidden relative w-full aspect-[35/10] bg-muted cursor-pointer overflow-hidden"
                onClick={() => {
                    if (primaryImageUrl) {
                        onImageClick(primaryImageUrl)
                    }
                }}
            >
                {primaryImageUrl ? (
                    <img
                        src={primaryImageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                        <Package className="h-16 w-16 text-muted-foreground/50" />
                    </div>
                )}

                {/* Image count badge */}
                {images.length > 1 && (
                    <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                        1/{images.length}
                    </div>
                )}

                {/* Status badge overlay */}
                <div className="absolute top-3 left-3">
                    <Badge
                        variant={item.status === "IN_STOCK" ? "default" : item.status === "LOW_STOCK" ? "secondary" : "destructive"}
                        className="shadow-lg"
                    >
                        {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                    </Badge>
                </div>
            </div>

            <div className="p-4 sm:p-6 pb-0">
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    {/* Product Image - Desktop Only */}
                    <div className="hidden sm:block flex-shrink-0">
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

                    {/* Item Info - Desktop */}
                    <div className="hidden sm:block flex-1 min-w-0">
                        {isEditing ? (
                            <Input
                                value={formData.name}
                                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                                className="text-2xl font-bold h-auto py-2 mb-3 border-dashed"
                                placeholder="Enter item name"
                                data-testid="edit-item-name-input"
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

                    {/* Item Info - Mobile */}
                    <div className="sm:hidden">
                        {isEditing ? (
                            <Input
                                value={formData.name}
                                onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
                                className="text-lg font-bold h-10 mb-2 border-dashed"
                                placeholder="Item name"
                                data-testid="edit-item-name-input"
                            />
                        ) : (
                            <h1 className="text-lg font-bold text-foreground leading-tight">{item.name}</h1>
                        )}

                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <Badge variant="outline" className="text-xs">
                                {typeof item.category === 'string' ? item.category : item.category?.name || "Uncategorized"}
                            </Badge>
                            {lotTracking && (
                                <Badge variant="secondary" className="text-xs gap-0.5">
                                    <PackageCheck className="h-2.5 w-2.5" />
                                    Lot
                                </Badge>
                            )}
                        </div>

                        {/* Stats Row */}
                        <div className="flex items-center justify-between mt-4 py-3 border-t border-b">
                            <div className="text-center flex-1">
                                <p className="text-2xl font-bold text-primary">{totalQuantity}</p>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">In Stock</p>
                            </div>
                            <div className="w-px h-10 bg-border" />
                            <div className="text-center flex-1">
                                <p className="text-lg font-semibold">${item.cost.toFixed(2)}</p>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unit Price</p>
                            </div>
                            <div className="w-px h-10 bg-border" />
                            <div className="text-center flex-1">
                                <p className="text-lg font-semibold">{itemLocationsCount}</p>
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Locations</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
