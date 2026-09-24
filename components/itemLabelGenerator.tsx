"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import Image from "next/image"
import { Download, Loader2, QrCode } from "lucide-react"
import { toast } from "sonner"
import type { jsPDF } from "jspdf"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, invalidProps } from "@/components/items/form-field"
import { todayInputValue } from "@/components/items/item-utils"
import { getErrorMessage } from "@/lib/api/client"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

interface LabelItem {
  id: string
  name: string
  description?: string | null
  itemNumber: string
  barcode?: string | null
  unit?: string | null
  cost: number
}

interface ItemLabelGeneratorProps {
  item: LabelItem
  /** Element that opens the dialog. Omit it when controlling `open` yourself. */
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type CodeType = "qr" | "barcode" | "both"
type FieldKey = "name" | "description" | "sku" | "unit" | "codeText" | "price"

interface LabelSettings {
  preset: string
  width: string
  height: string
  codeType: CodeType
  fields: Record<FieldKey, boolean>
  copies: string
}

const PRESETS = [
  { value: "4x6", label: "4 × 6 in", width: 4, height: 6 },
  { value: "4x3", label: "4 × 3 in", width: 4, height: 3 },
  { value: "3x2", label: "3 × 2 in", width: 3, height: 2 },
  { value: "2.25x1.25", label: "2.25 × 1.25 in", width: 2.25, height: 1.25 },
  { value: "2x1", label: "2 × 1 in", width: 2, height: 1 },
]
const CUSTOM_PRESET = "custom"

const CODE_TYPES: { value: CodeType; label: string }[] = [
  { value: "qr", label: "QR code" },
  { value: "barcode", label: "Barcode" },
  { value: "both", label: "Both" },
]

const FIELD_OPTIONS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "description", label: "Description" },
  { key: "sku", label: "Item number" },
  { key: "unit", label: "Unit" },
  { key: "codeText", label: "Barcode digits" },
  { key: "price", label: "Unit cost" },
]

const DEFAULT_SETTINGS: LabelSettings = {
  preset: "4x6",
  width: "4",
  height: "6",
  codeType: "qr",
  fields: { name: true, description: true, sku: true, unit: true, codeText: true, price: false },
  copies: "1",
}

const STORAGE_KEY = "itemLabelSettings"

function readSettings(): LabelSettings {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const saved = JSON.parse(raw) as Partial<LabelSettings>
    return { ...DEFAULT_SETTINGS, ...saved, fields: { ...DEFAULT_SETTINGS.fields, ...saved.fields } }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function storeSettings(settings: LabelSettings) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // storage unavailable — settings just aren't remembered
  }
}

/** What the QR code / barcode encode */
function codeValueOf(item: LabelItem): string {
  return item.barcode || item.itemNumber
}

/** Printable item label (PDF) with a QR code and/or barcode */
export function ItemLabelGenerator({ item, trigger, open: openProp, onOpenChange }: ItemLabelGeneratorProps) {
  const [openState, setOpenState] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openState

  const setOpen = (next: boolean) => {
    if (!controlled) setOpenState(next)
    onOpenChange?.(next)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== undefined ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        !controlled && (
          <DialogTrigger asChild>
            <Button variant="outline">
              <QrCode /> Print label
            </Button>
          </DialogTrigger>
        )
      )}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Print label</DialogTitle>
          <DialogDescription>Download a PDF label for {item.name} to print on a label printer or sheet.</DialogDescription>
        </DialogHeader>
        <LabelForm item={item} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

interface PreviewCodes {
  value: string
  qr: string | null
  barcode: string | null
}

