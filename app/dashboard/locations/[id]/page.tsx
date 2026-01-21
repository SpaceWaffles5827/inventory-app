"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { StructureEditorDialog } from "@/components/structureEditorDialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BarcodeScannerDialog } from "@/components/barcodeScannerDialog"
import {
    ArrowLeft,
    MapPin,
    Package,
    Loader2,
    LayoutGrid,
    List,
    TableIcon,
    ImageIcon,
    Diff,
    Trash2,
    QrCode,
    Barcode,
    Edit2,
    Save,
    Settings2,
    Scan,
    MoreVertical,
} from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getLocationByIdApi, updateLocationApi, type LocationWithItems, type LocationStructure } from "@/lib/api/locations.api"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StockAdjustmentWizard } from "@/components/stockAdjustmentWizard"
import { RemoveFromLocationDialog } from "@/components/removeFromLocationDialog"
import { LocationLabelGenerator } from "@/components/locationLabelGenerator"

// Helper component for item images
const ItemImage = ({ itemId, alt, className }: { itemId: string; alt: string; className?: string }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)

    useEffect(() => {
        const loadPrimaryImage = async () => {
            try {
                setLoading(true)
                setError(false)

                const response = await fetch(`/api/items/images/${itemId}`, {
                    credentials: 'include',
                })

                if (!response.ok) {
                    setError(true)
                    return
                }

                const data = await response.json()
                const primaryImage = data.data?.images?.find((img: any) => img.isPrimary)

                if (primaryImage) {
                    setImageUrl(`/api/items/images/image/${primaryImage.id}`)
                } else {
                    setError(true)
                }
            } catch (err) {
                console.error('Failed to load image:', err)
                setError(true)
            } finally {
                setLoading(false)
            }
        }

        loadPrimaryImage()
    }, [itemId])

    if (loading) {
        return (
            <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        )
    }

    if (error || !imageUrl) {
        return (
            <div className={`bg-muted/50 flex items-center justify-center ${className}`}>
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </div>
        )
    }

    return (
        <img
            src={imageUrl}
            alt={alt}
            className={className}
            onError={() => setError(true)}
        />
    )
}

