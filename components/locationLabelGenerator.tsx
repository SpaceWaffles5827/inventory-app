"use client"

import { useState } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { QrCode, Barcode, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { LocationStructure } from "@/lib/api/locations.api"

interface LocationData {
    id: string
    code: string
    barcode?: string | null
    description?: string | null
    structure?: LocationStructure[] | null
}

interface LocationLabelGeneratorProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    location: LocationData
}

export function LocationLabelGenerator({
    open,
    onOpenChange,
    location,
}: LocationLabelGeneratorProps) {
    const [isGeneratingLabel, setIsGeneratingLabel] = useState(false)
    const [labelWidth, setLabelWidth] = useState("4")
    const [labelHeight, setLabelHeight] = useState("6")
    const [codeType, setCodeType] = useState<"qr" | "barcode">("qr")
    const [showLocationCode, setShowLocationCode] = useState(true)
    const [showStructure, setShowStructure] = useState(true)
    const [showBarcode, setShowBarcode] = useState(true)
    const [showDescription, setShowDescription] = useState(false)

    const structure = Array.isArray(location.structure) ? location.structure : []

    const generateLocationLabel = async () => {
        setIsGeneratingLabel(true)
        try {
            const QRCode = (await import('qrcode')).default
            const JsBarcode = (await import('jsbarcode')).default
            const { jsPDF } = await import('jspdf')

            const width = parseFloat(labelWidth) || 4
            const height = parseFloat(labelHeight) || 6

            if (width <= 0 || width > 12 || height <= 0 || height > 12) {
                toast.error("Label dimensions must be between 0 and 12 inches")
                setIsGeneratingLabel(false)
                return
            }

            const doc = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'in',
                format: [width, height]
            })

            const scaleFactor = Math.min(width, height) / 4
            const margin = 0.1 * scaleFactor
            const contentWidth = width - (margin * 2)
            const contentHeight = height - (margin * 2)
            let currentY = margin

            const hasHeader = showLocationCode || showStructure || showDescription
            const needsQR = codeType === 'qr'
            const needsBarcode = codeType === 'barcode'

            const barcodeValue = location.barcode || location.code || `LOC-${location.id}`

            // ========== HEADER SECTION ==========
            if (hasHeader) {
                if (showLocationCode) {
                    // Calculate optimal font size based on available width and content length
                    // WAREHOUSE VISIBILITY - Large enough to read from distance but balanced
                    const availableWidth = contentWidth
                    const estimatedChars = location.code.length

                    // Calculate available space for header text
                    const totalHeaderSpace = height * 0.35 // Allow header to use ~35% of label height

                    // Start with a base size that's proportional to available space
                    // Target: location code should be prominent but not overwhelming
                    const baseSize = Math.min(width, height) * 14.0  // Reduced from 24.0

                    // Adjust for content length (longer codes = smaller font)
                    const lengthAdjustment = Math.max(0.3, Math.min(1.3, 35 / Math.sqrt(estimatedChars)))

                    // Calculate initial size with reasonable bounds
                    let codeFontSize = Math.max(14, Math.min(140, baseSize * lengthAdjustment))  // 14-140pt range

                    // Iteratively reduce font size if text would overflow
                    doc.setFont('helvetica', 'bold')
                    let codeLines = []
                    let attempts = 0
                    const maxCodeLines = estimatedChars > 50 ? 3 : (height < 2 ? 1 : 2)

                    while (attempts < 20) {
                        doc.setFontSize(codeFontSize)
                        codeLines = doc.splitTextToSize(location.code, contentWidth)

                        // Check if text fits within allowed lines
                        if (codeLines.length <= maxCodeLines) {
                            // Additional check: ensure individual lines aren't too wide
                            let maxLineWidth = 0
                            codeLines.forEach(line => {
                                const lineWidth = doc.getTextWidth(line)
                                if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
                            })

                            // Also check that total text height doesn't exceed allocated space
                            const totalTextHeight = (codeLines.length * codeFontSize * 0.012)

                            if (maxLineWidth <= contentWidth * 1.05 && totalTextHeight <= totalHeaderSpace) {
                                break // Text fits!
                            }
                        }

                        // Reduce font size by 8% and try again
                        codeFontSize *= 0.92
                        attempts++

                        // Safety minimum
                        if (codeFontSize < 12) {
                            codeFontSize = 12
                            doc.setFontSize(codeFontSize)
                            codeLines = doc.splitTextToSize(location.code, contentWidth)
                            break
                        }
                    }

                    const truncatedCode = codeLines.slice(0, maxCodeLines)
                    const lineHeight = codeFontSize * 0.012
                    truncatedCode.forEach((line, index) => {
                        doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
                    })
                    currentY += lineHeight * truncatedCode.length + (0.02 * scaleFactor)
                }

                if (showStructure && structure.length > 0) {
                    // Structure text - moderately sized
                    const availableWidth = contentWidth
                    const structureText = structure.map((s: any) => `${s.label}: ${s.value}`).join(' • ')
                    const estimatedChars = structureText.length

                    const baseSize = Math.min(width, height) * 2.4
                    const lengthAdjustment = Math.max(0.4, Math.min(1.2, 60 / Math.sqrt(estimatedChars)))

                    let structFontSize = Math.max(6, Math.min(28, baseSize * lengthAdjustment))

                    // Iteratively reduce font size if text would overflow
                    doc.setFont('helvetica', 'normal')
                    let structLines = []
                    let attempts = 0
                    const maxStructLines = estimatedChars > 80 ? 2 : 1

                    while (attempts < 20) {
                        doc.setFontSize(structFontSize)
                        structLines = doc.splitTextToSize(structureText, contentWidth)

                        if (structLines.length <= maxStructLines) {
                            let maxLineWidth = 0
                            structLines.forEach(line => {
                                const lineWidth = doc.getTextWidth(line)
                                if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
                            })

                            if (maxLineWidth <= contentWidth * 1.05) {
                                break
                            }
                        }

                        structFontSize *= 0.92
                        attempts++

                        if (structFontSize < 5) {
                            structFontSize = 5
                            doc.setFontSize(structFontSize)
                            structLines = doc.splitTextToSize(structureText, contentWidth)
                            break
                        }
                    }

                    const truncatedStruct = structLines.slice(0, maxStructLines)
                    const lineHeight = structFontSize * 0.012
                    truncatedStruct.forEach((line, index) => {
                        doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
                    })
                    currentY += lineHeight * truncatedStruct.length + (0.015 * scaleFactor)
                }

                if (showDescription && location.description) {
                    // Description - moderately sized
                    const availableWidth = contentWidth
                    const estimatedChars = location.description.length

                    const baseSize = Math.min(width, height) * 2.4
                    const lengthAdjustment = Math.max(0.4, Math.min(1.2, 60 / Math.sqrt(estimatedChars)))

                    let descFontSize = Math.max(6, Math.min(28, baseSize * lengthAdjustment))

                    // Iteratively reduce font size if text would overflow
                    doc.setFont('helvetica', 'italic')
                    let descLines = []
                    let attempts = 0
                    const maxDescLines = estimatedChars > 80 ? 2 : 1

                    while (attempts < 20) {
                        doc.setFontSize(descFontSize)
                        descLines = doc.splitTextToSize(location.description, contentWidth)

                        if (descLines.length <= maxDescLines) {
                            let maxLineWidth = 0
                            descLines.forEach(line => {
                                const lineWidth = doc.getTextWidth(line)
                                if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
                            })

                            if (maxLineWidth <= contentWidth * 1.05) {
                                break
                            }
                        }

                        descFontSize *= 0.92
                        attempts++

                        if (descFontSize < 5) {
                            descFontSize = 5
                            doc.setFontSize(descFontSize)
                            descLines = doc.splitTextToSize(location.description, contentWidth)
                            break
                        }
                    }

                    const truncatedDesc = descLines.slice(0, maxDescLines)
                    const lineHeight = descFontSize * 0.012
                    truncatedDesc.forEach((line, index) => {
                        doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
                    })
                    currentY += lineHeight * truncatedDesc.length + (0.015 * scaleFactor)
                }

                // Add separator line after header
                if (hasHeader && (needsQR || needsBarcode)) {
                    doc.setDrawColor(200, 200, 200)
                    doc.setLineWidth(0.003)
                    doc.line(margin, currentY, width - margin, currentY)
                    currentY += 0.03 * scaleFactor
                }
            }

            // ========== CODE SECTION ==========
            const availableCodeHeight = height - currentY - margin

            if (needsQR || needsBarcode) {
                const codeStartY = currentY

                if (needsQR) {
                    // QR CODE - use maximum width
                    const maxQRSize = Math.min(
                        contentWidth * 0.85,
                        availableCodeHeight * 0.75,
                        Math.max(width, height) * 0.7
                    )

                    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, {
                        width: 500,
                        margin: 1,
                        errorCorrectionLevel: 'M'
                    })

                    const qrX = (width - maxQRSize) / 2
                    const qrY = codeStartY + ((availableCodeHeight - maxQRSize) / 2)
                    doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, maxQRSize, maxQRSize)

                } else if (needsBarcode) {
                    // BARCODE - use maximum width
                    const canvas = document.createElement('canvas')
                    try {
                        JsBarcode(canvas, barcodeValue, {
                            format: 'CODE128',
                            width: 3,
                            height: Math.max(100, height * 30),
                            displayValue: showBarcode,
                            fontSize: Math.max(14, Math.min(20, width * 4)),
                            textMargin: 5,
                            margin: 10
                        })

                        const barcodeDataUrl = canvas.toDataURL('image/png')
                        const barcodeDisplayWidth = contentWidth * 0.95
                        const barcodeDisplayHeight = Math.min(availableCodeHeight * 0.8, height * 0.5)
                        const barcodeX = (width - barcodeDisplayWidth) / 2
                        const barcodeY = codeStartY + ((availableCodeHeight - barcodeDisplayHeight) / 2)

                        doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeDisplayWidth, barcodeDisplayHeight)
                    } catch (err) {
                        console.error('Barcode generation failed:', err)
                        toast.error('Barcode generation failed: ' + (err as Error).message)
                    }
                }
            }

            // Add border
            doc.setDrawColor(180, 180, 180)
            doc.setLineWidth(0.005)
            doc.rect(0.02, 0.02, width - 0.04, height - 0.04)

            const locationIdentifier = location.code.replace(/[^a-zA-Z0-9-]/g, '_')
            const timestamp = new Date().toISOString().slice(0, 10)
            doc.save(`location-label-${locationIdentifier}-${width}x${height}-${timestamp}.pdf`)

            toast.success("Label generated successfully!")
            onOpenChange(false)
        } catch (error) {
            console.error("Failed to generate label:", error)
            toast.error("Failed to generate label. Please try again.")
        } finally {
            setIsGeneratingLabel(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <QrCode className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        Generate Location Label
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                        Generate a printable label with QR code or barcode for this location.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 py-0">
                    {/* Preview */}
                    <div className="border-2 border-dashed rounded-lg p-2 sm:p-3 bg-white text-black overflow-hidden">
                        <div className="space-y-1.5 sm:space-y-2">
                            {(showLocationCode || showStructure || showDescription) && (
                                <div className="text-center border-b border-gray-300 pb-1.5">
                                    {showLocationCode && (
                                        <h3 className="font-bold text-xs sm:text-sm line-clamp-1">
                                            {location.code}
                                        </h3>
                                    )}
                                    {showStructure && structure.length > 0 && (
                                        <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-1 mt-0.5">
                                            {structure.map(s => `${s.label}: ${s.value}`).join(' • ')}
                                        </p>
                                    )}
                                    {showDescription && location.description && (
                                        <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-1 mt-0.5">
                                            {location.description}
                                        </p>
                                    )}
                                </div>
                            )}

                            {(codeType === "qr" || codeType === "barcode") && (
                                <>
                                    {codeType === "qr" ? (
                                        <div className="flex justify-center py-1">
                                            <div className="w-32 h-32 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                                                <div className="text-center">
                                                    <QrCode className="h-16 w-16 mx-auto text-gray-400" />
                                                    <p className="text-[10px] text-gray-500 mt-1">QR Code</p>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="py-1">
                                            <div className="h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50 w-full">
                                                <div className="text-center w-full px-2">
                                                    <Barcode className="h-10 w-10 mx-auto text-gray-400" />
                                                    {showBarcode && (
                                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                                            {location.barcode || location.code}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Configuration */}
                    <div className="space-y-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-semibold">Label Configuration</Label>
                            <div className="grid grid-cols-4 gap-2">
                                <div className="space-y-1">
                                    <Label htmlFor="labelWidth" className="text-[10px] text-muted-foreground">
                                        Width (in)
                                    </Label>
                                    <Input
                                        id="labelWidth"
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        max="12"
                                        value={labelWidth}
                                        onChange={(e) => setLabelWidth(e.target.value)}
                                        className="h-7 text-xs"
                                        placeholder="4"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="labelHeight" className="text-[10px] text-muted-foreground">
                                        Height (in)
                                    </Label>
                                    <Input
                                        id="labelHeight"
                                        type="number"
                                        step="0.1"
                                        min="0.5"
                                        max="12"
                                        value={labelHeight}
                                        onChange={(e) => setLabelHeight(e.target.value)}
                                        className="h-7 text-xs"
                                        placeholder="6"
                                    />
                                </div>
                                <div className="col-span-2 space-y-1">
                                    <Label htmlFor="codeType" className="text-[10px] text-muted-foreground">
                                        Code Type
                                    </Label>
                                    <Select value={codeType} onValueChange={(value: any) => setCodeType(value)}>
                                        <SelectTrigger id="codeType" className="h-7 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="qr" className="text-xs">
                                                QR Code
                                            </SelectItem>
                                            <SelectItem value="barcode" className="text-xs">
                                                Barcode
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="border rounded-lg p-2 bg-muted/30 space-y-1">
                            <Label className="text-xs font-semibold">Label Fields</Label>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="showLocationCode" className="text-xs font-normal cursor-pointer">
                                        Code
                                    </Label>
                                    <Switch
                                        id="showLocationCode"
                                        checked={showLocationCode}
                                        onCheckedChange={setShowLocationCode}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="showStructure" className="text-xs font-normal cursor-pointer">
                                        Structure
                                    </Label>
                                    <Switch
                                        id="showStructure"
                                        checked={showStructure}
                                        onCheckedChange={setShowStructure}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="showBarcode" className="text-xs font-normal cursor-pointer">
                                        Code #
                                    </Label>
                                    <Switch
                                        id="showBarcode"
                                        checked={showBarcode}
                                        onCheckedChange={setShowBarcode}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="showDescription" className="text-xs font-normal cursor-pointer">
                                        Desc
                                    </Label>
                                    <Switch
                                        id="showDescription"
                                        checked={showDescription}
                                        onCheckedChange={setShowDescription}
                                        className="scale-75"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="h-8 text-xs"
                        disabled={isGeneratingLabel}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={generateLocationLabel}
                        disabled={isGeneratingLabel}
                        className="gap-2 h-8 text-xs"
                    >
                        {isGeneratingLabel ? (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            "Download PDF"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}