function LabelForm({ item, onDone }: { item: LabelItem; onDone: () => void }) {
  const [settings, setSettings] = useState<LabelSettings>(readSettings)
  const [codes, setCodes] = useState<PreviewCodes | null>(null)
  const [generating, setGenerating] = useState(false)
  const codeValue = codeValueOf(item)

  // Real QR / barcode images for the preview
  useEffect(() => {
    let cancelled = false
    Promise.all([import("qrcode"), import("jsbarcode")])
      .then(async ([{ default: QRCode }, { default: JsBarcode }]) => {
        const qr = await QRCode.toDataURL(codeValue, { width: 240, margin: 0, errorCorrectionLevel: "M" })
        let barcode: string | null = null
        try {
          const canvas = document.createElement("canvas")
          JsBarcode(canvas, codeValue, { format: "CODE128", displayValue: false, margin: 0, height: 60, width: 2 })
          barcode = canvas.toDataURL("image/png")
        } catch {
          barcode = null
        }
        if (!cancelled) setCodes({ value: codeValue, qr, barcode })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [codeValue])

  const update = (patch: Partial<LabelSettings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    storeSettings(next)
  }
  const toggleField = (key: FieldKey, checked: boolean) => update({ fields: { ...settings.fields, [key]: checked } })

  const preset = PRESETS.find((p) => p.value === settings.preset)
  const width = preset ? preset.width : Number(settings.width)
  const height = preset ? preset.height : Number(settings.height)
  const sizeValid = width >= 0.5 && width <= 12 && height >= 0.5 && height <= 12
  const copies = Number(settings.copies)
  const copiesValid = Number.isInteger(copies) && copies >= 1 && copies <= 100

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!sizeValid || !copiesValid) return
    setGenerating(true)
    try {
      await downloadLabelPdf(item, { width, height, codeType: settings.codeType, fields: settings.fields, copies })
      toast.success(copies === 1 ? "Label downloaded" : `${copies} labels downloaded`)
      onDone()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't generate the label"))
    } finally {
      setGenerating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <LabelPreview
          item={item}
          width={sizeValid ? width : 4}
          height={sizeValid ? height : 6}
          codeType={settings.codeType}
          fields={settings.fields}
          codes={codes?.value === codeValue ? codes : null}
        />

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label-size">Label size</Label>
            <Select value={settings.preset} onValueChange={(v) => update({ preset: v })}>
              <SelectTrigger id="label-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_PRESET}>Custom size</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!preset && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Width (in)" htmlFor="label-width" error={sizeValid ? undefined : "0.5 – 12 in"}>
                <Input
                  {...invalidProps("label-width", sizeValid ? undefined : "invalid")}
                  type="number"
                  step="0.1"
                  min={0.5}
                  max={12}
                  inputMode="decimal"
                  value={settings.width}
                  onChange={(e) => update({ width: e.target.value })}
                />
              </Field>
              <Field label="Height (in)" htmlFor="label-height">
                <Input
                  id="label-height"
                  aria-invalid={sizeValid ? undefined : true}
                  type="number"
                  step="0.1"
                  min={0.5}
                  max={12}
                  inputMode="decimal"
                  value={settings.height}
                  onChange={(e) => update({ height: e.target.value })}
                />
              </Field>
            </div>
          )}

          <div className="space-y-1.5">
            <Label id="label-code-type">Code</Label>
            <div role="radiogroup" aria-labelledby="label-code-type" className="grid grid-cols-3 gap-1 rounded-lg border bg-muted/50 p-1">
              {CODE_TYPES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={settings.codeType === c.value}
                  onClick={() => update({ codeType: c.value })}
                  className={cn(
                    "h-8 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    settings.codeType === c.value && "bg-background text-foreground shadow-xs"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Encodes <span className="font-mono">{codeValue}</span>
              {item.barcode ? "" : " (item number — no barcode set)"}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Show on label</legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {FIELD_OPTIONS.map((f) => {
                const disabled = f.key === "codeText" && settings.codeType === "qr"
                return (
                  <label
                    key={f.key}
                    className={cn("flex min-h-8 items-center gap-2 text-sm", disabled ? "opacity-50" : "cursor-pointer")}
                  >
                    <Checkbox
                      checked={settings.fields[f.key] && !disabled}
                      disabled={disabled}
                      onCheckedChange={(checked) => toggleField(f.key, checked === true)}
                    />
                    {f.label}
                  </label>
                )
              })}
            </div>
          </fieldset>

          <Field label="Copies" htmlFor="label-copies" error={copiesValid ? undefined : "1 – 100"} className="max-w-32">
            <Input
              {...invalidProps("label-copies", copiesValid ? undefined : "invalid")}
              type="number"
              min={1}
              max={100}
              step={1}
              inputMode="numeric"
              value={settings.copies}
              onChange={(e) => update({ copies: e.target.value })}
            />
          </Field>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={generating}>
          Cancel
        </Button>
        <Button type="submit" disabled={generating || !sizeValid || !copiesValid} data-testid="download-label-button">
          {generating ? <Loader2 className="animate-spin" /> : <Download />}
          {generating ? "Generating…" : "Download PDF"}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Preview (white "paper" — the one place raw white/black is allowed)
// ---------------------------------------------------------------------------

const PREVIEW_BOX = { width: 260, height: 240 }

function footerFields(item: LabelItem, fields: Record<FieldKey, boolean>) {
  const out: { label: string; value: string; mono?: boolean }[] = []
  if (fields.sku) out.push({ label: "SKU", value: item.itemNumber, mono: true })
  if (fields.unit) out.push({ label: "Unit", value: item.unit || "EA" })
  if (fields.price) out.push({ label: "Price", value: formatCurrency(item.cost) })
  return out
}

function LabelPreview({
  item,
  width,
  height,
  codeType,
  fields,
  codes,
}: {
  item: LabelItem
  width: number
  height: number
  codeType: CodeType
  fields: Record<FieldKey, boolean>
  codes: PreviewCodes | null
}) {
  const scale = Math.min(PREVIEW_BOX.width / width, PREVIEW_BOX.height / height)
  const boxWidth = width * scale
  const boxHeight = height * scale
  const fontSize = Math.max(7, Math.min(boxWidth, boxHeight) * 0.07)
  const footer = footerFields(item, fields)
  const showQr = codeType !== "barcode"
  const showBarcode = codeType !== "qr"
  const showDescription = fields.description && !!item.description

  return (
    <div className="flex items-center justify-center rounded-lg border bg-muted/50 p-4" aria-label="Label preview">
      <div
        className="flex flex-col overflow-hidden rounded-sm bg-white text-black shadow-md ring-1 ring-current/10"
        style={{ width: boxWidth, height: boxHeight, padding: boxWidth * 0.04, fontSize, gap: fontSize * 0.4 }}
      >
        {(fields.name || showDescription) && (
          <div className="shrink-0 border-b border-current/20 pb-[0.3em] text-center leading-tight">
            {fields.name && <p className="line-clamp-2 font-bold">{item.name}</p>}
            {showDescription && <p className="line-clamp-1 text-[0.75em] opacity-60">{item.description}</p>}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[0.3em]">
          {showQr && (
            <div className={cn("relative aspect-square max-w-full", showBarcode ? "h-[55%]" : "h-[85%]")}>
              {codes?.qr ? (
                <Image src={codes.qr} alt="QR code" fill unoptimized className="object-contain" />
              ) : (
                <div className="size-full animate-pulse rounded-sm bg-current/10" />
              )}
            </div>
          )}
          {showBarcode && (
            <div className={cn("flex w-[92%] flex-col items-center", showQr ? "h-[32%]" : "h-[45%]")}>
              <div className="relative min-h-0 w-full flex-1">
                {codes?.barcode ? (
                  <Image src={codes.barcode} alt="Barcode" fill unoptimized className="object-fill" />
                ) : (
                  <div className="size-full animate-pulse rounded-sm bg-current/10" />
                )}
              </div>
              {fields.codeText && <p className="font-mono text-[0.7em] leading-tight">{codeValueOf(item)}</p>}
            </div>
          )}
        </div>

        {footer.length > 0 && (
          <div
            className="grid shrink-0 border-t border-current/20 pt-[0.3em] text-center text-[0.75em] leading-tight"
            style={{ gridTemplateColumns: `repeat(${footer.length}, minmax(0, 1fr))` }}
          >
            {footer.map((f) => (
              <div key={f.label} className="min-w-0 px-[0.2em]">
                <p className="font-semibold opacity-60">{f.label}</p>
                <p className={cn("truncate font-semibold", f.mono && "font-mono")}>{f.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

interface PdfOptions {
  width: number
  height: number
  codeType: CodeType
  fields: Record<FieldKey, boolean>
  copies: number
}

async function downloadLabelPdf(item: LabelItem, { width, height, codeType, fields, copies }: PdfOptions) {
  const [{ default: QRCode }, { default: JsBarcode }, { jsPDF: JsPdf }] = await Promise.all([
    import("qrcode"),
    import("jsbarcode"),
    import("jspdf"),
  ])

  const orientation = width > height ? "landscape" : "portrait"
  const doc = new JsPdf({ orientation, unit: "in", format: [width, height] })
  const value = codeValueOf(item)
  const withQr = codeType !== "barcode"
  const withBarcode = codeType !== "qr"
  const both = withQr && withBarcode

  const qr = withQr ? await QRCode.toDataURL(value, { width: 300, margin: 0, errorCorrectionLevel: "M" }) : null

  let barcode: string | null = null
  if (withBarcode) {
    try {
      const canvas = document.createElement("canvas")
      JsBarcode(canvas, value, {
        format: "CODE128",
        width: Math.max(1.5, width * 0.5),
        height: both ? Math.min(60, Math.max(30, height * 15)) : Math.min(80, Math.max(30, height * 20)),
        displayValue: fields.codeText,
        fontSize: both ? Math.max(8, Math.min(12, width * 2.5)) : Math.max(10, Math.min(16, width * 3)),
        textMargin: 2,
        margin: 0,
      })
      barcode = canvas.toDataURL("image/png")
    } catch {
      if (!withQr) throw new Error(`"${value}" can't be encoded as a barcode`)
    }
  }

  for (let page = 0; page < copies; page++) {
    if (page > 0) doc.addPage([width, height], orientation)
    drawLabel(doc, item, { width, height, fields, qr, barcode })
  }

  doc.save(`label-${item.itemNumber}-${width}x${height}in-${todayInputValue()}.pdf`)
}

/** Shrink the font until `text` fits in `maxLines` lines of `maxWidth` */
function fitText(doc: jsPDF, text: string, maxWidth: number, startSize: number, minSize: number, maxLines: number) {
  let size = startSize
  for (let attempt = 0; attempt < 20 && size > minSize; attempt++) {
    doc.setFontSize(size)
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    const widest = Math.max(0, ...lines.map((line) => doc.getTextWidth(line)))
    if (lines.length <= maxLines && widest <= maxWidth * 1.05) return { lines, size }
    size *= 0.92
  }
  size = Math.max(size, minSize)
  doc.setFontSize(size)
  return { lines: (doc.splitTextToSize(text, maxWidth) as string[]).slice(0, maxLines), size }
}

function drawLabel(
  doc: jsPDF,
  item: LabelItem,
  {
    width,
    height,
    fields,
    qr,
    barcode,
  }: { width: number; height: number; fields: Record<FieldKey, boolean>; qr: string | null; barcode: string | null }
) {
  const scale = Math.min(width, height) / 4
  const margin = 0.1 * scale
  const contentWidth = width - margin * 2
  const footer = footerFields(item, fields)
  const hasCodes = !!qr || !!barcode
  const showDescription = fields.description && !!item.description
  let y = margin

  const separator = () => {
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.003)
    doc.line(margin, y, width - margin, y)
  }

  // Header
  if (fields.name) {
    doc.setFont("helvetica", "bold")
    const lengthFactor = Math.max(0.3, Math.min(1.3, 40 / Math.sqrt(item.name.length)))
    const start = Math.max(8, Math.min(96, Math.min(width, height) * 8.4 * lengthFactor))
    const maxLines = item.name.length > 100 ? 4 : height < 2 ? 1 : 3
    const { lines, size } = fitText(doc, item.name, contentWidth, start, 6, maxLines)
    const lineHeight = size * 0.012
    lines.forEach((line, i) => doc.text(line, width / 2, y + lineHeight * (i + 1), { align: "center" }))
    y += lineHeight * lines.length + 0.03 * scale
  }
  if (showDescription && item.description) {
    doc.setFont("helvetica", "normal")
    const lengthFactor = Math.max(0.4, Math.min(1.2, 60 / Math.sqrt(item.description.length)))
    const start = Math.max(6, Math.min(28, Math.min(width, height) * 2.4 * lengthFactor))
    const maxLines = item.description.length > 80 ? 3 : height < 2 ? 1 : 2
    const { lines, size } = fitText(doc, item.description, contentWidth, start, 5, maxLines)
    const lineHeight = size * 0.012
    lines.forEach((line, i) => doc.text(line, width / 2, y + lineHeight * (i + 1), { align: "center" }))
    y += lineHeight * lines.length + 0.02 * scale
  }
  if ((fields.name || showDescription) && (hasCodes || footer.length > 0)) {
    separator()
    y += 0.04 * scale
  }

  // Codes
  const footerHeight = footer.length > 0 ? 0.25 + 0.1 * scale : 0
  const available = height - y - footerHeight - margin

  if (qr && barcode) {
    const gap = 0.08 * scale
    const qrSize = Math.min(contentWidth * 0.85, (available - gap) * 0.45, width * 0.75)
    const barcodeHeight = Math.min((available - gap - qrSize) * 0.8, height * 0.2)
    const qrY = y + (available - qrSize - barcodeHeight - gap) / 2
    const barcodeWidth = contentWidth * 0.95
    doc.addImage(qr, "PNG", (width - qrSize) / 2, qrY, qrSize, qrSize)
    doc.addImage(barcode, "PNG", (width - barcodeWidth) / 2, qrY + qrSize + gap, barcodeWidth, barcodeHeight)
  } else if (qr) {
    const size = Math.min(contentWidth * 0.85, available * 0.75, Math.max(width, height) * 0.7)
    doc.addImage(qr, "PNG", (width - size) / 2, y + (available - size) / 2, size, size)
  } else if (barcode) {
    const barcodeWidth = contentWidth * 0.95
    const barcodeHeight = Math.min(available * 0.6, height * 0.3)
    doc.addImage(barcode, "PNG", (width - barcodeWidth) / 2, y + (available - barcodeHeight) / 2, barcodeWidth, barcodeHeight)
  }
  if (hasCodes) y = height - footerHeight - margin

  // Footer: up to three columns (SKU, unit, price)
  if (footer.length > 0) {
    if (hasCodes) {
      separator()
      y += 0.03 * scale
    }
    const fontSize = Math.max(8, Math.min(14, width * 2.4))
    const lineHeight = fontSize * 0.012
    const columnWidth = contentWidth / footer.length
    doc.setFontSize(fontSize)
    footer.forEach((f, i) => {
      const x = margin + columnWidth * i + columnWidth / 2
      doc.setFont("helvetica", "bold")
      doc.text(footer.length === 3 ? f.label : `${f.label}:`, x, y + lineHeight, { align: "center" })
      doc.setFont("helvetica", "normal")
      const [valueLine = ""] = doc.splitTextToSize(f.value, columnWidth * 0.85) as string[]
      doc.text(valueLine, x, y + lineHeight * 2, { align: "center" })
    })
  }

  // Thin border around the label
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.005)
  doc.rect(0.02, 0.02, width - 0.04, height - 0.04)
}
