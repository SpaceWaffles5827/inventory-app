"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
    Package,
    Settings,
    Truck,
    MapPin,
    Plus,
    Check,
    ChevronLeft,
    List,
    AlertCircle,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select"
import { adjustStockApi, type ItemWithRelations } from "@/lib/api/items.api"

type ScanStep = "select" | "scanItem" | "scanLocation" | "manualLocationSelect" | "adjustmentDetails" | "confirm"

interface ScanModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    allItems: ItemWithRelations[]
    currentWorkspaceId: string
}

const scanModes = [
    {
        id: "lookup",
        title: "Look Up Item",
        description: "View item details and locations",
        icon: Package,
    },
    {
        id: "adjust",
        title: "Adjust Quantity",
        description: "Add or remove stock at a location",
        icon: Plus,
    },
    {
        id: "inventory-adjustment",
        title: "Inventory Adjustment",
        description: "Audit and correct stock levels",
        icon: Check,
    },
    {
        id: "location",
        title: "View Location",
        description: "See all items at a location",
        icon: MapPin,
    },
    {
        id: "edit",
        title: "Edit Item",
        description: "Update item information",
        icon: Settings,
    },
    {
        id: "move",
        title: "Move Item",
        description: "Transfer between locations",
        icon: Truck,
    },
]

