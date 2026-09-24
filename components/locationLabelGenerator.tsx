"use client"

import { useEffect, useRef, useState } from "react"
import type { jsPDF } from "jspdf"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import type { LocationStructure } from "@/lib/api/locations.api"
import { getErrorMessage } from "@/lib/api/client"
import { parseLocationStructure } from "@/components/locations/structure"

/** Anything with a code can be labelled; structure is the raw JSON from the API */
export interface LabelLocation {
  id: string
  code: string
  barcode?: string | null
  description?: string | null
  structure?: unknown
}

interface LocationLabelGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** A single location (detail page, row action) */
  location?: LabelLocation | null
  /** Several locations — one PDF with a page per label */
  locations?: LabelLocation[]
}

type CodeType = "qr" | "barcode"

interface LabelOptions {
  width: number
  height: number
  codeType: CodeType
  showCode: boolean
  showStructure: boolean
  showDescription: boolean
  /** Human-readable value under the QR code / barcode */
  showValue: boolean
}

const PRESETS = [
  { label: "4 × 6", width: 4, height: 6 },
  { label: "4 × 2", width: 4, height: 2 },
  { label: "3 × 2", width: 3, height: 2 },
  { label: "2 × 1", width: 2, height: 1 },
]

const MIN_SIZE = 1
const MAX_SIZE = 12
/** jsPDF line height in inches per point of font size */
const LINE = 0.012

const scanValue = (location: LabelLocation) => location.barcode || location.code || `LOC-${location.id}`
const structureText = (structure: LocationStructure) =>
  structure.map((s) => (s.label ? `${s.label}: ${s.value}` : s.value)).join("  •  ")

function readSession(key: string, fallback: string): string {
  try {
    return sessionStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // storage unavailable — the setting just won't persist
  }
}

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

/** Shrinks the font until `text` fits in `maxLines` lines of `maxWidth` (and `maxHeight` if given) */
function fitText(
  doc: jsPDF,
  text: string,
  opts: { style: "bold" | "normal" | "italic"; start: number; min: number; maxLines: number; maxWidth: number; maxHeight?: number }
): { lines: string[]; size: number } {
  doc.setFont("helvetica", opts.style)
  let size = opts.start
  let lines: string[] = []
  for (let attempt = 0; attempt < 24; attempt++) {
    doc.setFontSize(size)
    lines = doc.splitTextToSize(text, opts.maxWidth) as string[]
    const widest = lines.reduce((max, line) => Math.max(max, doc.getTextWidth(line)), 0)
    const height = lines.length * size * LINE
    if (lines.length <= opts.maxLines && widest <= opts.maxWidth * 1.05 && (!opts.maxHeight || height <= opts.maxHeight)) {
      break
    }
    size *= 0.92
    if (size < opts.min) {
      size = opts.min
      doc.setFontSize(size)
      lines = doc.splitTextToSize(text, opts.maxWidth) as string[]
      break
    }
  }
  return { lines: lines.slice(0, opts.maxLines), size }
}

function drawLines(doc: jsPDF, lines: string[], size: number, centerX: number, top: number): number {
  const lineHeight = size * LINE
  lines.forEach((line, index) => {
    doc.text(line, centerX, top + lineHeight * (index + 1), { align: "center" })
  })
  return lineHeight * lines.length
}

