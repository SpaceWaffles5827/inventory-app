"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode"

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
    const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
    const scannerElementId = "barcode-reader"
    const initAttemptRef = useRef(0)
    const verificationCodeRef = useRef<string | null>(null)
    const verificationCountRef = useRef(0)

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
                            onClose()
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
        verificationCodeRef.current = null
        verificationCountRef.current = 0
        initAttemptRef.current = 0
        setTimeout(() => {
            startScanner()
        }, 500)
    }

    const handleClose = () => {
        stopScanner()
        onClose()
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

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
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
                    <Button variant="outline" onClick={handleClose} className="w-full">
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}