export function ScanModal({ open, onOpenChange, allItems, currentWorkspaceId }: ScanModalProps) {
    const router = useRouter()
    const [cameraError, setCameraError] = useState("")
    const [scannedCode, setScannedCode] = useState<string | null>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [error, setError] = useState("")

    // Workflow states
    const [scanMode, setScanMode] = useState<string | null>(null)
    const [scanStep, setScanStep] = useState<ScanStep>("select")
    const [scannedItem, setScannedItem] = useState<ItemWithRelations | null>(null)
    const [scannedLocation, setScannedLocation] = useState<any | null>(null)
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
    const [quantity, setQuantity] = useState<number>(1)
    const [adjustmentReason, setAdjustmentReason] = useState("")
    const [adjustmentNote, setAdjustmentNote] = useState("")

    const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
    const scannerElementId = "qr-reader"
    const initAttemptRef = useRef(0)

    useEffect(() => {
        if (open && (scanStep === "scanItem" || scanStep === "scanLocation")) {
            setScannedCode(null)
            setCameraError("")
            initAttemptRef.current = 0

            setTimeout(() => {
                startScanner()
            }, 500)
        } else {
            stopScanner()
        }

        return () => stopScanner()
    }, [open, scanStep])

    const startScanner = async () => {
        console.log("[SCANNER] Starting scanner (attempt", initAttemptRef.current + 1, ")...")
        initAttemptRef.current++

        try {
            const element = document.getElementById(scannerElementId)
            if (!element) {
                console.error("[SCANNER] Scanner element not found, retrying...")
                if (initAttemptRef.current < 5) {
                    setTimeout(startScanner, 300)
                } else {
                    setCameraError("Failed to initialize scanner. Please try again.")
                }
                return
            }

            html5QrcodeRef.current = new Html5Qrcode(scannerElementId)

            // Config that works reliably on all devices
            const config = {
                fps: 5,
                qrbox: { width: 250, height: 250 },
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                    Html5QrcodeSupportedFormats.CODABAR,
                ],
            }

            console.log("[SCANNER] Getting cameras...")

            let cameras
            try {
                cameras = await Html5Qrcode.getCameras()
            } catch (err: any) {
                console.error("[SCANNER] Camera access error:", err)
                setCameraError("Camera access denied. Please allow camera permissions in your browser settings.")
                return
            }

            console.log("[SCANNER] Available cameras:", cameras.length)

            if (cameras.length === 0) {
                setCameraError("No cameras found. Please check your device permissions.")
                return
            }

            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            let cameraConfig: any

            if (isMobile) {
                console.log("[SCANNER] Mobile device detected, using facingMode")
                cameraConfig = { facingMode: "environment" }
            } else {
                let cameraId = cameras[0].id
                const rearCamera = cameras.find(
                    (camera) =>
                        camera.label.toLowerCase().includes("back") ||
                        camera.label.toLowerCase().includes("rear") ||
                        camera.label.toLowerCase().includes("environment")
                )

                if (rearCamera) {
                    cameraId = rearCamera.id
                    console.log("[SCANNER] Using rear camera:", rearCamera.label)
                } else {
                    console.log("[SCANNER] Using camera:", cameras[0].label)
                }
                cameraConfig = cameraId
            }

            console.log("[SCANNER] Starting camera with config:", cameraConfig)

            await html5QrcodeRef.current.start(
                cameraConfig,
                config,
                (decodedText, decodedResult) => {
                    console.log(`[SCANNER] 📷 Detected: ${decodedText}`)

                    if (decodedText.length < 3) {
                        console.log("[SCANNER] ⚠️ Rejected: Too short (< 3 chars)")
                        return
                    }
                    if (decodedText.length > 100) {
                        console.log("[SCANNER] ⚠️ Rejected: Too long (> 100 chars)")
                        return
                    }

                    // Process immediately on first scan - don't pause the scanner
                    console.log("[SCANNER] ✅ Processing scan")

                    handleVerifiedScan(decodedText)
                },
                (errorMessage) => {
                    // Silently ignore "not found" errors
                }
            )

            setIsScanning(true)
            console.log("[SCANNER] ✅ Camera started successfully")
        } catch (err: any) {
            console.error("[SCANNER] Failed to start:", err)

            let errorMsg = "Failed to start camera. "
            if (err.message?.includes("Permission") || err.message?.includes("NotAllowed")) {
                errorMsg += "Please allow camera access in your browser settings."
            } else if (err.message?.includes("NotFound")) {
                errorMsg += "No camera found on this device."
            } else if (err.message?.includes("NotReadable")) {
                errorMsg += "Camera is being used by another app. Please close other apps and try again."
            } else {
                errorMsg += err.message || "Unknown error."
            }

            setCameraError(errorMsg)
            setIsScanning(false)
        }
    }

    const stopScanner = async () => {
        console.log("[SCANNER] Stopping scanner...")

        if (html5QrcodeRef.current) {
            try {
                const state = html5QrcodeRef.current.getState()
                if (state === 2) {
                    await html5QrcodeRef.current.stop()
                    console.log("[SCANNER] Camera stopped")
                }
                await html5QrcodeRef.current.clear()
            } catch (err) {
                console.error("[SCANNER] Error stopping:", err)
            }
            html5QrcodeRef.current = null
        }

        setIsScanning(false)
    }

    const findItemByBarcode = (scannedCode: string, items: ItemWithRelations[]): ItemWithRelations | null => {
        const scanned = scannedCode.trim()

        console.log("[SCANNER] Searching for barcode:", scanned)
        console.log("[SCANNER] Available items:", items.length)
        console.log("[SCANNER] Database barcodes:", items.map((i) => ({ name: i.name, barcode: i.barcode })))

        // Strategy 1: Exact match (case-insensitive)
        let item = items.find((i) => i.barcode?.trim().toLowerCase() === scanned.toLowerCase())
        if (item) {
            console.log("[SCANNER] ✅ Found via exact match")
            return item
        }

        // Strategy 2: Match with leading zeros removed from scanned code
        const scannedWithoutLeadingZeros = scanned.replace(/^0+/, "")
        if (scannedWithoutLeadingZeros !== scanned) {
            item = items.find((i) => i.barcode?.trim().toLowerCase() === scannedWithoutLeadingZeros.toLowerCase())
            if (item) {
                console.log("[SCANNER] ✅ Found via removing leading zeros from scan:", scanned, "->", scannedWithoutLeadingZeros)
                return item
            }
        }

        // Strategy 3: Match with leading zeros removed from database barcode
        item = items.find((i) => {
            if (!i.barcode) return false
            const dbWithoutLeadingZeros = i.barcode.trim().replace(/^0+/, "")
            return dbWithoutLeadingZeros.toLowerCase() === scanned.toLowerCase()
        })
        if (item) {
            console.log("[SCANNER] ✅ Found via removing leading zeros from database")
            return item
        }

        // Strategy 4: Match both without leading zeros
        item = items.find((i) => {
            if (!i.barcode) return false
            const dbWithoutLeadingZeros = i.barcode.trim().replace(/^0+/, "")
            return dbWithoutLeadingZeros.toLowerCase() === scannedWithoutLeadingZeros.toLowerCase()
        })
        if (item) {
            console.log("[SCANNER] ✅ Found via removing leading zeros from both")
            return item
        }

        // Strategy 5: For UPC-A (12 digits) / EAN-13 (13 digits) conversion
        if (scanned.length === 13 && scanned.startsWith("0")) {
            const upcA = scanned.substring(1)
            item = items.find((i) => i.barcode?.trim().toLowerCase() === upcA.toLowerCase())
            if (item) {
                console.log("[SCANNER] ✅ Found via EAN-13 to UPC-A conversion:", scanned, "->", upcA)
                return item
            }
        }

        // Strategy 6: Try adding leading zero (UPC-A to EAN-13)
        if (scanned.length === 12) {
            const ean13 = "0" + scanned
            item = items.find((i) => i.barcode?.trim().toLowerCase() === ean13.toLowerCase())
            if (item) {
                console.log("[SCANNER] ✅ Found via UPC-A to EAN-13 conversion:", scanned, "->", ean13)
                return item
            }
        }

        console.log("[SCANNER] ❌ No match found with any strategy")
        return null
    }

    const handleVerifiedScan = (scannedCode: string) => {
        console.log("[SCANNER] Processing verified scan:", scannedCode)

        if (!scannedCode) return

        if (scanStep === "scanItem") {
            const item = findItemByBarcode(scannedCode, allItems)

            if (!item) {
                console.log("[SCANNER] ❌ Item not found")
                // Show error but don't stop scanner - continue scanning
                setCameraError(`Item not found: ${scannedCode}`)

                // Auto-clear error after 2 seconds
                setTimeout(() => {
                    setCameraError("")
                }, 2000)
                return
            }

            console.log("[SCANNER] ✅ Item found:", item.name)

            // Stop scanner before navigating/changing steps
            setIsScanning(false)
            if (html5QrcodeRef.current) {
                html5QrcodeRef.current.pause(true)
            }

            setScannedItem(item)

            if (scanMode === "lookup") {
                console.log("[SCANNER] Navigating to item detail page")
                handleCloseModal()
                router.push(`/dashboard/items/${item.id}`)
                return
            } else if (scanMode === "edit") {
                console.log("[SCANNER] Navigating to edit item page")
                handleCloseModal()
                router.push(`/dashboard/items/${item.id}`)
                return
            } else if (scanMode === "adjust" || scanMode === "move" || scanMode === "inventory-adjustment") {
                console.log("[SCANNER] Moving to location scan step")
                setScanStep("scanLocation")
                return
            }
        } else if (scanStep === "scanLocation") {
            console.log("[SCANNER] Processing location scan:", scannedCode)

            // Stop scanner before changing steps
            setIsScanning(false)
            if (html5QrcodeRef.current) {
                html5QrcodeRef.current.pause(true)
            }

            setScannedLocation({ code: scannedCode, name: `Location ${scannedCode}` })

            if (scanMode === "location") {
                console.log("[SCANNER] Navigating to location view")
                handleCloseModal()
                router.push(`/dashboard/locations?code=${scannedCode}`)
                return
            } else if (scanMode === "adjust" || scanMode === "move" || scanMode === "inventory-adjustment") {
                console.log("[SCANNER] Moving to adjustment details")
                setScanStep("adjustmentDetails")
                return
            }
        }
    }

    const handleRescan = async () => {
        setScannedCode(null)
        setCameraError("")

        if (html5QrcodeRef.current) {
            try {
                await html5QrcodeRef.current.resume()
                setIsScanning(true)
            } catch (err) {
                console.error("[SCANNER] Error resuming:", err)
                await stopScanner()
                setTimeout(startScanner, 500)
            }
        }
    }

    const handleCloseModal = () => {
        onOpenChange(false)
        setTimeout(() => {
            setScanMode(null)
            setScanStep("select")
            setScannedItem(null)
            setScannedLocation(null)
            setSelectedLocationId(null)
            setQuantity(1)
            setAdjustmentReason("")
            setAdjustmentNote("")
            setScannedCode(null)
            setCameraError("")
        }, 200)
    }

    const handleModeSelect = (modeId: string) => {
        setScanMode(modeId)
        if (modeId === "location") {
            setScanStep("scanLocation")
        } else {
            setScanStep("scanItem")
        }
    }

    const handleBack = () => {
        if (scanStep === "confirm") {
            if (scanMode === "adjust" || scanMode === "move" || scanMode === "inventory-adjustment") {
                setScanStep("adjustmentDetails")
            } else {
                setScanStep("scanItem")
            }
        } else if (scanStep === "adjustmentDetails") {
            setScanStep("scanLocation")
            setScannedLocation(null)
            setSelectedLocationId(null)
        } else if (scanStep === "scanLocation") {
            if (scanMode === "location") {
                setScanStep("select")
                setScanMode(null)
            } else {
                setScanStep("scanItem")
                setScannedItem(null)
            }
        } else if (scanStep === "scanItem") {
            setScanStep("select")
            setScanMode(null)
        } else if (scanStep === "manualLocationSelect") {
            setScanStep("scanLocation")
        }
    }

    const handleLocationSelect = (locationId: string) => {
        setSelectedLocationId(locationId)
    }

    const handleConfirmAction = async () => {
        if (!scannedItem) return

        try {
            if (scanMode === "adjust" || scanMode === "inventory-adjustment") {
                const locationId = selectedLocationId || scannedLocation?.id

                await adjustStockApi(scannedItem.id, {
                    type: quantity >= 0 ? "INPUT" : "OUTPUT",
                    quantity: Math.abs(quantity),
                    reason: adjustmentReason,
                    locationId: locationId,
                })

                console.log("Stock adjustment successful")
            }

            handleCloseModal()
            window.location.reload()
        } catch (err) {
            console.error("Action failed:", err)
            setError(err instanceof Error ? err.message : "Action failed")
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleCloseModal}>
            <DialogContent
                enableKeyboardAvoidance={true}
                hideClose={true}
                className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
            >
                {scanStep === "select" ? (
                    <>
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            {/* Mobile Header with Actions */}
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    className="h-9 gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <DialogTitle className="text-base font-semibold flex-1 text-center">
                                    Select Action
                                </DialogTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCloseModal}
                                    className="h-9"
                                >
                                    Cancel
                                </Button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden sm:block">
                                <DialogTitle>Select Scan Action</DialogTitle>
                            </div>
                        </DialogHeader>

                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 sm:gap-2.5">
                                {scanModes.map((mode) => {
                                    const Icon = mode.icon
                                    return (
                                        <button
                                            key={mode.id}
                                            onClick={() => handleModeSelect(mode.id)}
                                            className="group relative flex items-center sm:flex-col sm:items-start gap-3 sm:gap-2 p-3 sm:p-3 rounded-lg border-2 border-border hover:border-primary/50 bg-card hover:bg-accent/5 transition-all hover:shadow-md active:scale-[0.98]"
                                        >
                                            <div className="h-10 w-10 sm:h-9 sm:w-9 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors flex-shrink-0">
                                                <Icon className="h-5 w-5 sm:h-5 sm:w-5 text-primary" />
                                            </div>
                                            <div className="text-left flex-1 sm:flex-none sm:space-y-0.5">
                                                <h3 className="font-semibold text-sm sm:text-sm">{mode.title}</h3>
                                                <p className="text-xs sm:text-xs text-muted-foreground leading-tight">{mode.description}</p>
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Footer - Desktop Only */}
                        <div className="hidden sm:flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                            <Button variant="outline" onClick={handleCloseModal} className="flex-1">
                                Cancel
                            </Button>
                        </div>
                    </>
                ) : scanStep === "scanItem" ? (
                    <>
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            {/* Mobile Header with Actions */}
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    className="h-9 gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <DialogTitle className="text-base font-semibold flex-1 text-center">
                                    {scanModes.find((m) => m.id === scanMode)?.title}
                                </DialogTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCloseModal}
                                    className="h-9"
                                >
                                    Cancel
                                </Button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden sm:block">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 -ml-2">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <DialogTitle>{scanModes.find((m) => m.id === scanMode)?.title}</DialogTitle>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {cameraError && !isScanning ? (
                                <div className="space-y-3">
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                                    </Alert>
                                    <Button
                                        onClick={() => {
                                            setCameraError("")
                                            setScannedCode(null)
                                            setTimeout(startScanner, 300)
                                        }}
                                        className="w-full"
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <div id={scannerElementId} className="rounded-lg overflow-hidden border-2 border-border min-h-[300px]" />

                                        {/* Error Toast Overlay */}
                                        {cameraError && isScanning && (
                                            <div className="absolute top-4 left-4 right-4 z-10">
                                                <Alert variant="destructive" className="shadow-lg">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                                                </Alert>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer - Desktop Only */}
                        {!cameraError && (
                            <div className="hidden sm:flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                                <Button variant="outline" onClick={handleBack} className="flex-1">
                                    Back
                                </Button>
                            </div>
                        )}
                    </>
                ) : scanStep === "scanLocation" ? (
                    <>
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            {/* Mobile Header with Actions */}
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    className="h-9 gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <DialogTitle className="text-base font-semibold flex-1 text-center">
                                    {scanMode === "location" ? "View Location" : "Scan Location"}
                                </DialogTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCloseModal}
                                    className="h-9"
                                >
                                    Cancel
                                </Button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden sm:block">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 -ml-2">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <DialogTitle>{scanMode === "location" ? "View Location" : "Scan Location"}</DialogTitle>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {cameraError && !isScanning ? (
                                <div className="space-y-3">
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                                    </Alert>
                                    <Button
                                        onClick={() => {
                                            setCameraError("")
                                            setScannedCode(null)
                                            setTimeout(startScanner, 300)
                                        }}
                                        className="w-full"
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <div id={scannerElementId} className="rounded-lg overflow-hidden border-2 border-border min-h-[300px]" />

                                        {/* Error Toast Overlay */}
                                        {cameraError && isScanning && (
                                            <div className="absolute top-4 left-4 right-4 z-10">
                                                <Alert variant="destructive" className="shadow-lg">
                                                    <AlertCircle className="h-4 w-4" />
                                                    <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                                                </Alert>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        {!cameraError && (
                            <div className="flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                                <Button variant="outline" onClick={handleBack} className="flex-1">
                                    Back
                                </Button>
                                {scannedItem && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setScanStep("manualLocationSelect")}
                                        className="flex-1 gap-2"
                                    >
                                        <List className="h-4 w-4" />
                                        <span className="hidden sm:inline">Select Location Manually</span>
                                        <span className="sm:hidden">Select Manually</span>
                                    </Button>
                                )}
                            </div>
                        )}
                    </>
                ) : scanStep === "manualLocationSelect" && scannedItem ? (
                    <>
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            {/* Mobile Header with Actions */}
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setScanStep("scanLocation")}
                                    className="h-9 gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <DialogTitle className="text-base font-semibold flex-1 text-center">
                                    Select Location
                                </DialogTitle>
                                <Button
                                    size="sm"
                                    onClick={() => setScanStep("adjustmentDetails")}
                                    disabled={!selectedLocationId}
                                    className="h-9"
                                >
                                    Continue
                                </Button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden sm:block">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => setScanStep("scanLocation")} className="h-8 w-8 -ml-2">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <DialogTitle>Select Location</DialogTitle>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="space-y-2">
                                {scannedItem.locations.map((location) => (
                                    <button
                                        key={location.locationId}
                                        onClick={() => handleLocationSelect(location.locationId)}
                                        className={`w-full p-3 rounded-lg border-2 transition-all text-left ${selectedLocationId === location.locationId
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/50 hover:bg-accent/5"
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-start gap-2">
                                                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="font-semibold text-sm">{location.location.code || location.location.name}</p>
                                                    <p className="text-xs text-muted-foreground">{location.location.name}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Stock: {location.quantity}</p>
                                                </div>
                                            </div>
                                            {selectedLocationId === location.locationId && (
                                                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Footer - Desktop Only */}
                        <div className="hidden sm:flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                            <Button variant="outline" onClick={() => setScanStep("scanLocation")} className="flex-1">
                                Back
                            </Button>
                            <Button onClick={() => setScanStep("adjustmentDetails")} disabled={!selectedLocationId} className="flex-1">
                                Continue
                            </Button>
                        </div>
                    </>
                ) : scanStep === "adjustmentDetails" && scannedItem && (scannedLocation || selectedLocationId) ? (
                    <>
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            {/* Mobile Header with Actions */}
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    className="h-9 gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <DialogTitle className="text-base font-semibold flex-1 text-center">
                                    Update Stock
                                </DialogTitle>
                                <Button
                                    size="sm"
                                    onClick={() => setScanStep("confirm")}
                                    disabled={!adjustmentReason}
                                    className="h-9"
                                >
                                    Continue
                                </Button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden sm:block">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 -ml-2">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <DialogTitle>Update Stock</DialogTitle>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                                        <Package className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-sm truncate">{scannedItem.name}</h3>
                                        <p className="text-xs text-muted-foreground">{scannedItem.itemNumber}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-sm">
                                        <MapPin className="h-3.5 w-3.5" />
                                        Location
                                    </Label>
                                    <div className="flex items-center space-x-2 p-2.5 rounded-lg border border-primary bg-primary/5">
                                        <div className="flex-1 min-w-0">
                                            {scannedLocation ? (
                                                <>
                                                    <p className="font-mono font-semibold text-sm">{scannedLocation.code}</p>
                                                    <p className="text-xs text-muted-foreground">{scannedLocation.name}</p>
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-mono font-semibold text-sm">
                                                        {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.code}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.name}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-semibold text-sm">
                                                {scannedItem.locations.find((l) =>
                                                    scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId
                                                )?.quantity || 0}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm">Adjustment</Label>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setQuantity(quantity - 1)}
                                            className="h-12 w-12 shrink-0 text-xl"
                                        >
                                            −
                                        </Button>

                                        <Input
                                            type="text"
                                            value={quantity > 0 ? `+${quantity}` : quantity === 0 ? "0" : `${quantity}`}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/[^0-9-+]/g, "")
                                                const num = Number.parseInt(val) || 0
                                                setQuantity(num)
                                            }}
                                            className="h-12 text-center text-lg font-bold"
                                            autoComplete="off"
                                            autoCorrect="off"
                                            autoCapitalize="off"
                                            spellCheck="false"
                                            inputMode="numeric"
                                        />

                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setQuantity(quantity + 1)}
                                            className="h-12 w-12 shrink-0 text-xl"
                                        >
                                            +
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground text-center">
                                        Current:{" "}
                                        {scannedItem.locations.find((l) =>
                                            scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId
                                        )?.quantity || 0}{" "}
                                        → New:{" "}
                                        {(scannedItem.locations.find((l) =>
                                            scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId
                                        )?.quantity || 0) + quantity}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="newStock" className="text-sm">
                                        New Total
                                    </Label>
                                    <Input
                                        id="newStock"
                                        type="number"
                                        value={
                                            (scannedItem.locations.find((l) =>
                                                scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId
                                            )?.quantity || 0) + quantity
                                        }
                                        onChange={(e) => {
                                            const currentStock =
                                                scannedItem.locations.find((l) =>
                                                    scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId
                                                )?.quantity || 0
                                            const newTotal = Number.parseInt(e.target.value) || 0
                                            setQuantity(newTotal - currentStock)
                                        }}
                                        className="h-10 text-lg font-semibold"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                        inputMode="numeric"
                                    />
                                    {(scannedItem.locations.find((l) =>
                                        scannedLocation ? l.location.code === scannedLocation.code : l.locationId === selectedLocationId
                                    )?.quantity || 0) +
                                        quantity <
                                        0 && (
                                            <Alert variant="destructive" className="py-2">
                                                <AlertCircle className="h-4 w-4" />
                                                <AlertDescription className="text-xs">Cannot be negative</AlertDescription>
                                            </Alert>
                                        )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm">Reason</Label>
                                    <Select value={adjustmentReason} onValueChange={setAdjustmentReason}>
                                        <SelectTrigger className="h-10">
                                            <SelectValue placeholder="Select reason" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="received">Received</SelectItem>
                                            <SelectItem value="sold">Sold</SelectItem>
                                            <SelectItem value="damaged">Damaged</SelectItem>
                                            <SelectItem value="returned">Return</SelectItem>
                                            <SelectItem value="adjustment">Adjustment</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm">Note (Optional)</Label>
                                    <Input
                                        type="text"
                                        placeholder="Add a note..."
                                        value={adjustmentNote}
                                        onChange={(e) => setAdjustmentNote(e.target.value)}
                                        className="h-10"
                                        autoComplete="off"
                                        autoCorrect="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer - Desktop Only */}
                        <div className="hidden sm:flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                            <Button variant="outline" onClick={handleBack} className="flex-1">
                                Back
                            </Button>
                            <Button onClick={() => setScanStep("confirm")} disabled={!adjustmentReason} className="flex-1">
                                Continue
                            </Button>
                        </div>
                    </>
                ) : scanStep === "confirm" ? (
                    <>
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            {/* Mobile Header with Actions */}
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    className="h-9 gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <DialogTitle className="text-base font-semibold flex-1 text-center">
                                    Confirm
                                </DialogTitle>
                                <Button
                                    size="sm"
                                    onClick={handleConfirmAction}
                                    className="h-9"
                                >
                                    Confirm
                                </Button>
                            </div>

                            {/* Desktop Header */}
                            <div className="hidden sm:block">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 -ml-2">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <DialogTitle>Confirm Action</DialogTitle>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="space-y-4">
                                {scanMode === "location" && scannedLocation ? (
                                    <Alert className="border-primary/50 bg-primary/5">
                                        <MapPin className="h-4 w-4" />
                                        <AlertDescription>
                                            <p className="font-semibold text-sm">{scannedLocation.code}</p>
                                            <p className="text-xs text-muted-foreground">{scannedLocation.name}</p>
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <>
                                        {scannedItem && (
                                            <Alert className="border-primary/50 bg-primary/5">
                                                <Package className="h-4 w-4" />
                                                <AlertDescription>
                                                    <p className="font-semibold text-sm">{scannedItem.name}</p>
                                                    <p className="text-xs text-muted-foreground">{scannedItem.itemNumber}</p>
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        {(scannedLocation || selectedLocationId) && scannedItem && (
                                            <Alert>
                                                <MapPin className="h-4 w-4" />
                                                <AlertDescription>
                                                    {scannedLocation ? (
                                                        <>
                                                            <p className="font-semibold text-sm">{scannedLocation.code}</p>
                                                            <p className="text-xs text-muted-foreground">{scannedLocation.name}</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="font-semibold text-sm">
                                                                {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.code}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {scannedItem.locations.find((l) => l.locationId === selectedLocationId)?.location.name}
                                                            </p>
                                                        </>
                                                    )}
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        {(scanMode === "adjust" || scanMode === "inventory-adjustment") && (
                                            <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                                                <div className="flex justify-between">
                                                    <span className="text-sm text-muted-foreground">Adjustment:</span>
                                                    <span className={`font-semibold text-sm ${quantity >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                        {quantity >= 0 ? "+" : ""}
                                                        {quantity} units
                                                    </span>
                                                </div>
                                                {adjustmentReason && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Reason:</span>
                                                        <span className="font-medium text-sm capitalize">{adjustmentReason}</span>
                                                    </div>
                                                )}
                                                {adjustmentNote && (
                                                    <div className="flex justify-between">
                                                        <span className="text-sm text-muted-foreground">Note:</span>
                                                        <span className="font-medium text-sm">{adjustmentNote}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer - Desktop Only */}
                        <div className="hidden sm:flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                            <Button variant="outline" onClick={handleBack} className="flex-1">
                                Back
                            </Button>
                            <Button onClick={handleConfirmAction} className="flex-1">
                                Confirm
                            </Button>
                        </div>
                    </>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}