async function renderLabelsPdf(locations: LabelLocation[], options: LabelOptions): Promise<jsPDF> {
  const [{ jsPDF: JsPdf }, qrcode, jsbarcode] = await Promise.all([
    import("jspdf"),
    import("qrcode"),
    import("jsbarcode"),
  ])
  const QRCode = qrcode.default
  const JsBarcode = jsbarcode.default
  const { width, height } = options
  const orientation = width > height ? "landscape" : "portrait"
  const doc = new JsPdf({ orientation, unit: "in", format: [width, height] })

  const scale = Math.min(width, height) / 4
  const margin = 0.1 * scale
  const contentWidth = width - margin * 2

  for (const [index, location] of locations.entries()) {
    if (index > 0) doc.addPage([width, height], orientation)
    const structure = parseLocationStructure(location.structure)
    const value = scanValue(location)
    let y = margin

    const hasHeader =
      options.showCode || (options.showStructure && structure.length > 0) || (options.showDescription && !!location.description)

    if (options.showCode) {
      const chars = location.code.length
      const { lines, size } = fitText(doc, location.code, {
        style: "bold",
        start: Math.max(14, Math.min(140, Math.min(width, height) * 14 * Math.max(0.3, Math.min(1.3, 35 / Math.sqrt(chars))))),
        min: 12,
        maxLines: chars > 50 ? 3 : height < 2 ? 1 : 2,
        maxWidth: contentWidth,
        maxHeight: height * 0.35,
      })
      y += drawLines(doc, lines, size, width / 2, y) + 0.02 * scale
    }

    const smallStart = (text: string) =>
      Math.max(6, Math.min(28, Math.min(width, height) * 2.4 * Math.max(0.4, Math.min(1.2, 60 / Math.sqrt(text.length)))))

    if (options.showStructure && structure.length > 0) {
      const text = structureText(structure)
      const { lines, size } = fitText(doc, text, {
        style: "normal",
        start: smallStart(text),
        min: 5,
        maxLines: text.length > 80 ? 2 : 1,
        maxWidth: contentWidth,
      })
      y += drawLines(doc, lines, size, width / 2, y) + 0.015 * scale
    }

    if (options.showDescription && location.description) {
      const text = location.description
      const { lines, size } = fitText(doc, text, {
        style: "italic",
        start: smallStart(text),
        min: 5,
        maxLines: text.length > 80 ? 2 : 1,
        maxWidth: contentWidth,
      })
      y += drawLines(doc, lines, size, width / 2, y) + 0.015 * scale
    }

    if (hasHeader) {
      doc.setDrawColor(200, 200, 200)
      doc.setLineWidth(0.003)
      doc.line(margin, y, width - margin, y)
      y += 0.03 * scale
    }

    const available = height - y - margin

    if (options.codeType === "qr") {
      // Reserve a line for the human-readable value when requested
      const valueSize = Math.max(6, Math.min(16, Math.min(width, height) * 3))
      const valueSpace = options.showValue ? valueSize * LINE * 1.6 : 0
      const qrSize = Math.max(0.3, Math.min(contentWidth * 0.85, (available - valueSpace) * 0.9, Math.max(width, height) * 0.7))
      const dataUrl = await QRCode.toDataURL(value, { width: 600, margin: 1, errorCorrectionLevel: "M" })
      const qrY = y + (available - valueSpace - qrSize) / 2
      doc.addImage(dataUrl, "PNG", (width - qrSize) / 2, qrY, qrSize, qrSize)
      if (options.showValue) {
        doc.setFont("courier", "normal")
        doc.setFontSize(valueSize)
        const [line] = doc.splitTextToSize(value, contentWidth) as string[]
        doc.text(line ?? value, width / 2, qrY + qrSize + valueSize * LINE * 1.2, { align: "center" })
      }
    } else {
      const canvas = document.createElement("canvas")
      JsBarcode(canvas, value, {
        format: "CODE128",
        width: 3,
        height: Math.max(100, height * 30),
        displayValue: options.showValue,
        fontSize: Math.max(14, Math.min(20, width * 4)),
        textMargin: 5,
        margin: 10,
      })
      const barcodeWidth = contentWidth * 0.95
      const barcodeHeight = Math.min(available * 0.8, height * 0.5)
      doc.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        (width - barcodeWidth) / 2,
        y + (available - barcodeHeight) / 2,
        barcodeWidth,
        barcodeHeight
      )
    }

    doc.setDrawColor(180, 180, 180)
    doc.setLineWidth(0.005)
    doc.rect(0.02, 0.02, width - 0.04, height - 0.04)
  }

  return doc
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

