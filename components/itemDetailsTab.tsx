"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
    Building2, ImageIcon, Upload, Star, Package, Scan, PackageCheck, Plus
} from "lucide-react"
import type { ItemWithDetails } from "@/lib/api/items.api"
import type { CategoryWithCount } from "@/lib/api/categories.api"
import type { SupplierWithCount } from "@/lib/api/suppliers.api"
import type { ItemImage as APIItemImage } from "@/lib/api/itemImages.api"

interface ItemDetailsTabProps {
    item: ItemWithDetails
    isEditing: boolean
    formData: {
        itemNumber: string
        name: string
        barcode: string
        description: string
        cost: string
        unit: string
        categoryId: string
        supplierId: string
    }
    lotTracking: boolean
    categories: CategoryWithCount[]
    suppliers: SupplierWithCount[]
    images: APIItemImage[]
    totalQuantity: number
    itemLocationsCount: number
    onFormDataChange: (formData: any) => void
    onLotTrackingChange: (enabled: boolean) => void
    onOpenBarcodeScanner: () => void
    onOpenManageImages: () => void
    onImageClick: (imageUrl: string) => void
    onOpenManageCustomers: () => void
}

export function ItemDetailsTab({
    item,
    isEditing,
    formData,
    lotTracking,
    categories,
    suppliers,
    images,
    totalQuantity,
    itemLocationsCount,
    onFormDataChange,
    onLotTrackingChange,
    onOpenBarcodeScanner,
    onOpenManageImages,
    onImageClick,
    onOpenManageCustomers,
}: ItemDetailsTabProps) {
    return (
        <div className="bg-card sm:border sm:border-t-0 sm:rounded-b-lg">
            <div className="sm:grid sm:grid-cols-3 sm:gap-4 sm:p-4">
                {/* Main Content */}
                <div className="sm:col-span-2 space-y-0 sm:space-y-3">
                    {/* Item Info Section */}
                    <div className="p-4 border-b sm:border sm:rounded-lg sm:border-b">
                        {/* <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Item Information</h3> */}
                        {/* Lot Tracking Toggle */}
                        {isEditing && (
                            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg mb-4">
                                <div className="flex items-center gap-2">
                                    <PackageCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <div>
                                        <Label htmlFor="lotTracking" className="text-sm font-medium">Enable Lot Tracking</Label>
                                        <p className="text-xs text-muted-foreground">Track batches with expiration dates</p>
                                    </div>
                                </div>
                                <Switch
                                    id="lotTracking"
                                    checked={lotTracking}
                                    onCheckedChange={onLotTrackingChange}
                                    data-testid="lot-tracking-switch"
                                />
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Item Number & Barcode Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-muted-foreground">Item Number</span>
                                    {isEditing ? (
                                        <Input
                                            value={formData.itemNumber}
                                            onChange={(e) => onFormDataChange({ ...formData, itemNumber: e.target.value })}
                                            className="mt-1.5 h-9 text-sm font-mono"
                                            placeholder="Enter item number"
                                            data-testid="edit-item-number-input"
                                        />
                                    ) : (
                                        <p className="text-sm mt-1 font-mono font-medium truncate">{item.itemNumber}</p>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Barcode</span>
                                    {isEditing ? (
                                        <div className="flex gap-2 mt-1.5">
                                            <Input
                                                value={formData.barcode}
                                                onChange={(e) => onFormDataChange({ ...formData, barcode: e.target.value })}
                                                className="h-9 text-sm flex-1 font-mono"
                                                placeholder="Enter barcode"
                                                data-testid="edit-item-barcode-input"
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 gap-2"
                                                onClick={onOpenBarcodeScanner}
                                            >
                                                <Scan className="h-4 w-4" />
                                                <span className="hidden sm:inline">Scan</span>
                                            </Button>
                                        </div>
                                    ) : (
                                        <p className="text-sm mt-1 font-mono font-medium truncate">{item.barcode || "—"}</p>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <span className="text-xs text-muted-foreground">Description</span>
                                {isEditing ? (
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                                        className="mt-1.5 h-20 text-sm resize-none"
                                        placeholder="Enter description"
                                        data-testid="edit-item-description-input"
                                    />
                                ) : (
                                    <p className="text-sm mt-1 leading-relaxed">{item.description || "—"}</p>
                                )}
                            </div>

                            {/* Category & Unit Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-muted-foreground">Category</span>
                                    {isEditing ? (
                                        <Select value={formData.categoryId} onValueChange={(value) => onFormDataChange({ ...formData, categoryId: value })}>
                                            <SelectTrigger className="mt-1.5 h-9 text-sm">
                                                <SelectValue placeholder="Select category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((category) => (
                                                    <SelectItem key={category.id} value={category.id}>
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <p className="text-sm mt-1 font-medium">{item.category?.name || "Uncategorized"}</p>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Unit</span>
                                    {isEditing ? (
                                        <Input
                                            value={formData.unit}
                                            onChange={(e) => onFormDataChange({ ...formData, unit: e.target.value })}
                                            className="mt-1.5 h-9 text-sm"
                                            placeholder="e.g., EA, BOX"
                                            data-testid="edit-item-unit-input"
                                        />
                                    ) : (
                                        <p className="text-sm mt-1 font-medium">{item.unit || "—"}</p>
                                    )}
                                </div>
                            </div>

                            {/* Supplier & Cost Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-xs text-muted-foreground">Supplier</span>
                                    {isEditing ? (
                                        <Select value={formData.supplierId} onValueChange={(value) => onFormDataChange({ ...formData, supplierId: value })}>
                                            <SelectTrigger className="mt-1.5 h-9 text-sm">
                                                <SelectValue placeholder="Select supplier" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {suppliers.map((supplier) => (
                                                    <SelectItem key={supplier.id} value={supplier.id}>
                                                        {supplier.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <p className="text-sm mt-1 flex items-center gap-1.5 font-medium">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            {item.supplier?.name || "Unknown"}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground">Unit Cost</span>
                                    {isEditing ? (
                                        <Input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.cost}
                                            onChange={(e) => onFormDataChange({ ...formData, cost: e.target.value })}
                                            className="mt-1.5 h-9 text-sm"
                                            placeholder="0.00"
                                            data-testid="edit-item-cost-input"
                                        />
                                    ) : (
                                        <p className="text-sm mt-1 font-medium">${item.cost.toFixed(2)}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Images Section */}
                    <div className="p-4 border-b sm:border sm:rounded-lg sm:border-b">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Product Images</h3>
                            <Button variant="ghost" size="sm" onClick={onOpenManageImages} className="h-7 text-xs gap-1.5 -mr-2">
                                <Upload className="h-3.5 w-3.5" />
                                Manage
                            </Button>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible scrollbar-hide">
                            {images.map((image) => (
                                <div
                                    key={image.id}
                                    className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted cursor-pointer active:scale-95 transition-transform"
                                    onClick={() => onImageClick(`/api/items/images/image/${image.id}`)}
                                >
                                    <img
                                        src={`/api/items/images/image/${image.id}`}
                                        alt="Product"
                                        className="w-full h-full object-cover"
                                    />
                                    {image.isPrimary && (
                                        <div className="absolute inset-0 ring-2 ring-primary ring-inset rounded-lg" />
                                    )}
                                </div>
                            ))}
                            {images.length === 0 ? (
                                <div className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center active:bg-muted/50"
                                    onClick={onOpenManageImages}
                                >
                                    <Plus className="h-5 w-5 text-muted-foreground" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-0 sm:space-y-3">
                    {/* Quick Stats - Desktop only (mobile in hero) */}
                    <div className="hidden sm:block p-4 border rounded-lg">
                        <h3 className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Quick Stats</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total Value</span>
                                <span className="text-sm font-semibold">${(totalQuantity * item.cost).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Locations</span>
                                <span className="text-sm font-semibold">{itemLocationsCount}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Movements</span>
                                <span className="text-sm font-semibold">{item.transactions?.length || 0}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Linked Customers</span>
                                <span className="text-sm font-semibold">{item.customers?.length || 0}</span>
                            </div>
                        </div>
                    </div>

                    {/* Customers */}
                    <div className="p-4 border-b sm:border sm:rounded-lg sm:border-b">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Customers</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs -mr-2"
                                onClick={onOpenManageCustomers}
                                disabled={isEditing}
                            >
                                Manage
                            </Button>
                        </div>
                        {item.customers && item.customers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {item.customers.map((customerLink) => (
                                    <Badge key={customerLink.id} variant="outline" className="text-xs">
                                        {customerLink.customer.name}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">No customers assigned</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
