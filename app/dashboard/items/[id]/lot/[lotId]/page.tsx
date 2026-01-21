"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { AddLocationToLotDialog } from "@/components/addLocationToLotDialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    ArrowLeft,
    Save,
    Edit2,
    Loader2,
    MapPin,
    Plus,
    Calendar,
    PackageCheck,
    AlertTriangle,
    Clock,
    Building2,
    Hash,
    FileText,
    TrendingUp,
    TrendingDown,
    Package,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AdjustLocationDialog } from "@/components/adjustlocationdialog"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getLotByIdApi, updateLotApi, adjustLotQuantityApi, type LotWithDetails } from "@/lib/api/lots.api"
import { getLocationsApi, type LocationWithCount } from "@/lib/api/locations.api"
import { getSuppliersApi, type SupplierWithCount } from "@/lib/api/suppliers.api"

type LotStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'QUARANTINED' | 'RECALLED'

export default function LotDetailPage() {
    const params = useParams()
    const router = useRouter()
    const itemId = params.id as string
    const lotId = params.lotId as string

    const [lot, setLot] = useState<LotWithDetails | null>(null)
    const [loading, setLoading] = useState(true)
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [locations, setLocations] = useState<LocationWithCount[]>([])
    const [suppliers, setSuppliers] = useState<SupplierWithCount[]>([])

    const [formData, setFormData] = useState({
        lotNumber: "",
        receivedDate: "",
        manufactureDate: "",
        expirationDate: "",
        supplierId: "",
        poNumber: "",
        notes: "",
        status: "ACTIVE" as LotStatus,
    })

    // Add/Adjust location dialog
    const [isAddLocationOpen, setIsAddLocationOpen] = useState(false)

    // Adjust existing location dialog
    const [isAdjustLocationOpen, setIsAdjustLocationOpen] = useState(false)
    const [adjustingLocation, setAdjustingLocation] = useState<{
        locationId: string
        locationCode: string
        currentQuantity: number
    } | null>(null)
    const [adjustmentQuantity, setAdjustmentQuantity] = useState("")
    const [adjustmentNote, setAdjustmentNote] = useState("")

    useEffect(() => {
        const storedWorkspaceId = localStorage.getItem("currentWorkspaceId")
        if (storedWorkspaceId) {
            loadLocations(storedWorkspaceId)
            loadSuppliers(storedWorkspaceId)
        }
    }, [])

    useEffect(() => {
        loadLot()
    }, [lotId])

    const loadLot = async () => {
        try {
            setLoading(true)
            const response = await getLotByIdApi(lotId)

            if (response.data?.lot) {
                const lotData = response.data.lot as LotWithDetails
                setLot(lotData)

                setFormData({
                    lotNumber: lotData.lotNumber,
                    receivedDate: lotData.receivedDate ? new Date(lotData.receivedDate).toISOString().split('T')[0] : "",
                    manufactureDate: lotData.manufactureDate ? new Date(lotData.manufactureDate).toISOString().split('T')[0] : "",
                    expirationDate: lotData.expirationDate ? new Date(lotData.expirationDate).toISOString().split('T')[0] : "",
                    supplierId: lotData.supplierId || "",
                    poNumber: lotData.poNumber || "",
                    notes: lotData.notes || "",
                    status: lotData.status as LotStatus,
                })
            }
        } catch (error) {
            console.error("Failed to load lot:", error)
            toast.error("Failed to load lot")
        } finally {
            setLoading(false)
        }
    }

    const loadLocations = async (workspaceId: string) => {
        try {
            const response = await getLocationsApi(workspaceId)
            if (response.data?.locations) {
                setLocations(response.data.locations)
            }
        } catch (err) {
            console.error("Failed to load locations:", err)
        }
    }

    const loadSuppliers = async (workspaceId: string) => {
        try {
            const response = await getSuppliersApi(workspaceId)
            if (response.data?.suppliers) {
                setSuppliers(response.data.suppliers)
            }
        } catch (err) {
            console.error("Failed to load suppliers:", err)
        }
    }

    const handleSave = async () => {
        if (!formData.lotNumber.trim()) {
            toast.error("Lot number is required")
            return
        }

        setIsSaving(true)
        try {
            await updateLotApi(lotId, {
                lotNumber: formData.lotNumber,
                receivedDate: formData.receivedDate || undefined,
                manufactureDate: formData.manufactureDate || undefined,
                expirationDate: formData.expirationDate || undefined,
                supplierId: formData.supplierId || undefined,
                poNumber: formData.poNumber || undefined,
                notes: formData.notes || undefined,
                status: formData.status,
            })

            await loadLot()
            setIsEditing(false)
            toast.success("Lot updated successfully")
        } catch (error) {
            console.error("Failed to update lot:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update lot")
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        if (lot) {
            setFormData({
                lotNumber: lot.lotNumber,
                receivedDate: lot.receivedDate ? new Date(lot.receivedDate).toISOString().split('T')[0] : "",
                manufactureDate: lot.manufactureDate ? new Date(lot.manufactureDate).toISOString().split('T')[0] : "",
                expirationDate: lot.expirationDate ? new Date(lot.expirationDate).toISOString().split('T')[0] : "",
                supplierId: lot.supplierId || "",
                poNumber: lot.poNumber || "",
                notes: lot.notes || "",
                status: lot.status as LotStatus,
            })
        }
        setIsEditing(false)
    }

    const handleOpenAdjustLocation = (locationId: string, locationCode: string, currentQuantity: number) => {
        setAdjustingLocation({ locationId, locationCode, currentQuantity })
        setAdjustmentQuantity("")
        setAdjustmentNote("")
        setIsAdjustLocationOpen(true)
    }

    const getLotStatusBadge = (status: LotStatus) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge className="bg-green-500">Active</Badge>
            case 'DEPLETED':
                return <Badge variant="secondary">Depleted</Badge>
            case 'EXPIRED':
                return <Badge variant="destructive">Expired</Badge>
            case 'QUARANTINED':
                return <Badge className="bg-yellow-500">Quarantined</Badge>
            case 'RECALLED':
                return <Badge variant="destructive">Recalled</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getDaysUntilExpiration = (expirationDate: string | null) => {
        if (!expirationDate) return null
        const now = new Date()
        const expDate = new Date(expirationDate)
        const diffTime = expDate.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    const getExpirationWarning = (expirationDate: string | null) => {
        const days = getDaysUntilExpiration(expirationDate)
        if (days === null) return null

        if (days < 0) return { color: 'text-red-600 bg-red-50 border-red-200', text: 'Expired', icon: AlertTriangle }
        if (days <= 7) return { color: 'text-orange-600 bg-orange-50 border-orange-200', text: `Expires in ${days} days`, icon: AlertTriangle }
        if (days <= 30) return { color: 'text-yellow-600 bg-yellow-50 border-yellow-200', text: `Expires in ${days} days`, icon: Clock }
        return null
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading lot details...</p>
                </div>
            </div>
        )
    }

    if (!lot) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Card className="max-w-md">
                    <CardHeader>
                        <CardTitle>Lot Not Found</CardTitle>
                        <CardDescription>The lot you&apos;re looking for doesn&apos;t exist.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push(`/dashboard/items/${itemId}`)}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Back to Item
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const expirationWarning = getExpirationWarning(lot.expirationDate)
    const availableLocations = locations.filter(
        loc => !lot.locations.some(lotLoc => lotLoc.locationId === loc.id)
    )
    const isSystemLot = lot.isSystem || lot.lotNumber === "EXISTING-STOCK"

    return (
        <div className="min-h-screen bg-background pb-6">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-between px-3 sm:px-6 py-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/items/${itemId}`)}
                        className="gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Back to Item</span>
                    </Button>

                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <Button onClick={() => setIsEditing(true)} className="shadow-sm gap-2">
                                <Edit2 className="h-4 w-4" />
                                <span className="hidden sm:inline">Edit</span>
                            </Button>
                        ) : (
                            <>
                                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                                    Cancel
                                </Button>
                                <Button onClick={handleSave} className="shadow-sm gap-2" disabled={isSaving}>
                                    {isSaving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            Save
                                        </>
                                    )}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-3 sm:px-6 pt-4 sm:pt-6">
                {/* Hero Section */}
                <div className="bg-card border rounded-lg overflow-hidden mb-6">
                    <div className="p-4 sm:p-6">
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                            {/* Lot Icon */}
                            <div className="flex-shrink-0">
                                <div className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden flex items-center justify-center ${isSystemLot ? "bg-blue-50 border-2 border-blue-200" : "bg-primary/10"
                                    }`}>
                                    <PackageCheck className={`h-12 w-12 ${isSystemLot ? "text-blue-600" : "text-primary"}`} />
                                </div>
                            </div>

                            {/* Lot Info */}
                            <div className="flex-1 min-w-0">
                                {isEditing && !isSystemLot ? (
                                    <Input
                                        value={formData.lotNumber}
                                        onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                                        className="text-2xl font-bold h-auto py-2 mb-3 border-dashed font-mono"
                                        placeholder="Enter lot number"
                                    />
                                ) : (
                                    <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 font-mono">{lot.lotNumber}</h1>
                                )}

                                <div className="flex flex-wrap gap-2 mb-4">
                                    {getLotStatusBadge(lot.status)}
                                    {isSystemLot && (
                                        <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                            <Package className="h-3 w-3 mr-1" />
                                            Pre-existing Stock
                                        </Badge>
                                    )}
                                    {expirationWarning && (
                                        <Badge variant="outline" className={expirationWarning.color}>
                                            {React.createElement(expirationWarning.icon, { className: "h-3 w-3 mr-1" })}
                                            {expirationWarning.text}
                                        </Badge>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Total Quantity</p>
                                        <p className="text-sm font-semibold text-primary">{lot.quantity} units</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Initial Quantity</p>
                                        <p className="text-sm font-semibold">{lot.initialQuantity} units</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Remaining</p>
                                        <p className="text-sm font-semibold">
                                            {Math.round((lot.quantity / lot.initialQuantity) * 100)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Locations</p>
                                        <p className="text-sm font-semibold">{lot.locations.length}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expiration Warning Alert */}
                {expirationWarning && (
                    <Alert className={`mb-6 ${expirationWarning.color}`}>
                        {React.createElement(expirationWarning.icon, { className: "h-4 w-4" })}
                        <AlertDescription>
                            {expirationWarning.text}
                            {lot.expirationDate && ` - ${new Date(lot.expirationDate).toLocaleDateString()}`}
                        </AlertDescription>
                    </Alert>
                )}

                {isSystemLot && (
                    <Alert className="mb-6 bg-blue-50 border-blue-200">
                        <Package className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-900">
                            This lot represents inventory that existed before lot tracking was enabled. You can adjust it normally.
                        </AlertDescription>
                    </Alert>
                )}

                {/* Tabs Section */}
                <Tabs defaultValue="details" className="gap-0">
                    <div className="bg-card border rounded-t-lg">
                        <TabsList className="w-full grid grid-cols-3 h-auto p-0 bg-transparent border-0 rounded-none">
                            <TabsTrigger
                                value="details"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="locations"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                            >
                                Locations ({lot.locations.length})
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                            >
                                History
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Details Tab */}
                    <TabsContent value="details" className="mt-0">
                        <div className="bg-card p-4 border-x border-b rounded-b-lg">
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="lotNumber" className="text-xs text-muted-foreground">Lot Number</Label>
                                        {isEditing && !isSystemLot ? (
                                            <Input
                                                id="lotNumber"
                                                value={formData.lotNumber}
                                                onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                                                className="font-mono h-9"
                                                placeholder="Enter lot number"
                                            />
                                        ) : (
                                            <div className="text-sm font-medium font-mono flex items-center gap-2">
                                                {lot.lotNumber}
                                                {isSystemLot && <span className="text-xs text-muted-foreground">(System-managed)</span>}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="status" className="text-xs text-muted-foreground">Status</Label>
                                        {isEditing ? (
                                            <Select value={formData.status} onValueChange={(value: LotStatus) => setFormData({ ...formData, status: value })}>
                                                <SelectTrigger id="status" className="h-9">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                                    <SelectItem value="DEPLETED">Depleted</SelectItem>
                                                    <SelectItem value="EXPIRED">Expired</SelectItem>
                                                    <SelectItem value="QUARANTINED">Quarantined</SelectItem>
                                                    <SelectItem value="RECALLED">Recalled</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <div className="text-sm font-medium">{getLotStatusBadge(lot.status)}</div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="receivedDate" className="text-xs text-muted-foreground">Received Date</Label>
                                        {isEditing ? (
                                            <Input
                                                id="receivedDate"
                                                type="date"
                                                value={formData.receivedDate}
                                                onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                                                className="h-9"
                                            />
                                        ) : (
                                            <div className="text-sm font-medium flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {lot.receivedDate ? new Date(lot.receivedDate).toLocaleDateString() : "—"}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="manufactureDate" className="text-xs text-muted-foreground">Manufacture Date</Label>
                                        {isEditing ? (
                                            <Input
                                                id="manufactureDate"
                                                type="date"
                                                value={formData.manufactureDate}
                                                onChange={(e) => setFormData({ ...formData, manufactureDate: e.target.value })}
                                                className="h-9"
                                            />
                                        ) : (
                                            <div className="text-sm font-medium flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {lot.manufactureDate ? new Date(lot.manufactureDate).toLocaleDateString() : "—"}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="expirationDate" className="text-xs text-muted-foreground">Expiration Date</Label>
                                        {isEditing ? (
                                            <Input
                                                id="expirationDate"
                                                type="date"
                                                value={formData.expirationDate}
                                                onChange={(e) => setFormData({ ...formData, expirationDate: e.target.value })}
                                                className="h-9"
                                            />
                                        ) : (
                                            <div className="text-sm font-medium flex items-center gap-1.5">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {lot.expirationDate ? new Date(lot.expirationDate).toLocaleDateString() : "—"}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="supplier" className="text-xs text-muted-foreground">Supplier</Label>
                                        {isEditing ? (
                                            <Select
                                                value={formData.supplierId || "__none__"}
                                                onValueChange={(value) => setFormData({ ...formData, supplierId: value === "__none__" ? "" : value })}
                                            >
                                                <SelectTrigger id="supplier" className="h-9">
                                                    <SelectValue placeholder="Select supplier" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="__none__">None</SelectItem>
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
                                                {lot.supplier?.name || "—"}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="poNumber" className="text-xs text-muted-foreground">PO Number</Label>
                                        {isEditing ? (
                                            <Input
                                                id="poNumber"
                                                value={formData.poNumber}
                                                onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })}
                                                className="h-9"
                                                placeholder="PO-12345"
                                            />
                                        ) : (
                                            <div className="text-sm font-medium flex items-center gap-1.5">
                                                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                                {lot.poNumber || "—"}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="notes" className="text-xs text-muted-foreground">Notes</Label>
                                    {isEditing ? (
                                        <Textarea
                                            id="notes"
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows={3}
                                            placeholder="Enter notes about this lot..."
                                        />
                                    ) : (
                                        <div className="text-sm flex items-start gap-1.5">
                                            <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                                            <span>{lot.notes || "—"}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Locations Tab */}
                    <TabsContent value="locations" className="mt-0">
                        <div className="bg-card p-4 border-x border-b rounded-b-lg">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-semibold">Storage Locations</h3>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsAddLocationOpen(true)}
                                    className="gap-2 h-7"
                                    disabled={availableLocations.length === 0}
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">Add Location</span>
                                </Button>
                            </div>

                            {lot.locations.length === 0 ? (
                                <div className="text-center py-12 px-4 border border-dashed rounded-lg">
                                    <MapPin className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p className="text-sm font-medium text-muted-foreground">No locations assigned</p>
                                    <p className="text-xs text-muted-foreground mt-1">Add this lot to storage locations</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {lot.locations
                                        .sort((a, b) => b.quantity - a.quantity)
                                        .map((lotLocation) => (
                                            <div
                                                key={lotLocation.id}
                                                className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 hover:border-accent/50 transition-all"
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                                                        <MapPin className="h-5 w-5 text-accent" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold font-mono text-sm">
                                                            {lotLocation.locationCode}
                                                        </h3>
                                                        {lotLocation.quantity === 0 && (
                                                            <p className="text-xs text-muted-foreground">Empty</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="text-right">
                                                        <p className="text-xs text-muted-foreground mb-0">Quantity</p>
                                                        <p className="text-xl font-bold text-accent">{lotLocation.quantity}</p>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleOpenAdjustLocation(
                                                            lotLocation.locationId,
                                                            lotLocation.locationCode,
                                                            lotLocation.quantity
                                                        )}
                                                    >
                                                        Adjust
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history" className="mt-0">
                        <div className="bg-card overflow-hidden border-x border-b rounded-b-lg">
                            <div className="p-4 border-b">
                                <h3 className="text-base font-semibold">Transaction History</h3>
                            </div>
                            {lot.transactions && lot.transactions.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="text-xs">Type</TableHead>
                                                <TableHead className="text-xs text-right">Qty</TableHead>
                                                <TableHead className="text-xs">Reason</TableHead>
                                                <TableHead className="text-xs hidden sm:table-cell">User</TableHead>
                                                <TableHead className="text-xs">Date</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {lot.transactions.map((transaction) => (
                                                <TableRow key={transaction.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-1.5 rounded ${transaction.type === "INPUT" ? "bg-green-50" : "bg-red-50"}`}>
                                                                {transaction.type === "INPUT" ? (
                                                                    <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                                                                ) : (
                                                                    <TrendingDown className="h-3.5 w-3.5 text-red-600" />
                                                                )}
                                                            </div>
                                                            <span className="text-sm hidden sm:inline">
                                                                {transaction.type === "INPUT" ? "Added" : "Removed"}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <span
                                                            className={`text-sm font-semibold ${transaction.type === "INPUT" ? "text-green-600" : "text-red-600"
                                                                }`}
                                                        >
                                                            {transaction.type === "INPUT" ? "+" : "-"}
                                                            {transaction.quantity}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-sm">{transaction.reason}</span>
                                                    </TableCell>
                                                    <TableCell className="hidden sm:table-cell">
                                                        <span className="text-sm text-muted-foreground">
                                                            {transaction.user?.name || "Unknown"}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(transaction.createdAt).toLocaleDateString()}
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-12 px-4">
                                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                    <p className="text-sm font-medium text-muted-foreground">No transaction history</p>
                                    <p className="text-xs text-muted-foreground mt-1">Transactions will appear here</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Add Location Dialog */}
            <AddLocationToLotDialog
                open={isAddLocationOpen}
                onOpenChange={setIsAddLocationOpen}
                lotId={lotId}
                availableLocations={availableLocations}
                onSuccess={loadLot}
            />

            {/* Adjust Location Dialog */}
            <AdjustLocationDialog
                open={isAdjustLocationOpen}
                onOpenChange={setIsAdjustLocationOpen}
                lotId={lotId}
                adjustingLocation={adjustingLocation}
                onSuccess={loadLot}
            />
        </div>
    )
}