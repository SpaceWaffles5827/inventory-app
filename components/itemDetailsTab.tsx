"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
    Building2, ImageIcon, Upload, Star, Package, Scan, PackageCheck
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
        <div className="bg-card p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Item Details Card */}
                    <div className="bg-card border rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-4">Item Information</h3>
                        {isEditing && (
                            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                                <div className="flex items-center gap-2">
                                    <PackageCheck className="h-4 w-4 text-blue-600" />
                                    <div>
                                        <Label htmlFor="lotTracking" className="text-sm font-medium">Enable Lot Tracking</Label>
                                        <p className="text-xs text-muted-foreground">Track batches with expiration dates</p>
                                    </div>
                                </div>
                                <Switch
                                    id="lotTracking"
                                    checked={lotTracking}
                                    onCheckedChange={onLotTrackingChange}
                                />
                            </div>
                        )}
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="itemNumber" className="text-xs text-muted-foreground">Item Number</Label>
                                    {isEditing ? (
                                        <Input
                                            id="itemNumber"
                                            value={formData.itemNumber}
                                            onChange={(e) => onFormDataChange({ ...formData, itemNumber: e.target.value })}
                                            className="font-mono h-9"
                                            placeholder="Enter item number"
                                        />
                                    ) : (
                                        <div className="text-sm font-medium font-mono">{item.itemNumber}</div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="barcode" className="text-xs text-muted-foreground">Barcode</Label>
                                    {isEditing ? (
                                        <div className="flex gap-2">
                                            <Input
                                                id="barcode"
                                                value={formData.barcode}
                                                onChange={(e) => onFormDataChange({ ...formData, barcode: e.target.value })}
                                                className="font-mono h-9 flex-1"
                                                placeholder="Enter barcode"
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
                                        <div className="text-sm font-medium font-mono">{item.barcode || "—"}</div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category" className="text-xs text-muted-foreground">Category</Label>
                                    {isEditing ? (
                                        <Select value={formData.categoryId} onValueChange={(value) => onFormDataChange({ ...formData, categoryId: value })}>
                                            <SelectTrigger id="category" className="h-9">
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
                                        <div className="text-sm font-medium">{item.category?.name || "Uncategorized"}</div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="supplier" className="text-xs text-muted-foreground">Supplier</Label>
                                    {isEditing ? (
                                        <Select value={formData.supplierId} onValueChange={(value) => onFormDataChange({ ...formData, supplierId: value })}>
                                            <SelectTrigger id="supplier" className="h-9">
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
                                        <div className="text-sm font-medium flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                            {item.supplier?.name || "Unknown"}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="cost" className="text-xs text-muted-foreground">Unit Cost</Label>
                                    {isEditing ? (
                                        <Input
                                            id="cost"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={formData.cost}
                                            onChange={(e) => onFormDataChange({ ...formData, cost: e.target.value })}
                                            className="h-9"
                                            placeholder="Enter unit cost"
                                        />
                                    ) : (
                                        <div className="text-sm font-medium">${item.cost.toFixed(2)}</div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="unit" className="text-xs text-muted-foreground">Unit</Label>
                                    {isEditing ? (
                                        <Input
                                            id="unit"
                                            value={formData.unit}
                                            onChange={(e) => onFormDataChange({ ...formData, unit: e.target.value })}
                                            className="h-9"
                                            placeholder="e.g., EA, BOX, KG"
                                        />
                                    ) : (
                                        <div className="text-sm font-medium">{item.unit || "—"}</div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-xs text-muted-foreground">Description</Label>
                                {isEditing ? (
                                    <Textarea
                                        id="description"
                                        value={formData.description}
                                        onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
                                        rows={3}
                                        placeholder="Enter description"
                                    />
                                ) : (
                                    <div className="text-sm">{item.description || "—"}</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Product Images Card */}
                    <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold">Product Images</h3>
                            <Button variant="outline" size="sm" onClick={onOpenManageImages} className="gap-2">
                                <Upload className="h-4 w-4" />
                                <span className="hidden sm:inline">Manage</span>
                            </Button>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                            {images.map((image) => (
                                <div
                                    key={image.id}
                                    className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-pointer"
                                    onClick={() => onImageClick(`/api/items/images/image/${image.id}`)}
                                >
                                    <img
                                        src={`/api/items/images/image/${image.id}`}
                                        alt="Product"
                                        className="w-full h-full object-cover"
                                    />
                                    {image.isPrimary && (
                                        <div className="absolute top-2 right-2">
                                            <Badge className="bg-yellow-500 hover:bg-yellow-500 text-white shadow-lg border-0 text-xs">
                                                <Star className="h-2 w-2 mr-0.5 fill-current" />
                                                Primary
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                            ))}
                            {images.length === 0 && (
                                <div className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center col-span-3">
                                    <div className="text-center p-4">
                                        <ImageIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                        <p className="text-xs text-muted-foreground">No images yet</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Quick Stats */}
                    <div className="bg-card border rounded-lg p-4">
                        <h3 className="text-base font-semibold mb-4">Quick Stats</h3>
                        <div className="space-y-3">
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
                    <div className="bg-card border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-base font-semibold">Customers</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={onOpenManageCustomers}
                                disabled={isEditing}
                            >
                                Manage
                            </Button>
                        </div>
                        {item.customers && item.customers.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {item.customers.map((customerLink) => (
                                    <Badge key={customerLink.id} variant="secondary" className="text-xs">
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