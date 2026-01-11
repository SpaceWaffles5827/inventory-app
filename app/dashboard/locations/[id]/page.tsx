"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
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
    Loader2,
    LayoutGrid,
    List,
    TableIcon,
    ImageIcon,
    Diff,
    Trash2,
    AlertCircle,
    QrCode,
    Barcode,
    Edit2,
    Save,
    Settings2,
    Plus,
    X,
    Minus,
    Scan,
} from "lucide-react"
import { getLocationByIdApi, updateLocationApi, type LocationWithItems, type LocationStructure } from "@/lib/api/locations.api"
import { adjustStockApi } from "@/lib/api/items.api"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Html5Qrcode } from "html5-qrcode"

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

interface LocationLevel {
    id: string
    label: string
    value: string
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
    const [scannedBarcode, setScannedBarcode] = useState("")
    const [isScanning, setIsScanning] = useState(false)
    const [cameraError, setCameraError] = useState("")
    const [verificationCount, setVerificationCount] = useState(0)
    const [verificationCode, setVerificationCode] = useState<string | null>(null)
    const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
    const scannerElementId = "location-barcode-reader"
    const verificationCodeRef = useRef<string | null>(null)
    const verificationCountRef = useRef(0)

    // Structure editor state (separate dialog)
    const [isStructureEditorOpen, setIsStructureEditorOpen] = useState(false)
    const [locationLevels, setLocationLevels] = useState<LocationLevel[]>([])

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

    // Label generation state
    const [isLabelGenerateOpen, setIsLabelGenerateOpen] = useState(false)
    const [isGeneratingLabel, setIsGeneratingLabel] = useState(false)
    const [labelWidth, setLabelWidth] = useState("4")
    const [labelHeight, setLabelHeight] = useState("6")
    const [codeType, setCodeType] = useState<"qr" | "barcode">("qr")
    const [showLocationCode, setShowLocationCode] = useState(true)
    const [showStructure, setShowStructure] = useState(true)
    const [showBarcode, setShowBarcode] = useState(true)
    const [showDescription, setShowDescription] = useState(false)

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

