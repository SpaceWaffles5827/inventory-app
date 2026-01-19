"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Camera, Type } from "lucide-react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface BarcodeScannerDialogProps {
    isOpen: boolean
    onClose: () => void
    currentBarcode: string
    onBarcodeScanned: (barcode: string) => void
}

export function BarcodeScannerDialog({ isOpen, onClose, currentBarcode, onBarcodeScanned }: BarcodeScannerDialogProps) {
    const [isScanning, setIsScanning] = useState(false)
    const [cameraError, setCameraError] = useState("")
    const [verificationCount, setVerificationCount] = useState(0)
    const [verificationCode, setVerificationCode] = useState<string | null>(null)
    const [manualBarcode, setManualBarcode] = useState("")
    const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan")
    const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
    const scannerElementId = "barcode-reader"
    const initAttemptRef = useRef(0)
    const verificationCodeRef = useRef<string | null>(null)
    const verificationCountRef = useRef(0)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const startScanner = async () => {
        console.log("[BARCODE] Starting scanner (attempt", initAttemptRef.current + 1, ")...")
        initAttemptRef.current++

        try {
            const element = document.getElementById(scannerElementId)
            if (!element) {
                console.error("[BARCODE] Scanner element not found, retrying...")
                if (initAttemptRef.current < 5) {
                    setTimeout(startScanner, 300)
                } else {
                    setCameraError("Failed to initialize scanner. Please try again.")
                }
                return
            }

            html5QrcodeRef.current = new Html5Qrcode(scannerElementId)

            const config = {
                fps: 5,
                qrbox: { width: 300, height: 300 },
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

            console.log("[BARCODE] Getting cameras...")

            let cameras
            try {
                cameras = await Html5Qrcode.getCameras()
            } catch (err: any) {
                console.error("[BARCODE] Camera access error:", err)
                setCameraError("Camera access denied. Please allow camera permissions in your browser settings.")
                return
            }

            console.log("[BARCODE] Available cameras:", cameras.length)

            if (cameras.length === 0) {
                setCameraError("No cameras found. Please check your device permissions.")
                return
            }

            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
            let cameraConfig: any

            if (isMobile) {
                console.log("[BARCODE] Mobile device detected, using facingMode")
                cameraConfig = { facingMode: "environment" }
            } else {
                let cameraId = cameras[0].id
                const rearCamera = cameras.find(camera =>
                    camera.label.toLowerCase().includes('back') ||
                    camera.label.toLowerCase().includes('rear') ||
                    camera.label.toLowerCase().includes('environment')
                )

                if (rearCamera) {
                    cameraId = rearCamera.id
                    console.log("[BARCODE] Using rear camera:", rearCamera.label)
                } else {
                    console.log("[BARCODE] Using camera:", cameras[0].label)
                }
                cameraConfig = cameraId
            }

            console.log("[BARCODE] Starting camera with config:", cameraConfig)

            await html5QrcodeRef.current.start(
                cameraConfig,
                config,
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

                            verificationCodeRef.current = null
                            verificationCountRef.current = 0
                            setVerificationCode(null)
                            setVerificationCount(0)
                            setIsScanning(false)

                            if (html5QrcodeRef.current) {
                                html5QrcodeRef.current.pause(true)
                            }

                            // Auto-save and close
                            onBarcodeScanned(decodedText)
                            stopScanner()
                            handleClose()
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

        } catch (err: any) {
            console.error("[BARCODE] Failed to start:", err)

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
        console.log("[BARCODE] Stopping scanner...")

        if (html5QrcodeRef.current) {
            try {
                const state = html5QrcodeRef.current.getState()
                console.log("[BARCODE] Scanner state:", state)

                // State 2 = SCANNING, State 3 = PAUSED
                if (state === 2 || state === 3) {
                    await html5QrcodeRef.current.stop()
                    console.log("[BARCODE] Camera stopped")
                }

                // Small delay to ensure stop completes before clear
                await new Promise(resolve => setTimeout(resolve, 100))

                // Now safe to clear
                await html5QrcodeRef.current.clear()
                console.log("[BARCODE] Scanner cleared")
            } catch (err) {
                console.error("[BARCODE] Error stopping:", err)
                // Force cleanup even if there's an error
                try {
                    await html5QrcodeRef.current.clear()
                } catch (clearErr) {
                    console.error("[BARCODE] Error clearing:", clearErr)
                }
            }
            html5QrcodeRef.current = null
        }

        setIsScanning(false)
    }

    const handleOpen = () => {
        setVerificationCode(null)
        setVerificationCount(0)
        setCameraError("")
        setManualBarcode(currentBarcode || "")
        verificationCodeRef.current = null
        verificationCountRef.current = 0
        initAttemptRef.current = 0

        // Only start scanner if on scan tab
        if (activeTab === "scan") {
            setTimeout(() => {
                startScanner()
            }, 500)
        }
    }

    const handleClose = () => {
        stopScanner()
        setActiveTab("scan")
        setManualBarcode("")
        onClose()
    }

    const handleSaveManual = () => {
        if (manualBarcode.trim()) {
            onBarcodeScanned(manualBarcode.trim())
            handleClose()
        }
    }

    const handleTabChange = (value: string) => {
        const newTab = value as "scan" | "manual"
        setActiveTab(newTab)

        if (newTab === "scan" && !isScanning && !cameraError) {
            setTimeout(() => {
                startScanner()
            }, 300)
        } else if (newTab === "manual") {
            stopScanner()
        }
    }

    useEffect(() => {
        if (isOpen) {
            handleOpen()
        }
    }, [isOpen])

    useEffect(() => {
        return () => {
            stopScanner()
        }
    }, [])

    const isManualValid = manualBarcode.trim().length > 0

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                enableKeyboardAvoidance={true}
                hideClose={true}
                className="max-w-4xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
            >
                {/* Header */}
                <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                    {/* Mobile Header with Actions */}
                    <div className="flex items-center justify-between gap-2 sm:hidden">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClose}
                            className="h-9"
                        >
                            Cancel
                        </Button>
                        <DialogTitle className="text-base font-semibold">
                            {activeTab === "scan" ? "Scan Barcode" : "Enter Barcode"}
                        </DialogTitle>
                        {activeTab === "manual" && (
                            <Button
                                size="sm"
                                onClick={handleSaveManual}
                                disabled={!isManualValid}
                                className="h-9"
                            >
                                Save
                            </Button>
                        )}
                        {activeTab === "scan" && (
                            <div className="w-16" /> // Spacer for alignment
                        )}
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden sm:block">
                        <DialogTitle>Barcode Scanner</DialogTitle>
                        <DialogDescription className="mt-1.5">
                            Scan a barcode using your camera or enter it manually
                        </DialogDescription>
                    </div>
                </DialogHeader>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 border-b sm:border-0 bg-card sm:bg-transparent">
                        <TabsList className="w-full grid grid-cols-2 h-12 p-0 bg-transparent rounded-none">
                            <TabsTrigger
                                value="scan"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-sm font-medium gap-2"
                            >
                                <Camera className="h-4 w-4" />
                                Scan
                            </TabsTrigger>
                            <TabsTrigger
                                value="manual"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-sm font-medium gap-2"
                            >
                                <Type className="h-4 w-4" />
                                Manual
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* Scan Tab */}
                    <TabsContent
                        value="scan"
                        className="flex-1 flex flex-col overflow-y-auto overscroll-contain m-0"
                        ref={scrollContainerRef}
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="p-4 space-y-4 flex-1 flex flex-col">
                            {/* Camera Scanner */}
                            <div className="relative flex-1 min-h-[400px] sm:min-h-[500px] bg-muted rounded-lg overflow-hidden">
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

                            {/* Verification Progress */}
                            {verificationCount > 0 && !cameraError && (
                                <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                                                Verifying barcode...
                                            </p>
                                            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5 font-mono">
                                                {verificationCode}
                                            </p>
                                        </div>
                                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                            {verificationCount}/5
                                        </div>
                                    </div>
                                    <div className="mt-2 w-full bg-green-200 dark:bg-green-900 rounded-full h-2">
                                        <div
                                            className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(verificationCount / 5) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Instructions */}
                            {!cameraError && !verificationCount && (
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-sm text-muted-foreground text-center">
                                        Position the barcode within the frame. The scanner will verify it 5 times for accuracy.
                                    </p>
                                </div>
                            )}

                            {/* Retry Button for Camera Error */}
                            {cameraError && (
                                <Button
                                    onClick={() => {
                                        setCameraError("")
                                        initAttemptRef.current = 0
                                        setTimeout(startScanner, 300)
                                    }}
                                    className="w-full"
                                    variant="outline"
                                >
                                    Try Again
                                </Button>
                            )}
                        </div>
                    </TabsContent>

                    {/* Manual Tab */}
                    <TabsContent
                        value="manual"
                        className="flex-1 overflow-y-auto overscroll-contain m-0"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="manual-barcode">
                                    Barcode Number
                                </Label>
                                <Input
                                    id="manual-barcode"
                                    placeholder="Enter barcode number"
                                    value={manualBarcode}
                                    onChange={(e) => setManualBarcode(e.target.value)}
                                    autoComplete="off"
                                    autoCorrect="off"
                                    autoCapitalize="off"
                                    spellCheck="false"
                                    className="font-mono"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter the barcode number manually if scanning isn't working
                                </p>
                            </div>

                            {currentBarcode && (
                                <div className="p-3 bg-muted/50 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-1">Current barcode:</p>
                                    <p className="text-sm font-mono font-medium">{currentBarcode}</p>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>

                {/* Footer - Desktop Only */}
                <DialogFooter className="hidden sm:flex px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                    <Button
                        variant="outline"
                        onClick={handleClose}
                    >
                        Cancel
                    </Button>
                    {activeTab === "manual" && (
                        <Button
                            onClick={handleSaveManual}
                            disabled={!isManualValid}
                        >
                            Save Barcode
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}