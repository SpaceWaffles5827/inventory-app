"use client"

import { useCallback, useState } from "react"
import { useCameraScanner } from "@/components/scanner/use-camera-scanner"

export interface UseBarcodeScannerOptions {
  onScanSuccess: (barcode: string) => void
  enabled: boolean
  /** Minimum time before the same code is accepted again */
  scanCooldownMs?: number
}

/**
 * @deprecated Kept for backwards compatibility — use `<CameraScanner>` or `useCameraScanner`
 * from `components/scanner`. This wraps the shared scanner and keeps the old return shape:
 * after a successful read, further reads are ignored until `resetScanSuccess()` / `resumeScanning()`.
 */
export function useBarcodeScanner({ onScanSuccess, enabled, scanCooldownMs = 300 }: UseBarcodeScannerOptions) {
  const [paused, setPaused] = useState(false)
  const [scanSuccess, setScanSuccess] = useState(false)
  const [stopped, setStopped] = useState(false)

  const scanner = useCameraScanner({
    enabled: enabled && !stopped,
    paused: paused || scanSuccess,
    dedupeMs: Math.max(scanCooldownMs, 300),
    onDetected: (code) => {
      setScanSuccess(true)
      onScanSuccess(code)
    },
  })

  const { retry, resetDedupe } = scanner

  const retryScanner = useCallback(() => {
    setStopped(false)
    retry()
  }, [retry])

  const resetScanSuccess = useCallback(() => setScanSuccess(false), [])
  const pauseScanning = useCallback(() => setPaused(true), [])
  const resumeScanning = useCallback(() => {
    setPaused(false)
    setScanSuccess(false)
    resetDedupe()
  }, [resetDedupe])
  const stopScanner = useCallback(() => setStopped(true), [])

  return {
    videoRef: scanner.videoRef,
    cameraError: scanner.error?.message ?? "",
    scanSuccess,
    scanningActive: scanner.status === "scanning" && !paused && !scanSuccess,
    retryScanner,
    resetScanSuccess,
    pauseScanning,
    resumeScanning,
    stopScanner,
  }
}
