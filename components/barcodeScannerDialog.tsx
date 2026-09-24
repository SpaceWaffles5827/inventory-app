"use client"

import { useEffect, useRef, useState } from "react"
import { ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CameraScanner, type ScanFlash } from "@/components/scanner/camera-scanner"
import { ManualCodeEntry } from "@/components/scanner/manual-code-entry"
import { focusDialogOnTouch, useFinePointer } from "@/components/scanner/pointer"
import { useKeyboardWedge } from "@/components/scanner/use-keyboard-wedge"

interface BarcodeScannerDialogProps {
  isOpen: boolean
  onClose: () => void
  /** Shown for reference while scanning a replacement */
  currentBarcode?: string | null
  onBarcodeScanned: (barcode: string) => void
  title?: string
  description?: string
}

/** Capture a single barcode value (camera, handheld scanner or typed) — e.g. to fill a form field */
export function BarcodeScannerDialog({
  isOpen,
  onClose,
  currentBarcode,
  onBarcodeScanned,
  title = "Scan barcode",
  description = "Point the camera at the barcode, or type it / use a handheld scanner.",
}: BarcodeScannerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg" data-testid="barcode-scanner-dialog" onOpenAutoFocus={focusDialogOnTouch}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5 text-primary" aria-hidden />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* DialogContent unmounts this while closed, so the camera only runs while the dialog is open */}
        <BarcodeCapture
          currentBarcode={currentBarcode}
          onCapture={(code) => {
            onBarcodeScanned(code)
            onClose()
          }}
        />
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BarcodeCapture({
  currentBarcode,
  onCapture,
}: {
  currentBarcode?: string | null
  onCapture: (code: string) => void
}) {
  const finePointer = useFinePointer()
  const [flash, setFlash] = useState<ScanFlash>(null)
  const capturedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    []
  )

  const capture = (code: string, fromCamera: boolean) => {
    if (capturedRef.current) return
    capturedRef.current = true
    if (!fromCamera) {
      onCapture(code)
      return
    }
    // Let the success check show for a moment before closing
    setFlash("success")
    timerRef.current = setTimeout(() => onCapture(code), 350)
  }

  useKeyboardWedge({ enabled: true, onScan: (code) => capture(code, false) })

  return (
    <div className="min-w-0 space-y-3">
      <CameraScanner active onDetected={(code) => capture(code, true)} paused={flash !== null} flash={flash} />
      <ManualCodeEntry
        onSubmit={(code) => capture(code, false)}
        submitLabel="Use code"
        autoFocus={finePointer}
        inputTestId="barcode-scanner-manual-input"
        submitTestId="barcode-scanner-manual-submit"
      />
      {currentBarcode && (
        <p className="text-xs text-muted-foreground">
          Current barcode: <span className="break-all font-mono text-foreground">{currentBarcode}</span>
        </p>
      )}
    </div>
  )
}