    const startBarcodeScanner = async () => {
        console.log("[BARCODE] Opening scanner dialog...")
        setCameraError("")
        setVerificationCode(null)
        setVerificationCount(0)
        verificationCodeRef.current = null
        verificationCountRef.current = 0
        setIsBarcodeScanOpen(true)

        // Wait for dialog to open and DOM element to be available
        setTimeout(async () => {
            console.log("[BARCODE] Starting camera...")
            try {
                const element = document.getElementById(scannerElementId)
                if (!element) {
                    console.error("[BARCODE] Scanner element not found, waiting...")
                    // Try again after a bit more time
                    setTimeout(() => startBarcodeScanner(), 300)
                    return
                }

                const html5QrCode = new Html5Qrcode(scannerElementId)
                html5QrcodeRef.current = html5QrCode

                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 5,
                        qrbox: { width: 250, height: 250 },
                    },
                    (decodedText, decodedResult) => {
                        console.log(`[BARCODE] 📷 Detected: ${decodedText}`)

                        if (decodedText.length < 3 || decodedText.length > 100) {
                            console.log("[BARCODE] ⚠️ Rejected: Invalid length")
                            return
                        }

                        if (verificationCodeRef.current === decodedText) {
                            verificationCountRef.current++
                            const newCount = verificationCountRef.current
                            setVerificationCount(newCount)
                            console.log(`[BARCODE] ✓ Verification ${newCount}/5`)

                            if (newCount >= 5) {
                                console.log("[BARCODE] ✅ VERIFIED!")

                                // Store the barcode value
                                const verifiedBarcode = decodedText

                                // Reset verification state
                                verificationCodeRef.current = null
                                verificationCountRef.current = 0
                                setVerificationCode(null)
                                setVerificationCount(0)

                                // Stop and clean up scanner first
                                if (html5QrcodeRef.current) {
                                    html5QrcodeRef.current.stop().then(() => {
                                        html5QrcodeRef.current = null
                                        setIsScanning(false)
                                        setIsBarcodeScanOpen(false)

                                        // Update form data after everything is cleaned up
                                        setEditFormData(prev => ({ ...prev, barcode: verifiedBarcode }))

                                        // Show success toast only once
                                        toast.success("Barcode scanned successfully!")
                                    }).catch(err => {
                                        console.error("[BARCODE] Error stopping:", err)
                                    })
                                }
                            }
                        } else {
                            console.log("[BARCODE] 🆕 New code, starting verification")
                            verificationCodeRef.current = decodedText
                            verificationCountRef.current = 1
                            setVerificationCode(decodedText)
                            setVerificationCount(1)
                        }
                    },
                    (errorMessage) => {
                        // Silently ignore "not found" errors
                    }
                )
                setIsScanning(true)
                console.log("[BARCODE] ✅ Camera started successfully")
            } catch (err) {
                console.error("[BARCODE] Error starting scanner:", err)
                setCameraError("Failed to access camera. Please check permissions.")
                setIsScanning(false)
            }
        }, 300)
    }

    const stopBarcodeScanner = async () => {
        console.log("[BARCODE] Stopping scanner...")

        // Reset verification state
        verificationCodeRef.current = null
        verificationCountRef.current = 0
        setVerificationCode(null)
        setVerificationCount(0)

        if (html5QrcodeRef.current) {
            try {
                const state = html5QrcodeRef.current.getState()
                if (state === 2) {
                    await html5QrcodeRef.current.stop()
                    console.log("[BARCODE] Camera stopped")
                }
                await html5QrcodeRef.current.clear()
            } catch (err) {
                console.error("[BARCODE] Error stopping:", err)
            }
            html5QrcodeRef.current = null
        }
        setIsScanning(false)
        setIsBarcodeScanOpen(false)
    }

    useEffect(() => {
        return () => {
            if (html5QrcodeRef.current && isScanning) {
                html5QrcodeRef.current.stop().catch(console.error)
            }
        }
    }, [isScanning])

    const generateLocationCode = () => {
        const parts = locationLevels.map((level) => {
            const value = level.value.trim()
            if (value) {
                return value.toUpperCase()
            }
            const label = level.label.trim()
            return label ? label.charAt(0).toUpperCase() + "0" : "00"
        })
        return parts.join("-")
    }

    const addLocationLevel = () => {
        setLocationLevels([...locationLevels, { id: Date.now().toString(), label: "", value: "" }])
    }

    const removeLocationLevel = (id: string) => {
        if (locationLevels.length > 1) {
            setLocationLevels(locationLevels.filter((level) => level.id !== id))
        }
    }

    const updateLocationLevel = (id: string, field: "label" | "value", newValue: string) => {
        setLocationLevels(locationLevels.map((level) => (level.id === id ? { ...level, [field]: newValue } : level)))
    }

    const openStructureEditor = () => {
        if (!location) return

        const structure = location.structure as LocationStructure
        const levels: LocationLevel[] = structure.map((item, idx) => ({
            id: idx.toString(),
            label: item.label,
            value: item.value,
        }))

        setLocationLevels(levels.length > 0 ? levels : [{ id: "1", label: "Zone", value: "" }])
        setIsStructureEditorOpen(true)
    }

    const saveStructure = async () => {
        if (!location) return

        const filteredStructure = locationLevels
            .filter((level) => level.label.trim() && level.value.trim())
            .map((level) => ({
                label: level.label.trim(),
                value: level.value.trim().toUpperCase(),
            }))

        if (filteredStructure.length === 0) {
            toast.error("Please add at least one level with both label and value")
            return
        }

        const newCode = filteredStructure.map((part) => part.value).join("-")

        try {
            const response = await updateLocationApi(location.id, {
                code: newCode,
                structure: filteredStructure,
                workspaceId: currentWorkspaceId,
            })

            if (response.data?.location) {
                setLocation(response.data.location as LocationWithItems)
                setOriginalLocation(response.data.location as LocationWithItems)
                setIsStructureEditorOpen(false)
                toast.success("Location structure updated successfully")
            }
        } catch (error) {
            console.error("Failed to update structure:", error)
            toast.error(error instanceof Error ? error.message : "Failed to update structure")
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

            await adjustStockApi(removeDialog.item.id, {
                type: "OUTPUT",
                quantity: currentQuantity,
                reason: `Removed from location ${location?.code}`,
                locationId: locationId,
            })

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

    const generateLocationLabel = async () => {
        if (!location) return

        setIsGeneratingLabel(true)
        try {
            const QRCode = (await import('qrcode')).default
            const JsBarcode = (await import('jsbarcode')).default
            const { jsPDF } = await import('jspdf')

            const width = parseFloat(labelWidth) || 4
            const height = parseFloat(labelHeight) || 6

            if (width <= 0 || width > 12 || height <= 0 || height > 12) {
                toast.error("Label dimensions must be between 0 and 12 inches")
                setIsGeneratingLabel(false)
                return
            }

            const doc = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'in',
                format: [width, height]
            })

            const margin = 0.15
            const contentWidth = width - (margin * 2)
            const contentHeight = height - (margin * 2)
            let currentY = margin

            const hasHeader = showLocationCode || showStructure || showDescription
            const needsQR = codeType === 'qr'
            const needsBarcode = codeType === 'barcode'

            const barcodeValue = location.barcode || location.code || `LOC-${location.id}`

            if (hasHeader) {
                if (showLocationCode) {
                    const codeFontSize = Math.max(12, Math.min(20, width * 3.5))
                    doc.setFontSize(codeFontSize)
                    doc.setFont('helvetica', 'bold')
                    doc.text(location.code, width / 2, currentY + (codeFontSize * 0.012), { align: 'center' })
                    currentY += (codeFontSize * 0.012) + 0.05
                }

                if (showStructure && location.structure && Array.isArray(location.structure) && location.structure.length > 0) {
                    const structFontSize = Math.max(8, Math.min(11, width * 2.2))
                    doc.setFontSize(structFontSize)
                    doc.setFont('helvetica', 'normal')

                    const structureText = location.structure.map((s: any) => `${s.label}: ${s.value}`).join(' • ')
                    const structLines = doc.splitTextToSize(structureText, contentWidth)
                    const maxStructLines = 1
                    const truncatedStruct = structLines.slice(0, maxStructLines)

                    const lineHeight = structFontSize * 0.012
                    truncatedStruct.forEach((line: string, index: number) => {
                        doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
                    })
                    currentY += lineHeight * truncatedStruct.length + 0.04
                }

                if (showDescription && location.description) {
                    const descFontSize = Math.max(7, Math.min(9, width * 1.8))
                    doc.setFontSize(descFontSize)
                    doc.setFont('helvetica', 'italic')

                    const descLines = doc.splitTextToSize(location.description, contentWidth)
                    const maxDescLines = 1
                    const truncatedDesc = descLines.slice(0, maxDescLines)

                    const lineHeight = descFontSize * 0.012
                    truncatedDesc.forEach((line: string, index: number) => {
                        doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
                    })
                    currentY += lineHeight * truncatedDesc.length + 0.04
                }

                if (hasHeader && (needsQR || needsBarcode)) {
                    doc.setDrawColor(100, 100, 100)
                    doc.setLineWidth(0.01)
                    doc.line(margin, currentY, width - margin, currentY)
                    currentY += 0.08
                }
            }

            const availableCodeHeight = height - currentY - margin

            if (needsQR || needsBarcode) {
                const codeStartY = currentY

                if (needsQR) {
                    const maxQRSize = Math.min(
                        contentWidth * 0.9,
                        availableCodeHeight * 0.95
                    )

                    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, {
                        width: 500,
                        margin: 1,
                        errorCorrectionLevel: 'M'
                    })

                    const qrX = (width - maxQRSize) / 2
                    const qrY = codeStartY + ((availableCodeHeight - maxQRSize) / 2)
                    doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, maxQRSize, maxQRSize)

                } else if (needsBarcode) {
                    const canvas = document.createElement('canvas')
                    try {
                        JsBarcode(canvas, barcodeValue, {
                            format: 'CODE128',
                            width: 3,
                            height: Math.max(100, height * 30),
                            displayValue: showBarcode,
                            fontSize: Math.max(14, Math.min(20, width * 4)),
                            textMargin: 5,
                            margin: 10
                        })

                        const barcodeDataUrl = canvas.toDataURL('image/png')
                        const barcodeDisplayWidth = contentWidth * 0.95
                        const barcodeDisplayHeight = Math.min(availableCodeHeight * 0.8, height * 0.5)
                        const barcodeX = (width - barcodeDisplayWidth) / 2
                        const barcodeY = codeStartY + ((availableCodeHeight - barcodeDisplayHeight) / 2)

                        doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeDisplayWidth, barcodeDisplayHeight)
                    } catch (err) {
                        console.error('Barcode generation failed:', err)
                        toast.error('Barcode generation failed: ' + (err as Error).message)
                    }
                }
            }

            doc.setDrawColor(100, 100, 100)
            doc.setLineWidth(0.01)
            doc.rect(0.05, 0.05, width - 0.1, height - 0.1)

            const locationIdentifier = location.code.replace(/[^a-zA-Z0-9-]/g, '_')
            const timestamp = new Date().toISOString().slice(0, 10)
            doc.save(`location-label-${locationIdentifier}-${width}x${height}-${timestamp}.pdf`)

            toast.success("Label generated successfully!")
            setIsLabelGenerateOpen(false)
        } catch (error) {
            console.error("Failed to generate label:", error)
            toast.error("Failed to generate label. Please try again.")
        } finally {
            setIsGeneratingLabel(false)
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
        <div className="min-h-screen bg-background pb-6">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center justify-between px-3 sm:px-6 py-3">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Back</span>
                    </Button>

                    <div className="flex items-center gap-2">
                        {!isEditMode ? (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setIsLabelGenerateOpen(true)} className="gap-2">
                                    <QrCode className="h-4 w-4" />
                                    <span className="hidden sm:inline">Label</span>
                                </Button>
                                <Button onClick={handleEditMode} className="shadow-sm gap-2">
                                    <Edit2 className="h-4 w-4" />
                                    <span className="hidden sm:inline">Edit</span>
                                </Button>
                            </>
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
                <div className="bg-card border rounded-lg overflow-hidden">
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

                {/* Tabs Section */}
                <Tabs defaultValue="details" className="mt-4 sm:mt-6 gap-0">
                    <div className="bg-card border rounded-t-lg">
                        <TabsList className="w-full grid grid-cols-2 h-auto p-0 bg-transparent border-0px rounded-none">
                            <TabsTrigger
                                value="details"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                            >
                                Details
                            </TabsTrigger>
                            <TabsTrigger
                                value="inventory"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-3"
                            >
                                Inventory
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Details Tab - With Inline Editing */}
                    <TabsContent value="details" className="mt-0">
                        <div className="bg-card p-4">
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
                                                onClick={startBarcodeScanner}
                                                className="h-10 gap-2"
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
                        <div className="bg-card p-4">
                            <div className="flex items-center justify-between mb-4">
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
                                        <div className="space-y-3">
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
                                </>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Structure Editor Dialog - Matching locations page style */}
            <Dialog open={isStructureEditorOpen} onOpenChange={setIsStructureEditorOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
                    <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-3 border-b border-border/50">
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Settings2 className="h-4 w-4 text-primary" />
                            </div>
                            Edit Location Structure
                        </DialogTitle>
                        <DialogDescription className="text-sm mt-1">
                            Customize the hierarchy levels and values for this location
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                        <div className="space-y-3 flex flex-col h-full">
                            <div className="flex items-center justify-between pb-2 border-b border-border/30">
                                <div>
                                    <h3 className="text-sm font-semibold text-foreground">Location Structure</h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">Update your location hierarchy</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addLocationLevel}
                                    className="h-7 text-xs bg-background hover:bg-accent/10 hover:border-accent/50 transition-all"
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add
                                </Button>
                            </div>

                            <div className="space-y-2 flex-1 overflow-y-auto">
                                {locationLevels.map((level, index) => (
                                    <div
                                        key={level.id}
                                        className="group flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-card/50 hover:bg-card hover:border-border transition-all"
                                    >
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-xs flex-shrink-0">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 flex gap-2">
                                            <div className="flex-1">
                                                <Input
                                                    placeholder="Level name"
                                                    value={level.label}
                                                    onChange={(e) => updateLocationLevel(level.id, "label", e.target.value)}
                                                    className="h-8 text-sm bg-background border-border/50 focus:border-primary/50 transition-colors"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <Input
                                                    placeholder="Code"
                                                    value={level.value}
                                                    onChange={(e) => updateLocationLevel(level.id, "value", e.target.value)}
                                                    maxLength={10}
                                                    className="h-8 text-sm font-mono bg-background border-border/50 focus:border-primary/50 transition-colors"
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeLocationLevel(level.id)}
                                            disabled={locationLevels.length === 1}
                                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive flex-shrink-0 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>

                            {locationLevels.some((level) => level.value.trim()) && (
                                <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-2.5 flex-shrink-0">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-3xl -mr-12 -mt-12" />
                                    <div className="relative flex items-center gap-2">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 flex-shrink-0">
                                            <MapPin className="h-4 w-4 text-primary" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs text-muted-foreground">Updated Code</p>
                                            <p className="text-base font-mono font-bold text-primary truncate">
                                                {locationLevels
                                                    .filter((l) => l.value.trim())
                                                    .map((l) => l.value.trim().toUpperCase())
                                                    .join("-")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-border/50">
                        <Button
                            variant="outline"
                            onClick={() => setIsStructureEditorOpen(false)}
                            className="h-9 px-5 hover:bg-accent/10 transition-all"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={saveStructure}
                            disabled={!locationLevels.some((level) => level.value.trim())}
                            className="h-9 px-5 shadow-md hover:shadow-lg transition-all"
                        >
                            Save Structure
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-base">Adjust Stock at Location</DialogTitle>
                        <DialogDescription className="text-xs">
                            Update the quantity for this item at the selected location.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 py-3">
                        <div className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border">
                            <span className="text-xs text-muted-foreground">Current Quantity</span>
                            <span className="text-base font-bold">{adjustmentDialog.item?.quantity || 0}</span>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs">Adjustment Amount</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={decrementQuantity}
                                    className="flex-shrink-0 h-9 w-9"
                                >
                                    <Minus className="h-3.5 w-3.5" />
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
                                    className="text-center font-semibold flex-1 min-w-0 h-9 text-sm"
                                />

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={incrementQuantity}
                                    className="flex-shrink-0 h-9 w-9"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="newStock" className="text-xs">New Quantity</Label>
                            <Input
                                id="newStock"
                                type="number"
                                min="0"
                                value={newStockAmount}
                                onChange={(e) => handleNewStockAmountChange(e.target.value)}
                                className="font-semibold h-9 text-sm"
                            />
                            {Number.parseInt(newStockAmount) < 0 && (
                                <Alert variant="destructive" className="py-1.5">
                                    <AlertCircle className="h-3 w-3" />
                                    <AlertDescription className="text-xs">Stock quantity cannot be negative.</AlertDescription>
                                </Alert>
                            )}
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="note" className="text-xs">Note (Optional)</Label>
                            <Textarea
                                id="note"
                                placeholder="Reason for adjustment..."
                                value={adjustmentNote}
                                onChange={(e) => setAdjustmentNote(e.target.value)}
                                className="min-h-14 resize-none text-xs"
                            />
                        </div>
                    </div>

                    <DialogFooter>
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

            {/* Label Generation Dialog */}
            <Dialog open={isLabelGenerateOpen} onOpenChange={setIsLabelGenerateOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <QrCode className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            </div>
                            Generate Location Label
                        </DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Generate a printable label with QR code or barcode for this location.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2 py-0">
                        <div className="border-2 border-dashed rounded-lg p-2 sm:p-3 bg-white text-black overflow-hidden">
                            <div className="space-y-1.5 sm:space-y-2">
                                {(showLocationCode || showStructure || showDescription) && (
                                    <div className="text-center border-b border-gray-300 pb-1.5">
                                        {showLocationCode && (
                                            <h3 className="font-bold text-xs sm:text-sm line-clamp-1">
                                                {location.code}
                                            </h3>
                                        )}
                                        {showStructure && structure.length > 0 && (
                                            <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-1 mt-0.5">
                                                {structure.map(s => `${s.label}: ${s.value}`).join(' • ')}
                                            </p>
                                        )}
                                        {showDescription && location.description && (
                                            <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-1 mt-0.5">
                                                {location.description}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {(codeType === "qr" || codeType === "barcode") && (
                                    <>
                                        {codeType === "qr" ? (
                                            <div className="flex justify-center py-1">
                                                <div className="w-32 h-32 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                                                    <div className="text-center">
                                                        <QrCode className="h-16 w-16 mx-auto text-gray-400" />
                                                        <p className="text-[10px] text-gray-500 mt-1">QR Code</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="py-1">
                                                <div className="h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50 w-full">
                                                    <div className="text-center w-full px-2">
                                                        <Barcode className="h-10 w-10 mx-auto text-gray-400" />
                                                        {showBarcode && (
                                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                                {location.barcode || location.code}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold">Label Configuration</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="space-y-1">
                                        <Label htmlFor="labelWidth" className="text-[10px] text-muted-foreground">
                                            Width (in)
                                        </Label>
                                        <Input
                                            id="labelWidth"
                                            type="number"
                                            step="0.1"
                                            min="0.5"
                                            max="12"
                                            value={labelWidth}
                                            onChange={(e) => setLabelWidth(e.target.value)}
                                            className="h-7 text-xs"
                                            placeholder="4"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="labelHeight" className="text-[10px] text-muted-foreground">
                                            Height (in)
                                        </Label>
                                        <Input
                                            id="labelHeight"
                                            type="number"
                                            step="0.1"
                                            min="0.5"
                                            max="12"
                                            value={labelHeight}
                                            onChange={(e) => setLabelHeight(e.target.value)}
                                            className="h-7 text-xs"
                                            placeholder="6"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label htmlFor="codeType" className="text-[10px] text-muted-foreground">
                                            Code Type
                                        </Label>
                                        <Select value={codeType} onValueChange={(value: any) => setCodeType(value)}>
                                            <SelectTrigger id="codeType" className="h-7 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="qr" className="text-xs">
                                                    QR Code
                                                </SelectItem>
                                                <SelectItem value="barcode" className="text-xs">
                                                    Barcode
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-lg p-2 bg-muted/30 space-y-1">
                                <Label className="text-xs font-semibold">Label Fields</Label>
                                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showLocationCode" className="text-xs font-normal cursor-pointer">
                                            Code
                                        </Label>
                                        <Switch id="showLocationCode" checked={showLocationCode} onCheckedChange={setShowLocationCode} className="scale-75" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showStructure" className="text-xs font-normal cursor-pointer">
                                            Structure
                                        </Label>
                                        <Switch
                                            id="showStructure"
                                            checked={showStructure}
                                            onCheckedChange={setShowStructure}
                                            className="scale-75"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showBarcode" className="text-xs font-normal cursor-pointer">
                                            Code #
                                        </Label>
                                        <Switch
                                            id="showBarcode"
                                            checked={showBarcode}
                                            onCheckedChange={setShowBarcode}
                                            className="scale-75"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showDescription" className="text-xs font-normal cursor-pointer">
                                            Desc
                                        </Label>
                                        <Switch id="showDescription" checked={showDescription} onCheckedChange={setShowDescription} className="scale-75" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsLabelGenerateOpen(false)}
                            className="h-8 text-xs"
                            disabled={isGeneratingLabel}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={generateLocationLabel}
                            disabled={isGeneratingLabel}
                            className="gap-2 h-8 text-xs"
                        >
                            {isGeneratingLabel ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                "Download PDF"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Barcode Scanner Dialog */}
            <Dialog open={isBarcodeScanOpen} onOpenChange={(open) => {
                if (!open) {
                    stopBarcodeScanner()
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Scan Barcode</DialogTitle>
                        <DialogDescription>Position the barcode within the frame</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Camera Scanner */}
                        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                            {cameraError ? (
                                <div className="absolute inset-0 flex items-center justify-center p-4">
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                                    </Alert>
                                </div>
                            ) : (
                                <div id={scannerElementId} className="w-full h-full" />
                            )}
                        </div>

                        {/* Verification Progress - Only show counter, no scan history */}
                        {verificationCount > 0 && !cameraError && (
                            <div className="p-3 bg-muted/50 rounded-lg text-center">
                                <p className="text-sm font-semibold text-green-500">
                                    Verifying {verificationCount}/5
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={stopBarcodeScanner} className="w-full">
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}