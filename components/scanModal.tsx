"use client"

import { useState, useEffect } from "react"
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
    CheckCircle2,
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { useBarcodeScanner } from "@/components/usebarcodescanner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
    const [error, setError] = useState("")
    const [notFoundError, setNotFoundError] = useState("")

    // Workflow states
    const [scanMode, setScanMode] = useState<string | null>(null)
    const [scanStep, setScanStep] = useState<ScanStep>("select")
    const [scannedItem, setScannedItem] = useState<ItemWithRelations | null>(null)
    const [scannedLocation, setScannedLocation] = useState<any | null>(null)
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
    const [quantity, setQuantity] = useState<number>(1)
    const [adjustmentReason, setAdjustmentReason] = useState("")
    const [adjustmentNote, setAdjustmentNote] = useState("")

    const {
        videoRef,
        cameraError,
        scanSuccess,
        scanningActive,
        retryScanner,
        resetScanSuccess,
        pauseScanning,
        resumeScanning,
    } = useBarcodeScanner({
        onScanSuccess: (scannedCode) => {
            handleVerifiedScan(scannedCode, scanStep, scanMode)
        },
        enabled: open && (scanStep === "scanItem" || scanStep === "scanLocation"),
        scanCooldownMs: 300,
    })

    // Prevent body scroll when dialog is open on mobile
    useEffect(() => {
        if (open) {
            const originalOverflow = document.body.style.overflow
            const originalPosition = document.body.style.position
            const originalWidth = document.body.style.width

            document.body.style.overflow = 'hidden'
            document.body.style.position = 'fixed'
            document.body.style.width = '100%'

            return () => {
                document.body.style.overflow = originalOverflow
                document.body.style.position = originalPosition
                document.body.style.width = originalWidth
            }
        }
    }, [open])

    // Define handleVerifiedScan without useCallback to avoid circular dependency
    const handleVerifiedScan = async (scannedCode: string, currentScanStep: ScanStep, currentScanMode: string | null) => {
        console.log("[SCANNER] Processing verified scan:", scannedCode)
        console.log("[SCANNER] Current scan step:", currentScanStep)
        console.log("[SCANNER] Current scan mode:", currentScanMode)

        if (!scannedCode) return

        if (currentScanStep === "scanItem") {
            const item = findItemByBarcode(scannedCode, allItems)

            if (!item) {
                console.log("[SCANNER] ❌ Item not found")
                pauseScanning()
                setNotFoundError(`Item not found: ${scannedCode}`)
                setTimeout(() => {
                    setNotFoundError("")
                    resumeScanning()
                }, 2000)
                return
            }

            console.log("[SCANNER] ✅ Item found:", item.name)

            setScannedItem(item)

            if (currentScanMode === "lookup") {
                console.log("[SCANNER] Navigating to item detail page")
                // Small delay for visual feedback before closing
                setTimeout(() => {
                    onOpenChange(false)
                    router.push(`/dashboard/items/${item.id}`)
                }, 400)
                return
            } else if (currentScanMode === "edit") {
                console.log("[SCANNER] Navigating to edit item page")
                setTimeout(() => {
                    onOpenChange(false)
                    router.push(`/dashboard/items/${item.id}`)
                }, 400)
                return
            } else if (currentScanMode === "adjust" || currentScanMode === "move" || currentScanMode === "inventory-adjustment") {
                console.log("[SCANNER] Moving to location scan step")
                setTimeout(() => {
                    setScanStep("scanLocation")
                }, 400)
                return
            }
        } else if (currentScanStep === "scanLocation") {
            console.log("[SCANNER] Processing location scan:", scannedCode)

            // Look up the location by code/barcode
            const location = await findLocationByCode(scannedCode)

            if (!location) {
                console.log("[SCANNER] ❌ Location not found")
                pauseScanning()
                setNotFoundError(`Location not found: ${scannedCode}`)
                setTimeout(() => {
                    setNotFoundError("")
                    resumeScanning()
                }, 2000)
                return
            }

            console.log("[SCANNER] ✅ Location found:", location.code)

            setScannedLocation(location)

            if (currentScanMode === "location") {
                console.log("[SCANNER] Navigating to location detail page")
                setTimeout(() => {
                    onOpenChange(false)
                    router.push(`/dashboard/locations/${location.id}`)
                }, 400)
                return
            } else if (currentScanMode === "adjust" || currentScanMode === "move" || currentScanMode === "inventory-adjustment") {
                console.log("[SCANNER] Moving to adjustment details")
                setTimeout(() => {
                    setScanStep("adjustmentDetails")
                }, 400)
                return
            }
        }
    }

    const findItemByBarcode = (scannedCode: string, items: ItemWithRelations[]): ItemWithRelations | null => {
        const scanned = scannedCode.trim()

        console.log("[SCANNER] Searching for barcode:", scanned)
        console.log("[SCANNER] Available items:", items.length)

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

    const findLocationByCode = async (scannedCode: string): Promise<any | null> => {
        try {
            console.log("[SCANNER] Searching for location with code:", scannedCode)

            // Fetch all locations to search through them
            const response = await fetch(`/api/locations?workspaceId=${encodeURIComponent(currentWorkspaceId)}`, {
                method: "GET",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
            })

            if (!response.ok) {
                console.error("[SCANNER] Failed to fetch locations")
                return null
            }

            const result = await response.json()
            const locations = result.data?.locations || []

            console.log("[SCANNER] Available locations:", locations.length)

            // Try to find location by barcode or code
            const location = locations.find((loc: any) =>
                loc.barcode?.trim().toLowerCase() === scannedCode.trim().toLowerCase() ||
                loc.code?.trim().toLowerCase() === scannedCode.trim().toLowerCase()
            )

            if (location) {
                console.log("[SCANNER] ✅ Found location:", location.code)
                return location
            }

            console.log("[SCANNER] ❌ No location found with code/barcode:", scannedCode)
            return null
        } catch (error) {
            console.error("[SCANNER] Error fetching locations:", error)
            return null
        }
    }

    const handleCloseModal = () => {
        console.log("[SCANNER] Closing modal and cleaning up...")

        setNotFoundError("")
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

    // Component for the scanning guide overlay
    const ScanningGuide = () => (
        <div className="absolute inset-0 pointer-events-none">
            {/* Horizontal scanning line with animation */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-full px-8">
                    <div className="relative h-0.5 bg-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.8)]">
                        <div
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-red-300 to-transparent"
                            style={{
                                animation: 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Corner brackets with subtle glow */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative" style={{ width: '85%', height: '65%' }}>
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-[3px] border-l-[3px] border-white/95 rounded-tl-lg shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-[3px] border-r-[3px] border-white/95 rounded-tr-lg shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[3px] border-l-[3px] border-white/95 rounded-bl-lg shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[3px] border-r-[3px] border-white/95 rounded-br-lg shadow-[0_0_10px_rgba(255,255,255,0.3)]" />
                </div>
            </div>

            {/* Instruction text */}
            {!cameraError && !notFoundError && scanningActive && (
                <div className="absolute bottom-6 left-0 right-0 flex justify-center px-4">
                    <div className="bg-black/80 text-white text-xs sm:text-sm px-4 py-2.5 rounded-full backdrop-blur-sm shadow-lg border border-white/10">
                        <span className="inline-flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            Align barcode with red line
                        </span>
                    </div>
                </div>
            )}

            {/* Success overlay */}
            {scanSuccess && (
                <div className="absolute inset-0 bg-green-500/20 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white dark:bg-gray-800 rounded-full p-4 shadow-2xl">
                        <CheckCircle2 className="w-16 h-16 text-green-500 animate-in zoom-in duration-300" />
                    </div>
                </div>
            )}
        </div>
    )

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

                        <div className="hidden sm:flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                            <Button variant="outline" onClick={handleCloseModal} className="flex-1">
                                Cancel
                            </Button>
                        </div>
                    </>
                ) : scanStep === "scanItem" || scanStep === "scanLocation" ? (
                    <>
                        <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                            <div className="flex items-center justify-between gap-2 sm:hidden">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleBack}
                                    disabled={scanSuccess}
                                    className="h-9 gap-1"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <DialogTitle className="text-base font-semibold flex-1 text-center">
                                    {scanStep === "scanItem"
                                        ? scanModes.find((m) => m.id === scanMode)?.title
                                        : (scanMode === "location" ? "View Location" : "Scan Location")}
                                </DialogTitle>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCloseModal}
                                    disabled={scanSuccess}
                                    className="h-9"
                                >
                                    Cancel
                                </Button>
                            </div>

                            <div className="hidden sm:block">
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8 -ml-2">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <div>
                                        <DialogTitle>
                                            {scanStep === "scanItem"
                                                ? scanModes.find((m) => m.id === scanMode)?.title
                                                : (scanMode === "location" ? "View Location" : "Scan Location")}
                                        </DialogTitle>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                            style={{ WebkitOverflowScrolling: 'touch' }}
                        >
                            {cameraError && !scanningActive ? (
                                <div className="space-y-3">
                                    <Alert variant="destructive">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                                    </Alert>
                                    <Button
                                        onClick={retryScanner}
                                        className="w-full"
                                    >
                                        Try Again
                                    </Button>
                                </div>
                            ) : (
                                <div className="relative bg-black rounded-lg overflow-hidden">
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full"
                                        style={{
                                            maxHeight: '70vh',
                                            minHeight: '300px',
                                            objectFit: 'cover',
                                        }}
                                    />
                                    <ScanningGuide />

                                    {/* Not Found Error Overlay */}
                                    {notFoundError && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                                            <div className="bg-destructive/90 text-destructive-foreground rounded-lg p-4 max-w-sm w-full shadow-2xl border-2 border-destructive animate-in fade-in zoom-in duration-200">
                                                <div className="flex items-start gap-3">
                                                    <div className="flex-shrink-0">
                                                        <div className="h-10 w-10 rounded-full bg-destructive-foreground/20 flex items-center justify-center">
                                                            <AlertCircle className="h-6 w-6" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-semibold text-sm mb-1">Not Found</h3>
                                                        <p className="text-sm opacity-90">{notFoundError}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {!cameraError && !scanSuccess && (
                            <div className="flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                                <Button variant="outline" onClick={handleBack} className="flex-1 sm:flex-none">
                                    Back
                                </Button>
                                {scanStep === "scanLocation" && scannedItem && (
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