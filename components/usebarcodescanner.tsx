import { useState, useRef, useCallback, useEffect } from "react"
import { BrowserMultiFormatReader } from "@zxing/browser"
import { DecodeHintType, BarcodeFormat } from "@zxing/library"

interface UseBarccodeScannerOptions {
    onScanSuccess: (barcode: string) => void
    enabled: boolean
    scanCooldownMs?: number
}

export function useBarcodeScanner({
    onScanSuccess,
    enabled,
    scanCooldownMs = 300
}: UseBarccodeScannerOptions) {
    const [cameraError, setCameraError] = useState("")
    const [scanSuccess, setScanSuccess] = useState(false)
    const [scanningActive, setScanningActive] = useState(false)

    const videoRef = useRef<HTMLVideoElement>(null)
    const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
    const lastScanTimeRef = useRef<number>(0)
    const initAttemptRef = useRef(0)
    const isProcessingRef = useRef(false)

    const stopScanner = useCallback(() => {
        console.log("[SCANNER] Stopping scanner...")

        if (codeReaderRef.current) {
            try {
                // Stop the continuous decode and reset the reader
                codeReaderRef.current.stopContinuousDecode()

                // Stop all video tracks to turn off the camera
                if (videoRef.current && videoRef.current.srcObject) {
                    const stream = videoRef.current.srcObject as MediaStream
                    stream.getTracks().forEach(track => track.stop())
                    videoRef.current.srcObject = null
                }

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

    const playBeepSound = useCallback(() => {
        try {
            // Create audio context
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

            // Create oscillator (beep generator)
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            // Configure beep sound (classic scanner beep)
            oscillator.frequency.value = 2800 // Hz - high pitched beep
            oscillator.type = 'square' // Square wave for that classic scanner sound

            // Configure volume envelope (quick fade out)
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)

            // Connect nodes
            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            // Play beep for 100ms
            oscillator.start(audioContext.currentTime)
            oscillator.stop(audioContext.currentTime + 0.1)

            console.log("[SCANNER] 🔊 Beep sound played")
        } catch (err) {
            console.warn("[SCANNER] Could not play beep sound:", err)
        }
    }, [])

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

                        // Play beep sound
                        playBeepSound()

                        // Haptic feedback on mobile
                        if ('vibrate' in navigator) {
                            navigator.vibrate(50)
                        }

                        // Call the success handler
                        onScanSuccess(trimmedText)
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
                setCameraError("")
                setTimeout(startScanner, 500)
                return
            } else {
                errorMsg += err.message || "Unknown error."
            }

            setCameraError(errorMsg)
            setScanningActive(false)
        }
    }, [onScanSuccess, scanCooldownMs, playBeepSound])

    const retryScanner = useCallback(() => {
        setCameraError("")
        initAttemptRef.current = 0
        setTimeout(startScanner, 300)
    }, [startScanner])

    const resetScanSuccess = useCallback(() => {
        isProcessingRef.current = false
        setScanSuccess(false)
    }, [])

    const pauseScanning = useCallback(() => {
        console.log("[SCANNER] Pausing scanning (keeping camera on)...")
        isProcessingRef.current = true // Prevent new scans
        setScanningActive(false)
    }, [])

    const resumeScanning = useCallback(() => {
        console.log("[SCANNER] Resuming scanning...")
        isProcessingRef.current = false
        lastScanTimeRef.current = Date.now() // Reset cooldown
        setScanningActive(true)
        setScanSuccess(false)
    }, [])

    // Auto start/stop based on enabled flag
    useEffect(() => {
        if (enabled) {
            // Fully reset all state when enabled
            setScanSuccess(false)
            setCameraError("")
            setScanningActive(false)
            initAttemptRef.current = 0
            isProcessingRef.current = false
            lastScanTimeRef.current = 0

            // Small delay to ensure clean state
            const timeoutId = setTimeout(() => {
                startScanner()
            }, 100)

            return () => {
                clearTimeout(timeoutId)
                stopScanner()
            }
        } else {
            stopScanner()
        }
    }, [enabled])

    return {
        videoRef,
        cameraError,
        scanSuccess,
        scanningActive,
        retryScanner,
        resetScanSuccess,
        pauseScanning,
        resumeScanning,
        stopScanner,
    }
}