export default function LocationDetailPage() {
    const params = useParams()
    const router = useRouter()
    const locationId = params.id as string

    const [location, setLocation] = useState<LocationWithItems | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentWorkspaceId, setCurrentWorkspaceId] = useState("")
    const [viewMode, setViewMode] = useState<"table" | "grid" | "list">(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("locationItemsViewMode")
            return (saved as "table" | "grid" | "list") || "list"
        }
        return "list"
    })

    // Inline edit mode state
    const [isEditMode, setIsEditMode] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [editFormData, setEditFormData] = useState({
        barcode: "",
        description: "",
    })
    const [originalLocation, setOriginalLocation] = useState<LocationWithItems | null>(null)

    // Barcode scanning state
    const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false)

    const [isStructureEditorOpen, setIsStructureEditorOpen] = useState(false)

    // Adjustment dialog state
    const [adjustmentDialog, setAdjustmentDialog] = useState<{
        open: boolean
        item: any | null
    }>({
        open: false,
        item: null,
    })

    const [removeDialog, setRemoveDialog] = useState<{
        open: boolean
        item: any | null
    }>({
        open: false,
        item: null,
    })

    // Label generation state
    const [isLabelGenerateOpen, setIsLabelGenerateOpen] = useState(false)

    useEffect(() => {
        localStorage.setItem("locationItemsViewMode", viewMode)
    }, [viewMode])

    useEffect(() => {
        const workspaceId = localStorage.getItem("currentWorkspaceId")
        if (workspaceId) {
            setCurrentWorkspaceId(workspaceId)
            loadLocation(locationId, workspaceId)
        } else {
            setLoading(false)
            toast.error("No workspace selected")
        }
    }, [locationId])

    const handleBarcodeScanned = (barcode: string) => {
        setEditFormData(prev => ({ ...prev, barcode }))
    }

    const loadLocation = async (locationId: string, workspaceId: string) => {
        try {
            setLoading(true)
            const response = await getLocationByIdApi(locationId, workspaceId)

            if (response.data?.location) {
                const locationData = response.data.location as LocationWithItems
                setLocation(locationData)
                setOriginalLocation(locationData)
                setEditFormData({
                    barcode: locationData.barcode || "",
                    description: locationData.description || "",
                })
            }
        } catch (error) {
            console.error("Failed to load location:", error)
            toast.error(error instanceof Error ? error.message : "Failed to load location")
        } finally {
            setLoading(false)
        }
    }

    const handleEditMode = () => {
        if (location) {
            setEditFormData({
                barcode: location.barcode || "",
                description: location.description || "",
            })
            setOriginalLocation(location)
            setIsEditMode(true)
        }
    }

    const handleSave = async () => {
        if (!location) return

        setIsSaving(true)
        try {
            const response = await updateLocationApi(location.id, {
                barcode: editFormData.barcode || undefined,
                description: editFormData.description || undefined,
                workspaceId: currentWorkspaceId,
            })

            if (response.data?.location) {
                setLocation(response.data.location as LocationWithItems)
                setOriginalLocation(response.data.location as LocationWithItems)
                setIsEditMode(false)
                toast.success("Location updated successfully")
            }
        } catch (error) {
            console.error("Failed to update location:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update location")
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        if (originalLocation) {
            setLocation(originalLocation)
            setEditFormData({
                barcode: originalLocation.barcode || "",
                description: originalLocation.description || "",
            })
        }
        setIsEditMode(false)
    }

    const openStructureEditor = () => {
        setIsStructureEditorOpen(true)
    }

    const handleSaveStructure = async (structure: LocationStructure[]) => {
        if (!location) return

        const newCode = structure.map((part) => part.value).join("-")

        try {
            const response = await updateLocationApi(location.id, {
                code: newCode,
                structure,
                workspaceId: currentWorkspaceId,
            })

            if (response.data?.location) {
                setLocation(response.data.location as LocationWithItems)
                setOriginalLocation(response.data.location as LocationWithItems)
                toast.success("Location structure updated successfully")
            }
        } catch (error) {
            console.error("Failed to update structure:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update structure")
            throw error // Re-throw so component can handle loading state
        }
    }

    const openAdjustmentDialog = (item: any) => {
        setAdjustmentDialog({ open: true, item })
    }

    const handleAdjustmentSuccess = async () => {
        await loadLocation(locationId, currentWorkspaceId)
        setAdjustmentDialog({ open: false, item: null })
    }

    const handleAdjustmentClose = () => {
        setAdjustmentDialog({ open: false, item: null })
    }

    const handleRemoveSuccess = async () => {
        await loadLocation(locationId, currentWorkspaceId)
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading location details...</p>
                </div>
            </div>
        )
    }

    if (!location) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Location Not Found</CardTitle>
                        <CardDescription>The location you&apos;re looking for doesn&apos;t exist.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/locations">
                            <Button>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back to Locations
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const structure = Array.isArray(location.structure) ? location.structure : []
    const itemsInLocation = location.items || []
    const totalUnits = itemsInLocation.reduce((sum, item) => sum + (item.quantity || 0), 0)
    const uniqueItems = itemsInLocation.length

    return (
        <div className="min-h-screen bg-muted/30 sm:bg-background pb-6">
            {/* Sticky Header - Mobile Optimized */}
            <div className="sticky top-0 z-10 bg-background">
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b">
                    {/* Back Button */}
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="flex items-center justify-center h-9 w-9 -ml-1 rounded-full active:bg-muted sm:w-auto sm:px-3 sm:gap-2 sm:rounded-md sm:hover:bg-muted"
                    >
                        <ArrowLeft className="h-5 w-5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline text-sm font-medium">Back</span>
                    </button>

                    {/* Mobile Title */}
                    <h1 className="text-sm font-semibold truncate max-w-[180px] sm:hidden">{location.code}</h1>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {!isEditMode ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsLabelGenerateOpen(true)}
                                    className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:gap-2"
                                >
                                    <QrCode className="h-4 w-4" />
                                    <span className="hidden sm:inline">Label</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleEditMode}
                                    className="h-9 w-9 p-0 sm:w-auto sm:px-3 sm:gap-2"
                                >
                                    <Edit2 className="h-4 w-4" />
                                    <span className="hidden sm:inline">Edit</span>
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                    className="h-9 px-3 text-sm"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    className="h-9 px-4 gap-1.5"
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span className="hidden sm:inline">Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            <span className="hidden sm:inline">Save</span>
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="sm:px-4 sm:pt-3">
                {/* Hero Section - Mobile Optimized */}
                <div className="bg-card sm:border sm:rounded-lg overflow-hidden">
                    <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                            <div className="flex-shrink-0">
                                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <MapPin className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">{location.code}</h1>

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {structure.map((part, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-muted/50">
                                            <span className="text-muted-foreground text-xs">{part.label}:</span>
                                            <span className="ml-1 font-semibold">{part.value}</span>
                                        </Badge>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Total Items</p>
                                        <p className="text-sm font-semibold">{totalUnits} units</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Unique Items</p>
                                        <p className="text-sm font-semibold">{uniqueItems}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs Section - Mobile Optimized */}
                <Tabs defaultValue="details" className="mt-2 sm:mt-4 gap-0">
                    <div className="bg-card sm:border sm:rounded-t-lg">
                        <TabsList className="w-full grid grid-cols-2 h-12 p-0 bg-transparent rounded-none">
                            <TabsTrigger
                                value="details"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs sm:text-sm font-medium"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="inventory"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs sm:text-sm font-medium"
                            >
                                Inventory ({uniqueItems})
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Details Tab */}
                    <TabsContent value="details" className="mt-0">
                        <div className="bg-card sm:border-x sm:border-b sm:rounded-b-lg p-4">
                            <h3 className="text-base font-semibold mb-4">Location Information</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="barcode" className="text-xs text-muted-foreground">
                                        Location Barcode
                                    </Label>
                                    {isEditMode ? (
                                        <div className="flex gap-2">
                                            <Input
                                                id="barcode"
                                                value={editFormData.barcode}
                                                onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value })}
                                                className="h-10"
                                                placeholder="Enter barcode"
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setIsBarcodeScanOpen(true)}
                                                className="h-10 w-10 p-0 flex-shrink-0 sm:w-auto sm:px-3 sm:gap-2"
                                            >
                                                <Scan className="h-4 w-4" />
                                                <span className="hidden sm:inline">Scan</span>
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                                            <Barcode className="h-5 w-5 text-muted-foreground" />
                                            <span className="text-sm font-mono font-semibold">
                                                {location.barcode || "Not set"}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-xs text-muted-foreground">
                                        Description
                                    </Label>
                                    {isEditMode ? (
                                        <Textarea
                                            id="description"
                                            value={editFormData.description}
                                            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                            className="min-h-[80px] resize-none"
                                            placeholder="Enter location description"
                                        />
                                    ) : (
                                        <p className="text-sm">{location.description || "—"}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs text-muted-foreground">Location Structure</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={openStructureEditor}
                                            className="h-7 gap-1.5 text-xs hover:bg-accent/50"
                                        >
                                            <Settings2 className="h-3.5 w-3.5" />
                                            Configure
                                        </Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {structure.map((part, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <div className="bg-muted/50 border rounded-md px-3 py-2">
                                                    <span className="text-xs text-muted-foreground">{part.label}:</span>
                                                    <span className="ml-2 font-semibold text-sm">{part.value}</span>
                                                </div>
                                                {idx < structure.length - 1 && <span className="text-muted-foreground">→</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Inventory Tab */}
                    <TabsContent value="inventory" className="mt-0">
                        <div className="bg-card sm:border-x sm:border-b sm:rounded-b-lg">
                            {/* Desktop View Controls */}
                            <div className="hidden sm:flex items-center justify-between p-4 border-b">
                                <h3 className="text-base font-semibold">Items in This Location</h3>
                                <Select value={viewMode} onValueChange={(value: "table" | "grid" | "list") => setViewMode(value)}>
                                    <SelectTrigger className="w-[140px] h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="table">
                                            <div className="flex items-center">
                                                <TableIcon className="h-4 w-4 mr-2" />
                                                Table View
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="grid">
                                            <div className="flex items-center">
                                                <LayoutGrid className="h-4 w-4 mr-2" />
                                                Grid View
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="list">
                                            <div className="flex items-center">
                                                <List className="h-4 w-4 mr-2" />
                                                List View
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {itemsInLocation.length === 0 ? (
                                <div className="text-center py-12 px-4 text-muted-foreground">
                                    <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">No items stored in this location yet.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Mobile List View - Always shown on mobile */}
                                    <div className="sm:hidden divide-y divide-border">
                                        {itemsInLocation.map((item) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-3 p-4 active:bg-muted/50 transition-colors"
                                                onClick={() => router.push(`/dashboard/items/${item.id}`)}
                                            >
                                                <div className="w-16 h-16 rounded-lg bg-muted/50 border border-border overflow-hidden flex-shrink-0">
                                                    <ItemImage
                                                        itemId={item.id}
                                                        alt={item.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs text-muted-foreground font-mono mb-0.5">
                                                        {item.itemNumber}
                                                    </p>
                                                    <h3 className="font-semibold text-base leading-tight mb-1 line-clamp-1">
                                                        {item.name}
                                                    </h3>
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <span className="font-medium">
                                                            {item.quantity} {item.unit?.toLowerCase() || "units"}
                                                        </span>
                                                        <Badge
                                                            variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                                            className={
                                                                item.status === "IN_STOCK"
                                                                    ? "bg-accent/10 text-accent"
                                                                    : "bg-destructive/10 text-destructive"
                                                            }
                                                        >
                                                            {item.status === "IN_STOCK"
                                                                ? "In Stock"
                                                                : item.status === "LOW_STOCK"
                                                                    ? "Low"
                                                                    : "Out"}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="flex-shrink-0 h-10 w-10"
                                                        >
                                                            <MoreVertical className="h-5 w-5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => router.push(`/dashboard/items/${item.id}`)}>
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                openAdjustmentDialog(item)
                                                            }}
                                                        >
                                                            Adjust Stock
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setRemoveDialog({ open: true, item })
                                                            }}
                                                        >
                                                            Remove from Location
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Views */}
                                    <div className="hidden sm:block">
                                        {viewMode === "table" && (
                                            <div className="rounded-lg border border-border/50 overflow-hidden m-4">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/50">
                                                            <TableHead className="w-[60px]"></TableHead>
                                                            <TableHead className="font-semibold">Item</TableHead>
                                                            <TableHead className="text-center font-semibold">Quantity</TableHead>
                                                            <TableHead className="font-semibold">Status</TableHead>
                                                            <TableHead className="text-center font-semibold">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {itemsInLocation.map((item) => (
                                                            <TableRow
                                                                key={item.id}
                                                                className="hover:bg-muted/30 transition-colors cursor-pointer"
                                                                onClick={() => router.push(`/dashboard/items/${item.id}`)}
                                                            >
                                                                <TableCell>
                                                                    <div className="w-12 h-12 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden">
                                                                        <ItemImage
                                                                            itemId={item.id}
                                                                            alt={item.name}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex flex-col">
                                                                        <span className="font-semibold">{item.name}</span>
                                                                        <span className="text-xs text-muted-foreground font-mono">{item.itemNumber}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="font-semibold text-lg">{item.quantity}</span>
                                                                    {item.unit && <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge
                                                                        variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                                                        className={
                                                                            item.status === "IN_STOCK"
                                                                                ? "bg-accent/10 text-accent hover:bg-accent/20"
                                                                                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                                                        }
                                                                    >
                                                                        {item.status === "IN_STOCK"
                                                                            ? "In Stock"
                                                                            : item.status === "LOW_STOCK"
                                                                                ? "Low Stock"
                                                                                : "Out of Stock"}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex gap-2 justify-center" onClick={(e) => e.stopPropagation()}>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-9 w-9 hover:bg-accent/10 hover:text-accent bg-transparent"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                openAdjustmentDialog(item)
                                                                            }}
                                                                        >
                                                                            <Diff className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setRemoveDialog({ open: true, item })
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}

                                        {viewMode === "grid" && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 p-4">
                                                {itemsInLocation.map((item) => (
                                                    <Card
                                                        key={item.id}
                                                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-accent/50 flex flex-col pt-0 overflow-hidden"
                                                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                                                    >
                                                        <div className="relative w-full h-48 bg-muted/30 border-b border-border overflow-hidden">
                                                            <ItemImage
                                                                itemId={item.id}
                                                                alt={item.name}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <CardHeader className="pb-3 flex-none pt-4">
                                                            <div className="space-y-2">
                                                                <div className="min-w-0 overflow-hidden h-[52px]">
                                                                    <CardTitle
                                                                        className="text-base font-semibold line-clamp-2 break-words"
                                                                        title={item.name}
                                                                    >
                                                                        {item.name}
                                                                    </CardTitle>
                                                                    <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{item.itemNumber}</p>
                                                                </div>
                                                                <Badge
                                                                    variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                                                    className={
                                                                        item.status === "IN_STOCK"
                                                                            ? "bg-accent/10 text-accent w-fit"
                                                                            : "bg-destructive/10 text-destructive w-fit"
                                                                    }
                                                                >
                                                                    {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out"}
                                                                </Badge>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-0">
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                                                                        <p className="text-2xl font-bold">{item.quantity}</p>
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-xs text-muted-foreground mb-1">Unit</p>
                                                                        <p className="text-lg font-semibold">{item.unit || "EA"}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-9 w-9 hover:bg-accent/10 hover:text-accent bg-transparent"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openAdjustmentDialog(item)
                                                                    }}
                                                                >
                                                                    <Diff className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        setRemoveDialog({ open: true, item })
                                                                    }}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}

                                        {viewMode === "list" && (
                                            <div className="space-y-3 p-4">
                                                {itemsInLocation.map((item) => (
                                                    <Card
                                                        key={item.id}
                                                        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-accent/50 overflow-hidden p-0"
                                                        onClick={() => router.push(`/dashboard/items/${item.id}`)}
                                                    >
                                                        <CardContent className="p-4">
                                                            <div className="flex items-center gap-4 min-w-0">
                                                                <div className="w-20 h-20 rounded-md bg-muted/50 border border-border overflow-hidden flex-shrink-0">
                                                                    <ItemImage
                                                                        itemId={item.id}
                                                                        alt={item.name}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <div className="flex-1 min-w-0 overflow-hidden">
                                                                    <div className="flex items-start gap-3 mb-1 min-w-0">
                                                                        <h3 className="font-semibold text-base line-clamp-2 break-words flex-1 min-w-0 overflow-hidden" title={item.name}>
                                                                            {item.name}
                                                                        </h3>
                                                                        <Badge
                                                                            variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                                                            className={
                                                                                item.status === "IN_STOCK"
                                                                                    ? "bg-accent/10 text-accent flex-shrink-0"
                                                                                    : "bg-destructive/10 text-destructive flex-shrink-0"
                                                                            }
                                                                        >
                                                                            {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                                                                        </Badge>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap min-w-0">
                                                                        <span className="font-mono">{item.itemNumber}</span>
                                                                        <span className="text-xs">{item.unit || "EA"}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-6 flex-none">
                                                                    <div className="text-center">
                                                                        <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                                                                        <p className="text-2xl font-semibold">{item.quantity}</p>
                                                                    </div>
                                                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-9 w-9 hover:bg-accent/10 hover:text-accent bg-transparent"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                openAdjustmentDialog(item)
                                                                            }}
                                                                        >
                                                                            <Diff className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-9 w-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation()
                                                                                setRemoveDialog({ open: true, item })
                                                                            }}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Structure Editor Dialog */}
            <StructureEditorDialog
                open={isStructureEditorOpen}
                onOpenChange={setIsStructureEditorOpen}
                initialStructure={structure}
                onSave={handleSaveStructure}
            />

            <StockAdjustmentWizard
                item={adjustmentDialog.item}
                open={adjustmentDialog.open}
                onClose={handleAdjustmentClose}
                onSuccess={handleAdjustmentSuccess}
                defaultLocationId={locationId}  // This skips location selection!
            />

            {/* Remove from Location Dialog */}
            <RemoveFromLocationDialog
                open={removeDialog.open}
                onOpenChange={(open) => {
                    if (!open) {
                        setRemoveDialog({ open: false, item: null })
                    }
                }}
                item={removeDialog.item}
                locationCode={location?.code || ""}
                locationId={locationId}
                onSuccess={handleRemoveSuccess}
            />
            {/* Label Generation Dialog */}
            {location && (
                <LocationLabelGenerator
                    open={isLabelGenerateOpen}
                    onOpenChange={setIsLabelGenerateOpen}
                    location={location}
                />
            )}

            {/* Barcode Scanner Dialog */}
            <BarcodeScannerDialog
                isOpen={isBarcodeScanOpen}
                onClose={() => setIsBarcodeScanOpen(false)}
                currentBarcode={editFormData.barcode}
                onBarcodeScanned={handleBarcodeScanned}
            />
        </div>
    )
}