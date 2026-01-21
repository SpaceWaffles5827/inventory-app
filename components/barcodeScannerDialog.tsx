"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { BrowserMultiFormatReader } from "@zxing/browser"
import { DecodeHintType, BarcodeFormat } from "@zxing/library"

interface BarcodeScannerDialogProps {
    isOpen: boolean
    onClose: () => void
    currentBarcode: string
    onBarcodeScanned: (barcode: string) => void
}

export function BarcodeScannerDialog({
    isOpen,
    onClose,
    currentBarcode,
    onBarcodeScanned,
}: BarcodeScannerDialogProps) {
    const [cameraError, setCameraError] = useState("")
    const [scanSuccess, setScanSuccess] = useState(false)
    const [scanningActive, setScanningActive] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
    const lastScanTimeRef = useRef<number>(0)
    const scanCooldownMs = 300 // Reduced from 500ms for faster consecutive scans
    const initAttemptRef = useRef(0)
    const isProcessingRef = useRef(false)

    // Prevent body scroll when dialog is open on mobile
    useEffect(() => {
        if (isOpen) {
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
    }, [isOpen])

    useEffect(() => {
        if (isOpen) {
            // Fully reset all state when dialog opens
            setScanSuccess(false)
            setCameraError("")
            setScanningActive(false)
            initAttemptRef.current = 0
            isProcessingRef.current = false
            lastScanTimeRef.current = 0

            // Small delay to ensure clean state
            setTimeout(() => {
                startScanner()
            }, 100)
        } else {
            stopScanner()
        }

        return () => stopScanner()
    }, [isOpen])

    const startScanner = useCallback(async () => {
        console.log("[SCANNER] Starting (attempt", initAttemptRef.current + 1, ")...")

        try {
            if (!videoRef.current) {
                console.log("[SCANNER] Video element not ready, retrying...")
                initAttemptRef.current++

                if (initAttemptRef.current < 10) {
                    setTimeout(startScanner, 150)
                } else {
                    setCameraError("Scanner initialization failed. Please try again.")
                    initAttemptRef.current = 0
                }
                return
            }

            initAttemptRef.current = 0

            // Optimized hints for faster scanning
            const hints = new Map()

            // Prioritize common formats for faster detection
            const formats = [
                BarcodeFormat.EAN_13,
                BarcodeFormat.EAN_8,
                BarcodeFormat.UPC_A,
                BarcodeFormat.UPC_E,
                BarcodeFormat.CODE_128,
                BarcodeFormat.CODE_39,
                BarcodeFormat.QR_CODE,
                BarcodeFormat.DATA_MATRIX,
                BarcodeFormat.CODE_93,
                BarcodeFormat.ITF,
                BarcodeFormat.CODABAR,
                BarcodeFormat.AZTEC,
                BarcodeFormat.PDF_417,
            ]

            hints.set(DecodeHintType.POSSIBLE_FORMATS, formats)
            hints.set(DecodeHintType.TRY_HARDER, true)
            // Enable character set detection for better accuracy
            hints.set(DecodeHintType.CHARACTER_SET, "UTF-8")

            console.log("[SCANNER] Getting video devices...")
            const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices()

            console.log("[SCANNER] Creating reader...")
            codeReaderRef.current = new BrowserMultiFormatReader(hints)

            console.log("[SCANNER] Available cameras:", videoInputDevices.length)

            if (videoInputDevices.length === 0) {
                setCameraError("No cameras found. Please check your device permissions.")
                return
            }

            // Smart camera selection
            let selectedDeviceId = videoInputDevices[0].deviceId
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

            if (isMobile || videoInputDevices.length > 1) {
                const backCamera = videoInputDevices.find(device =>
                    device.label.toLowerCase().includes('back') ||
                    device.label.toLowerCase().includes('rear') ||
                    device.label.toLowerCase().includes('environment') ||
                    device.label.toLowerCase().includes('traseira')
                )

                if (backCamera) {
                    selectedDeviceId = backCamera.deviceId
                    console.log("[SCANNER] Using back camera:", backCamera.label)
                } else {
                    console.log("[SCANNER] Using camera:", videoInputDevices[0].label)
                }
            }

            console.log("[SCANNER] Starting decode...")

            // Start continuous decode with optimized callback
            await codeReaderRef.current.decodeFromVideoDevice(
                selectedDeviceId,
                videoRef.current,
                (result, error) => {
                    if (result) {
                        // Prevent concurrent processing
                        if (isProcessingRef.current) {
                            return
                        }

                        const now = Date.now()
                        const decodedText = result.getText()

                        console.log(`[SCANNER] 📷 Detected: "${decodedText}"`)
                        console.log(`[SCANNER] Format: ${result.getBarcodeFormat()}`)

                        // Cooldown check
                        if (now - lastScanTimeRef.current < scanCooldownMs) {
                            return
                        }

                        // Validation
                        const trimmedText = decodedText.trim()
                        if (trimmedText.length < 1 || trimmedText.length > 200) {
                            console.log("[SCANNER] ⚠️ Invalid length:", trimmedText.length)
                            return
                        }

                        // Mark as processing
                        isProcessingRef.current = true
                        lastScanTimeRef.current = now

                        console.log("[SCANNER] ✅ Scan successful")

                        // Show success feedback
                        setScanSuccess(true)
                        setScanningActive(false)

                        // Haptic feedback on mobile
                        if ('vibrate' in navigator) {
                            navigator.vibrate(50)
                        }

                        // Stop scanner and process result
                        stopScanner()

                        // Small delay for visual feedback before closing
                        setTimeout(() => {
                            onBarcodeScanned(trimmedText)
                            onClose()
                        }, 400)
                    }

                    // Silently ignore scanning errors (normal when no barcode in view)
                }
            )

            setScanningActive(true)
            console.log("[SCANNER] ✅ Scanner started")

        } catch (err: any) {
            console.error("[SCANNER] Failed to start:", err)

            let errorMsg = "Failed to start camera. "

            if (err.name === "NotAllowedError" || err.message?.includes("Permission")) {
                errorMsg = "Camera access denied. Please allow camera permissions in your browser settings."
            } else if (err.name === "NotFoundError") {
                errorMsg = "No camera found on this device."
            } else if (err.name === "NotReadableError") {
                errorMsg = "Camera is being used by another app. Please close other apps and try again."
            } else if (err.name === "OverconstrainedError") {
                errorMsg = "Camera constraints not supported. Trying alternative configuration..."
                // Retry with less restrictive config
                setCameraError("")
                setTimeout(startScanner, 500)
                return
            } else {
                errorMsg += err.message || "Unknown error."
            }

            setCameraError(errorMsg)
            setScanningActive(false)
        }
    }, [onBarcodeScanned, onClose])

    const stopScanner = useCallback(() => {
        console.log("[SCANNER] Stopping scanner...")

        if (codeReaderRef.current) {
            try {
                codeReaderRef.current.reset()
                console.log("[SCANNER] Scanner stopped")
            } catch (err) {
                console.error("[SCANNER] Error stopping:", err)
            }
            codeReaderRef.current = null
        }

        // Completely reset all state
        lastScanTimeRef.current = 0
        initAttemptRef.current = 0
        isProcessingRef.current = false
        setScanningActive(false)
        setScanSuccess(false)
    }, [])

    const handleClose = useCallback(() => {
        console.log("[SCANNER] Closing dialog and cleaning up...")
        stopScanner()

        // Reset all state
        setCameraError("")
        setScanSuccess(false)
        setScanningActive(false)

        onClose()
    }, [stopScanner, onClose])

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
            {!cameraError && scanningActive && (
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
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent
                enableKeyboardAvoidance={true}
                hideClose={true}
                className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 sm:p-6 gap-0"
            >
                {/* Header */}
                <DialogHeader className="px-4 pt-3 pb-3 sm:px-0 sm:pt-0 sm:pb-0 space-y-0 sm:space-y-1.5 flex-shrink-0 border-b sm:border-0">
                    {/* Mobile Header */}
                    <div className="flex items-center justify-between gap-2 sm:hidden relative">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClose}
                            disabled={scanSuccess}
                            className="h-9"
                        >
                            Cancel
                        </Button>
                        <DialogTitle className="text-base font-semibold absolute left-1/2 -translate-x-1/2">
                            Scan Barcode
                        </DialogTitle>
                        <div className="w-16"></div>
                    </div>

                    {/* Desktop Header */}
                    <div className="hidden sm:block">
                        <DialogTitle>Scan Barcode</DialogTitle>
                    </div>
                </DialogHeader>

                {/* Content */}
                <div
                    className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-0"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                >
                    {cameraError ? (
                        <div className="space-y-4">
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription className="text-sm">{cameraError}</AlertDescription>
                            </Alert>
                            <Button
                                onClick={() => {
                                    setCameraError("")
                                    initAttemptRef.current = 0
                                    setTimeout(startScanner, 300)
                                }}
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
                        </div>
                    )}
                </div>

                {/* Footer - Desktop Only */}
                {!cameraError && !scanSuccess && (
                    <div className="hidden sm:flex gap-2 px-4 pb-4 sm:px-0 sm:pb-0 flex-shrink-0 border-t sm:border-0 pt-4 sm:pt-0 bg-background">
                        <Button
                            onClick={handleClose}
                            variant="outline"
                            className="w-full"
                        >
                            Cancel
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}