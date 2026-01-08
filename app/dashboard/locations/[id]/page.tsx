"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import {
    ArrowLeft,
    MapPin,
    Package,
    Warehouse,
    Calendar,
    Loader2,
    LayoutGrid,
    List,
    TableIcon,
    ImageIcon,
    Diff,
    Trash2,
    AlertCircle,
} from "lucide-react"
import { getLocationByIdApi, type LocationWithItems } from "@/lib/api/locations.api"
import { adjustStockApi, type ItemWithRelations } from "@/lib/api/items.api"
import { toast } from "sonner"

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
            return (saved as "table" | "grid" | "list") || "table"
        }
        return "table"
    })

    // Adjustment dialog state
    const [adjustmentDialog, setAdjustmentDialog] = useState<{
        open: boolean
        item: any | null
    }>({
        open: false,
        item: null,
    })
    const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
    const [newStockAmount, setNewStockAmount] = useState("")
    const [adjustmentNote, setAdjustmentNote] = useState("")

    // Remove dialog state
    const [removeDialog, setRemoveDialog] = useState<{
        open: boolean
        item: any | null
    }>({
        open: false,
        item: null,
    })
    const [isRemoving, setIsRemoving] = useState(false)

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

    const loadLocation = async (locationId: string, workspaceId: string) => {
        try {
            setLoading(true)
            const response = await getLocationByIdApi(locationId, workspaceId)

            if (response.data?.location) {
                setLocation(response.data.location as LocationWithItems)
            }
        } catch (error) {
            console.error("Failed to load location:", error)
            toast.error(error instanceof Error ? error.message : "Failed to load location")
        } finally {
            setLoading(false)
        }
    }

    const openAdjustmentDialog = (item: any) => {
        setAdjustmentDialog({ open: true, item })
        setAdjustmentQuantity("")
        setNewStockAmount(String(item.quantity || 0))
        setAdjustmentNote("")
    }

    const handleAdjustmentQuantityChange = (value: string) => {
        setAdjustmentQuantity(value)
        if (value && value !== "-" && value !== "+") {
            const qty = Number.parseInt(value)
            if (!isNaN(qty)) {
                const currentStock = adjustmentDialog.item?.quantity || 0
                setNewStockAmount(String(currentStock + qty))
            }
        }
    }

    const handleNewStockAmountChange = (value: string) => {
        setNewStockAmount(value)
        if (value) {
            const newStock = Number.parseInt(value)
            if (!isNaN(newStock)) {
                const currentStock = adjustmentDialog.item?.quantity || 0
                const adjustment = newStock - currentStock
                setAdjustmentQuantity(String(adjustment))
            }
        } else {
            setAdjustmentQuantity("")
        }
    }

    const incrementQuantity = () => {
        const current = Number.parseInt(adjustmentQuantity || "0")
        handleAdjustmentQuantityChange(String(current + 1))
    }

    const decrementQuantity = () => {
        const current = Number.parseInt(adjustmentQuantity || "0")
        handleAdjustmentQuantityChange(String(current - 1))
    }

    const handleStockAdjustment = async () => {
        if (!adjustmentDialog.item || !adjustmentQuantity || adjustmentQuantity === "0") {
            return
        }

        const quantity = Number.parseInt(adjustmentQuantity)
        const itemId = adjustmentDialog.item.id
        const isInput = quantity > 0

        try {
            const response = await adjustStockApi(itemId, {
                type: isInput ? "INPUT" : "OUTPUT",
                quantity: Math.abs(quantity),
                reason: adjustmentNote || "Stock adjustment at location",
                locationId: locationId,
            })

            if (response.data?.item) {
                // Reload location to get updated data
                await loadLocation(locationId, currentWorkspaceId)
                toast.success("Stock updated successfully")
            }

            setAdjustmentDialog({ open: false, item: null })
            setAdjustmentQuantity("")
            setNewStockAmount("")
            setAdjustmentNote("")
        } catch (error) {
            console.error("Failed to adjust stock:", error)
            toast.error(error instanceof Error ? error.message : "Failed to adjust stock")
        }
    }

    const handleRemoveFromLocation = async () => {
        if (!removeDialog.item) return

        setIsRemoving(true)
        try {
            const currentQuantity = removeDialog.item.quantity || 0

            // Set quantity to 0 at this location (remove all stock)
            await adjustStockApi(removeDialog.item.id, {
                type: "OUTPUT",
                quantity: currentQuantity,
                reason: `Removed from location ${location?.code}`,
                locationId: locationId,
            })

            // Reload location
            await loadLocation(locationId, currentWorkspaceId)
            toast.success("Item removed from location")

            setRemoveDialog({ open: false, item: null })
        } catch (error) {
            console.error("Failed to remove item:", error)
            toast.error(error instanceof Error ? error.message : "Failed to remove item")
        } finally {
            setIsRemoving(false)
        }
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
        <div className="min-h-screen bg-background">
            <div className="container mx-auto px-8 py-8">
                <Link href="/dashboard/locations">
                    <Button variant="ghost" className="mb-6">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Locations
                    </Button>
                </Link>

                {/* Location Header */}
                <div className="mb-8">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                    <MapPin className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold text-foreground">
                                        {location.code}
                                    </h1>
                                    {structure.length > 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            {structure.map(s => `${s.label}: ${s.value}`).join(' • ')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {location.description && (
                                <p className="text-muted-foreground">{location.description}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    <Card className="border-border/50 bg-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Units</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Package className="h-4 w-4 text-primary" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-card-foreground">{totalUnits}</div>
                            <p className="text-xs text-muted-foreground mt-1">Items stored in this location</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Items</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
                                <Warehouse className="h-4 w-4 text-accent" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-card-foreground">{uniqueItems}</div>
                            <p className="text-xs text-muted-foreground mt-1">Different product types</p>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 bg-card">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Created</CardTitle>
                            <div className="h-8 w-8 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                                <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-card-foreground">
                                {new Date(location.createdAt).toLocaleDateString()}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Location established</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Items in Location */}
                <Card className="border-border/50">
                    <CardHeader>
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <Package className="h-5 w-5 text-primary" />
                                    Items in This Location
                                </CardTitle>
                                <CardDescription>All products currently stored at {location.code}</CardDescription>
                            </div>
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
                    </CardHeader>
                    <CardContent>
                        {itemsInLocation.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                <p className="text-sm">No items stored in this location yet.</p>
                            </div>
                        ) : (
                            <>
                                {viewMode === "table" && (
                                    <div className="rounded-lg border border-border/50 overflow-hidden">
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                        {itemsInLocation.map((item) => (
                                            <Card
                                                key={item.id}
                                                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-accent/50 flex flex-col pt-0 overflow-hidden h-full"
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
                                                    <div>
                                                        <p className="text-xs text-muted-foreground mb-1">Quantity at Location</p>
                                                        <p className="text-2xl font-bold">
                                                            {item.quantity}
                                                            {item.unit && <span className="text-sm text-muted-foreground ml-1">{item.unit}</span>}
                                                        </p>
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
                                    <div className="space-y-3">
                                        {itemsInLocation.map((item) => (
                                            <Card
                                                key={item.id}
                                                className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-accent/50 overflow-hidden"
                                                onClick={() => router.push(`/dashboard/items/${item.id}`)}
                                            >
                                                <CardContent className="pt-4 pb-4">
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
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 flex-none">
                                                            <div className="text-center">
                                                                <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                                                                <p className="text-2xl font-semibold">
                                                                    {item.quantity}
                                                                    {item.unit && <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>}
                                                                </p>
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
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Stock Adjustment Dialog */}
            <Dialog
                open={adjustmentDialog.open}
                onOpenChange={(open) => {
                    if (!open) {
                        setAdjustmentDialog({ open: false, item: null })
                        setAdjustmentQuantity("")
                        setNewStockAmount("")
                        setAdjustmentNote("")
                    }
                }}
            >
                <DialogContent className="sm:max-w-[540px] gap-0 p-0 overflow-hidden">
                    <div className="px-6 pt-6 pb-2">
                        <DialogHeader>
                            <DialogTitle className="text-lg">Update Quantity at Location</DialogTitle>
                            <DialogDescription className="text-xs">
                                Adjust the stock quantity for this item at {location.code}.
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {adjustmentDialog.item && (
                        <div className="px-6 py-4 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
                            {/* Item Info */}
                            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                                <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                    <ItemImage
                                        itemId={adjustmentDialog.item.id}
                                        alt={adjustmentDialog.item.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-sm truncate">{adjustmentDialog.item.name}</h3>
                                    <p className="text-xs text-muted-foreground truncate">
                                        Current at location: {adjustmentDialog.item.quantity} {adjustmentDialog.item.unit || 'units'}
                                    </p>
                                </div>
                            </div>

                            {/* Adjustment Controls */}
                            <div className="space-y-1.5">
                                <Label className="text-xs">Adjustment Quantity</Label>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={decrementQuantity}
                                        className="flex-shrink-0"
                                    >
                                        <span className="text-lg">−</span>
                                    </Button>

                                    <Input
                                        type="text"
                                        value={adjustmentQuantity > 0 ? `+${adjustmentQuantity}` : adjustmentQuantity === 0 ? "0" : `${adjustmentQuantity}`}
                                        onChange={(e) => {
                                            const val = e.target.value

                                            if (val === "") {
                                                setAdjustmentQuantity("")
                                                setNewStockAmount(String(adjustmentDialog.item?.quantity || 0))
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
                                                const num = Number.parseInt(finalValue)
                                                if (!isNaN(num)) {
                                                    handleAdjustmentQuantityChange(String(num))
                                                }
                                            }
                                        }}
                                        className="text-center font-semibold flex-1 min-w-0"
                                    />

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={incrementQuantity}
                                        className="flex-shrink-0"
                                    >
                                        <span className="text-lg">+</span>
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Current stock at this location: {adjustmentDialog.item.quantity} {adjustmentDialog.item.unit || 'units'}
                                </p>
                            </div>

                            {/* New Quantity Input */}
                            <div className="space-y-1.5">
                                <Label htmlFor="newStock" className="text-xs">New Quantity at Location</Label>
                                <Input
                                    id="newStock"
                                    type="number"
                                    min="0"
                                    value={newStockAmount}
                                    onChange={(e) => handleNewStockAmountChange(e.target.value)}
                                    className="font-semibold"
                                />
                                {Number.parseInt(newStockAmount) < 0 && (
                                    <Alert variant="destructive" className="py-1.5">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        <AlertDescription className="text-xs">Stock quantity cannot be negative.</AlertDescription>
                                    </Alert>
                                )}
                            </div>

                            {/* Transaction Note */}
                            <div className="space-y-1.5">
                                <Label htmlFor="note" className="text-xs">Transaction Note (Optional)</Label>
                                <Textarea
                                    id="note"
                                    placeholder="Add any additional notes..."
                                    value={adjustmentNote}
                                    onChange={(e) => setAdjustmentNote(e.target.value)}
                                    className="min-h-16 resize-none text-sm"
                                />
                            </div>
                        </div>
                    )}

                    <div className="px-6 pb-6 pt-4 border-t">
                        <DialogFooter className="gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setAdjustmentDialog({ open: false, item: null })
                                    setAdjustmentQuantity("")
                                    setNewStockAmount("")
                                    setAdjustmentNote("")
                                }}
                                size="sm"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleStockAdjustment}
                                disabled={
                                    !adjustmentQuantity ||
                                    adjustmentQuantity === "0" ||
                                    Number.parseInt(newStockAmount) < 0
                                }
                                size="sm"
                            >
                                Update Stock
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Remove from Location Dialog */}
            <Dialog
                open={removeDialog.open}
                onOpenChange={(open) => {
                    if (!open) {
                        setRemoveDialog({ open: false, item: null })
                    }
                }}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            Remove Item from Location
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to remove this item from {location.code}? This will set the quantity at this location to 0.
                        </DialogDescription>
                    </DialogHeader>

                    {removeDialog.item && (
                        <div className="py-4">
                            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-md bg-muted overflow-hidden flex-shrink-0">
                                        <ItemImage
                                            itemId={removeDialog.item.id}
                                            alt={removeDialog.item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm truncate">{removeDialog.item.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Item #: {removeDialog.item.itemNumber}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Current Quantity: {removeDialog.item.quantity} {removeDialog.item.unit || 'units'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRemoveDialog({ open: false, item: null })}
                            disabled={isRemoving}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleRemoveFromLocation}
                            disabled={isRemoving}
                        >
                            {isRemoving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove from Location
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}