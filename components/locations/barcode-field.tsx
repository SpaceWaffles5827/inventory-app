"use client"

import { useState } from "react"
import { ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BarcodeScannerDialog } from "@/components/barcodeScannerDialog"

interface BarcodeFieldProps {
  id: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: React.ReactNode
  disabled?: boolean
  placeholder?: string
  "data-testid"?: string
}

/** Optional barcode input with a camera scan button (for re-using pre-printed labels) */
export function BarcodeField({
  id,
  value,
  onChange,
  error,
  hint,
  disabled,
  placeholder = "Generated automatically",
  ...rest
}: BarcodeFieldProps) {
  const [scanOpen, setScanOpen] = useState(false)
  const describedBy = error || hint ? `${id}-help` : undefined

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        Barcode <span className="font-normal text-muted-foreground">(optional)</span>
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="h-10 font-mono"
          data-testid={rest["data-testid"]}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          onClick={() => setScanOpen(true)}
          disabled={disabled}
          aria-label="Scan a barcode"
          title="Scan a barcode"
        >
          <ScanLine />
        </Button>
      </div>
      {(error || hint) && (
        <p id={describedBy} className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {error ?? hint}
        </p>
      )}
      <BarcodeScannerDialog
        isOpen={scanOpen}
        onClose={() => setScanOpen(false)}
        currentBarcode={value}
        onBarcodeScanned={(code) => onChange(code.trim())}
      />
    </div>
  )
}