export function LocationLabelGenerator({ open, onOpenChange, location, locations }: LocationLabelGeneratorProps) {
  const targets = locations ?? (location ? [location] : [])
  const [busy, setBusy] = useState(false)
  const multiple = targets.length > 1

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg" data-testid="location-label-dialog">
        <DialogHeader>
          <DialogTitle>{multiple ? `Print ${formatNumber(targets.length)} labels` : "Print label"}</DialogTitle>
          <DialogDescription>
            {multiple
              ? "One PDF with a label per location, ready for your label printer."
              : "Download a printable PDF with a QR code or barcode for this location."}
          </DialogDescription>
        </DialogHeader>
        {targets.length > 0 ? (
          <LabelForm targets={targets} busy={busy} setBusy={setBusy} onDone={() => onOpenChange(false)} />
        ) : (
          <p className="text-sm text-muted-foreground">There are no locations to print.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LabelForm({
  targets,
  busy,
  setBusy,
  onDone,
}: {
  targets: LabelLocation[]
  busy: boolean
  setBusy: (busy: boolean) => void
  onDone: () => void
}) {
  const [width, setWidth] = useState(() => readSession("locationLabelWidth", "4"))
  const [height, setHeight] = useState(() => readSession("locationLabelHeight", "6"))
  const [codeType, setCodeType] = useState<CodeType>("qr")
  const [showCode, setShowCode] = useState(true)
  const [showStructure, setShowStructure] = useState(true)
  const [showDescription, setShowDescription] = useState(false)
  const [showValue, setShowValue] = useState(true)

  const w = Number.parseFloat(width)
  const h = Number.parseFloat(height)
  const sizeError =
    !Number.isFinite(w) || !Number.isFinite(h) || w < MIN_SIZE || h < MIN_SIZE || w > MAX_SIZE || h > MAX_SIZE
      ? `Width and height must be between ${MIN_SIZE} and ${MAX_SIZE} inches`
      : undefined

  const setSize = (nextWidth: string, nextHeight: string) => {
    setWidth(nextWidth)
    setHeight(nextHeight)
    writeSession("locationLabelWidth", nextWidth)
    writeSession("locationLabelHeight", nextHeight)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sizeError) return
    setBusy(true)
    try {
      const doc = await renderLabelsPdf(targets, {
        width: w,
        height: h,
        codeType,
        showCode,
        showStructure,
        showDescription,
        showValue,
      })
      const date = new Date().toISOString().slice(0, 10)
      const name =
        targets.length === 1
          ? `location-label-${targets[0].code.replace(/[^a-zA-Z0-9-]/g, "_")}-${w}x${h}-${date}.pdf`
          : `location-labels-${targets.length}-${w}x${h}-${date}.pdf`
      doc.save(name)
      toast.success(targets.length === 1 ? "Label downloaded" : `${formatNumber(targets.length)} labels downloaded`)
      onDone()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't generate the label"), {
        description: codeType === "barcode" ? "Barcodes only support plain ASCII characters." : undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  const preview = targets[0]

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="space-y-2">
        <LabelPreview
          location={preview}
          width={sizeError ? 4 : w}
          height={sizeError ? 6 : h}
          codeType={codeType}
          showCode={showCode}
          showStructure={showStructure}
          showDescription={showDescription}
          showValue={showValue}
        />
        {targets.length > 1 && (
          <p className="text-center text-xs text-muted-foreground">
            Previewing <span className="font-mono">{preview.code}</span> · 1 of {formatNumber(targets.length)}
          </p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">Label size (inches)</legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const active = w === preset.width && h === preset.height
            return (
              <Button
                key={preset.label}
                type="button"
                variant={active ? "secondary" : "outline"}
                size="sm"
                aria-pressed={active}
                onClick={() => setSize(String(preset.width), String(preset.height))}
                disabled={busy}
                className={cn("tabular-nums", active && "ring-1 ring-primary/40")}
              >
                {preset.label}
              </Button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="label-width" className="text-xs text-muted-foreground">
              Width
            </Label>
            <Input
              id="label-width"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={width}
              onChange={(e) => setSize(e.target.value, height)}
              aria-invalid={Boolean(sizeError) || undefined}
              disabled={busy}
              className="h-10 tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="label-height" className="text-xs text-muted-foreground">
              Height
            </Label>
            <Input
              id="label-height"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={MIN_SIZE}
              max={MAX_SIZE}
              value={height}
              onChange={(e) => setSize(width, e.target.value)}
              aria-invalid={Boolean(sizeError) || undefined}
              disabled={busy}
              className="h-10 tabular-nums"
            />
          </div>
        </div>
        {sizeError && <p className="text-xs text-destructive">{sizeError}</p>}
      </fieldset>

      <div className="space-y-2">
        <p className="text-sm font-medium">Code</p>
        <Tabs value={codeType} onValueChange={(v) => setCodeType(v as CodeType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr" disabled={busy}>
              QR code
            </TabsTrigger>
            <TabsTrigger value="barcode" disabled={busy}>
              Barcode
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <fieldset className="space-y-1">
        <legend className="mb-2 text-sm font-medium">Show on label</legend>
        <div className="grid gap-x-6 sm:grid-cols-2">
          <ToggleRow id="label-show-code" label="Location code" checked={showCode} onChange={setShowCode} disabled={busy} />
          <ToggleRow
            id="label-show-structure"
            label="Levels"
            checked={showStructure}
            onChange={setShowStructure}
            disabled={busy}
          />
          <ToggleRow
            id="label-show-description"
            label="Description"
            checked={showDescription}
            onChange={setShowDescription}
            disabled={busy}
          />
          <ToggleRow
            id="label-show-value"
            label={codeType === "qr" ? "Value under QR code" : "Value under barcode"}
            checked={showValue}
            onChange={setShowValue}
            disabled={busy}
          />
        </div>
      </fieldset>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || Boolean(sizeError)} data-testid="download-label-button">
          {busy ? <Loader2 className="animate-spin" /> : <Download />}
          {busy ? "Generating…" : "Download PDF"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3">
      <Label htmlFor={id} className="cursor-pointer font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  )
}

/** On-screen approximation of the printed label (white paper in both themes) */
function LabelPreview({
  location,
  width,
  height,
  codeType,
  showCode,
  showStructure,
  showDescription,
  showValue,
}: {
  location: LabelLocation
  width: number
  height: number
  codeType: CodeType
  showCode: boolean
  showStructure: boolean
  showDescription: boolean
  showValue: boolean
}) {
  const qrRef = useRef<HTMLCanvasElement>(null)
  const barcodeRef = useRef<SVGSVGElement>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const structure = parseLocationStructure(location.structure)
  const value = scanValue(location)
  const hasHeader = showCode || (showStructure && structure.length > 0) || (showDescription && !!location.description)

  useEffect(() => {
    let cancelled = false
    const draw = async () => {
      try {
        if (codeType === "qr" && qrRef.current) {
          const QRCode = (await import("qrcode")).default
          const canvas = qrRef.current
          if (!cancelled && canvas) {
            await QRCode.toCanvas(canvas, value, { width: 240, margin: 1, errorCorrectionLevel: "M" })
            // qrcode pins an inline pixel size; let CSS scale it to the preview instead
            canvas.style.removeProperty("width")
            canvas.style.removeProperty("height")
          }
        } else if (codeType === "barcode" && barcodeRef.current) {
          const JsBarcode = (await import("jsbarcode")).default
          if (!cancelled && barcodeRef.current) {
            JsBarcode(barcodeRef.current, value, {
              format: "CODE128",
              width: 2,
              height: 60,
              displayValue: showValue,
              fontSize: 14,
              margin: 0,
            })
          }
        }
        if (!cancelled) setRenderError(null)
      } catch (err) {
        if (!cancelled) setRenderError(getErrorMessage(err, "Can't encode this value"))
      }
    }
    draw()
    return () => {
      cancelled = true
    }
  }, [codeType, value, showValue])

  return (
    <div className="flex justify-center rounded-lg bg-muted p-4">
      <div
        className="flex flex-col overflow-hidden rounded-sm bg-white p-[5%] text-black shadow-md ring-1 ring-black/10"
        style={{ aspectRatio: `${width} / ${height}`, width: `min(100%, calc(15rem * ${width / height}))` }}
        aria-label={`Label preview for ${location.code}`}
      >
        {hasHeader && (
          <div className="shrink-0 border-b border-black/20 pb-1.5 text-center">
            {showCode && <p className="break-all text-lg font-bold leading-tight">{location.code}</p>}
            {showStructure && structure.length > 0 && (
              <p className="mt-0.5 line-clamp-1 text-[10px] text-black/70">{structureText(structure)}</p>
            )}
            {showDescription && location.description && (
              <p className="mt-0.5 line-clamp-1 text-[10px] italic text-black/70">{location.description}</p>
            )}
          </div>
        )}
        <div
          className={cn(
            "relative flex min-h-0 flex-1 flex-col items-center justify-center gap-1 pt-1.5",
            renderError && "[&>*]:invisible"
          )}
        >
          {renderError && (
            <p className="!visible absolute inset-0 flex items-center justify-center text-center text-xs text-black/60">
              {renderError}
            </p>
          )}
          {codeType === "qr" ? (
            <>
              <div className="relative min-h-0 w-full flex-1">
                <canvas ref={qrRef} className="absolute inset-0 size-full object-contain" />
              </div>
              {showValue && <p className="max-w-full shrink-0 truncate font-mono text-[10px]">{value}</p>}
            </>
          ) : (
            <svg ref={barcodeRef} className="h-auto max-h-full w-full" preserveAspectRatio="xMidYMid meet" />
          )}
        </div>
      </div>
    </div>
  )
}
