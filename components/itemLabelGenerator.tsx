"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { QrCode, Barcode, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"

interface ItemLabelGeneratorProps {
    item: {
        id: string
        name: string
        description?: string | null
        itemNumber: string
        sku?: string | null
        barcode?: string | null
        unit?: string | null
        cost: number
        unitPrice?: number | null
    }
    trigger?: React.ReactNode
}

export function ItemLabelGenerator({ item, trigger }: ItemLabelGeneratorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    // Initialize from session storage or use defaults
    const [labelWidth, setLabelWidth] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('itemLabelWidth') || "4"
        }
        return "4"
    })
    const [labelHeight, setLabelHeight] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('itemLabelHeight') || "6"
        }
        return "6"
    })

    const [codeType, setCodeType] = useState<"qr" | "barcode" | "both">("qr")

    // Field visibility state
    const [showName, setShowName] = useState(true)
    const [showDescription, setShowDescription] = useState(true)
    const [showSKU, setShowSKU] = useState(true)
    const [showUnit, setShowUnit] = useState(true)
    const [showBarcode, setShowBarcode] = useState(true)
    const [showPrice, setShowPrice] = useState(false)

    // Save to session storage whenever width or height changes
    const handleWidthChange = (value: string) => {
        setLabelWidth(value)
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('itemLabelWidth', value)
        }
    }

    const handleHeightChange = (value: string) => {
        setLabelHeight(value)
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('itemLabelHeight', value)
        }
    }

    const generateItemLabel = async () => {
        setIsGenerating(true)
        try {
            const QRCode = (await import('qrcode')).default
            const JsBarcode = (await import('jsbarcode')).default
            const { jsPDF } = await import('jspdf')

            // Parse label size from inputs
            const width = parseFloat(labelWidth) || 4
            const height = parseFloat(labelHeight) || 6

            // Validate dimensions
            if (width <= 0 || width > 12 || height <= 0 || height > 12) {
                toast.error("Label dimensions must be between 0 and 12 inches")
                setIsGenerating(false)
                return
            }

            const doc = new jsPDF({
                orientation: width > height ? 'landscape' : 'portrait',
                unit: 'in',
                format: [width, height]
            })

            // Scale-aware margins and spacing
            const scaleFactor = Math.min(width, height) / 4
            const margin = 0.1 * scaleFactor
            const contentWidth = width - (margin * 2)
            const contentHeight = height - (margin * 2)
            let currentY = margin

            // Calculate what we need to show
            const hasHeader = showName || showDescription
            const hasFooter = showSKU || showUnit || showPrice
            const needsQR = codeType === 'qr' || codeType === 'both'
            const needsBarcode = (codeType === 'barcode' || codeType === 'both') && item.barcode
            const needsBothCodes = needsQR && needsBarcode

            // Get barcode value for QR code
            const barcodeValue = item.barcode || item.itemNumber || item.sku || `ITEM-${item.id}`

            // ========== HEADER SECTION ==========
            if (hasHeader) {
                if (showName) {
                    // Calculate optimal font size based on available width and content length
                    const availableWidth = contentWidth
                    const estimatedChars = item.name.length

                    // Start with a base size relative to label dimensions - 3x larger
                    const baseSize = Math.min(width, height) * 8.4 // Base scaling factor (2.8 * 3)

                    // Adjust for content length (longer names = smaller font)
                    // More aggressive reduction for very long names
                    const lengthAdjustment = Math.max(0.3, Math.min(1.3, 40 / Math.sqrt(estimatedChars)))

                    // Calculate initial size with reasonable bounds - 3x larger
                    let nameFontSize = Math.max(8, Math.min(96, baseSize * lengthAdjustment))

                    // Iteratively reduce font size if text would overflow
                    doc.setFont('helvetica', 'bold')
                    let nameLines = []
                    let attempts = 0
                    // Allow more lines for longer text
                    const maxNameLines = estimatedChars > 100 ? 4 : (height < 2 ? 1 : 3)

                    while (attempts < 20) {
                        doc.setFontSize(nameFontSize)
                        nameLines = doc.splitTextToSize(item.name, contentWidth)

                        // Check if text fits within allowed lines
                        if (nameLines.length <= maxNameLines) {
                            // Additional check: ensure individual lines aren't too wide
                            let maxLineWidth = 0
                            nameLines.forEach(line => {
                                const lineWidth = doc.getTextWidth(line)
                                if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
                            })

                            if (maxLineWidth <= contentWidth * 1.05) { // Allow 5% overflow tolerance
                                break // Text fits!
                            }
                        }

                        // Reduce font size by 8% and try again (more aggressive)
                        nameFontSize *= 0.92
                        attempts++

                        // Safety minimum - lower for super long names
                        if (nameFontSize < 6) {
                            nameFontSize = 6
                            doc.setFontSize(nameFontSize)
                            nameLines = doc.splitTextToSize(item.name, contentWidth)
                            break
                        }
                    }

                    const truncatedName = nameLines.slice(0, maxNameLines)
                    const lineHeight = nameFontSize * 0.012
                    truncatedName.forEach((line, index) => {
                        doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
                    })
                    currentY += lineHeight * truncatedName.length + (0.03 * scaleFactor)
                }

                if (showDescription && item.description) {
                    // Description should be moderately sized - increased from previous
                    const availableWidth = contentWidth
                    const estimatedChars = item.description.length

                    const baseSize = Math.min(width, height) * 2.4 // Increased from 1.6
                    // More aggressive reduction for very long descriptions
                    const lengthAdjustment = Math.max(0.4, Math.min(1.2, 60 / Math.sqrt(estimatedChars)))

                    let descFontSize = Math.max(6, Math.min(28, baseSize * lengthAdjustment))

                    // Iteratively reduce font size if text would overflow
                    doc.setFont('helvetica', 'normal')
                    let descLines = []
                    let attempts = 0
                    // Allow more lines for longer descriptions
                    const maxDescLines = estimatedChars > 80 ? 3 : (height < 2 ? 1 : 2)

                    while (attempts < 20) {
                        doc.setFontSize(descFontSize)
                        descLines = doc.splitTextToSize(item.description, contentWidth)

                        // Check if text fits within allowed lines
                        if (descLines.length <= maxDescLines) {
                            // Additional check: ensure individual lines aren't too wide
                            let maxLineWidth = 0
                            descLines.forEach(line => {
                                const lineWidth = doc.getTextWidth(line)
                                if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
                            })

                            if (maxLineWidth <= contentWidth * 1.05) { // Allow 5% overflow tolerance
                                break // Text fits!
                            }
                        }

                        // Reduce font size by 8% and try again
                        descFontSize *= 0.92
                        attempts++

                        // Safety minimum
                        if (descFontSize < 5) {
                            descFontSize = 5
                            doc.setFontSize(descFontSize)
                            descLines = doc.splitTextToSize(item.description, contentWidth)
                            break
                        }
                    }

                    const truncatedDesc = descLines.slice(0, maxDescLines)
                    const lineHeight = descFontSize * 0.012
                    truncatedDesc.forEach((line, index) => {
                        doc.text(line, width / 2, currentY + lineHeight * (index + 1), { align: 'center' })
                    })
                    currentY += lineHeight * truncatedDesc.length + (0.02 * scaleFactor)
                }

                // Add separator line after header
                if (hasHeader && (needsQR || needsBarcode || hasFooter)) {
                    doc.setDrawColor(200, 200, 200)
                    doc.setLineWidth(0.003)
                    doc.line(margin, currentY, width - margin, currentY)
                    currentY += 0.04 * scaleFactor
                }
            }

            // ========== CALCULATE AVAILABLE SPACE FOR CODES ==========
            const footerHeight = hasFooter ? (0.25 + (0.1 * scaleFactor)) : 0
            const availableCodeHeight = height - currentY - footerHeight - margin

            // ========== CODE SECTION ==========
            if (needsQR || needsBarcode) {
                const codeStartY = currentY

                if (needsBothCodes) {
                    // BOTH QR AND BARCODE - Stacked vertically
                    const verticalSpacing = 0.08 * scaleFactor

                    // Calculate sizes for stacked layout - QR uses maximum width
                    const qrSize = Math.min(
                        contentWidth * 0.85,  // Increased from 0.55 to use more width
                        (availableCodeHeight - verticalSpacing) * 0.45,
                        width * 0.75  // Increased from 0.45
                    )

                    const barcodeHeight = Math.min(
                        (availableCodeHeight - verticalSpacing - qrSize) * 0.8,
                        height * 0.2
                    )

                    // QR Code on top - centered
                    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, {
                        width: 200,
                        margin: 0,
                        errorCorrectionLevel: 'M'
                    })

                    const qrX = (width - qrSize) / 2
                    const qrY = codeStartY + ((availableCodeHeight - qrSize - barcodeHeight - verticalSpacing) / 2)
                    doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

                    // Barcode below QR - centered
                    const canvas = document.createElement('canvas')
                    try {
                        const barcodeCanvasHeight = Math.min(60, Math.max(30, height * 15))
                        const barcodeCanvasWidth = Math.max(1.5, width * 0.5)

                        JsBarcode(canvas, barcodeValue, {
                            format: 'CODE128',
                            width: barcodeCanvasWidth,
                            height: barcodeCanvasHeight,
                            displayValue: showBarcode,
                            fontSize: Math.max(8, Math.min(12, width * 2.5)),
                            textMargin: 2,
                            margin: 0
                        })

                        const barcodeDataUrl = canvas.toDataURL('image/png')
                        const barcodeDisplayWidth = contentWidth * 0.95  // Increased from 0.8 to use nearly full width
                        const barcodeX = (width - barcodeDisplayWidth) / 2
                        const barcodeY = qrY + qrSize + verticalSpacing

                        doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeDisplayWidth, barcodeHeight)
                    } catch (err) {
                        console.error('Barcode generation failed:', err)
                    }

                } else if (needsQR) {
                    // QR CODE ONLY - Centered, using maximum width
                    const maxQRSize = Math.min(
                        contentWidth * 0.85,  // Increased from 0.55 to use more width
                        availableCodeHeight * 0.75,
                        Math.max(width, height) * 0.7  // Increased from 0.45
                    )

                    // Generate compact QR Code
                    const qrCodeDataUrl = await QRCode.toDataURL(barcodeValue, {
                        width: 250,
                        margin: 0,
                        errorCorrectionLevel: 'M'
                    })

                    const qrX = (width - maxQRSize) / 2
                    const qrY = codeStartY + ((availableCodeHeight - maxQRSize) / 2)
                    doc.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, maxQRSize, maxQRSize)

                } else if (needsBarcode) {
                    // BARCODE ONLY - Centered and full width
                    const canvas = document.createElement('canvas')
                    try {
                        const barcodeHeight = Math.min(80, Math.max(30, height * 20))
                        const barcodeWidth = Math.max(1.5, width * 0.5)

                        JsBarcode(canvas, barcodeValue, {
                            format: 'CODE128',
                            width: barcodeWidth,
                            height: barcodeHeight,
                            displayValue: showBarcode,
                            fontSize: Math.max(10, Math.min(16, width * 3)),
                            textMargin: 2,
                            margin: 0
                        })

                        const barcodeDataUrl = canvas.toDataURL('image/png')
                        const barcodeDisplayWidth = contentWidth * 0.95  // Increased from 0.75 to use nearly full width
                        const barcodeDisplayHeight = Math.min(availableCodeHeight * 0.6, height * 0.3)
                        const barcodeX = (width - barcodeDisplayWidth) / 2
                        const barcodeY = codeStartY + ((availableCodeHeight - barcodeDisplayHeight) / 2)

                        doc.addImage(barcodeDataUrl, 'PNG', barcodeX, barcodeY, barcodeDisplayWidth, barcodeDisplayHeight)
                    } catch (err) {
                        console.error('Barcode generation failed:', err)
                    }
                }

                currentY = height - footerHeight - margin
            }

            // ========== FOOTER SECTION ==========
            if (hasFooter) {
                // Add separator line before footer
                if (needsQR || needsBarcode) {
                    doc.setDrawColor(200, 200, 200)
                    doc.setLineWidth(0.003)
                    doc.line(margin, currentY, width - margin, currentY)
                    currentY += 0.03 * scaleFactor
                }

                const fontSize = Math.max(8, Math.min(14, width * 2.4))  // Increased from 5-9 and 1.8
                doc.setFontSize(fontSize)
                const lineHeight = fontSize * 0.012

                // Count active fields to determine layout
                const activeFields = [showSKU, showUnit, showPrice].filter(Boolean).length

                if (activeFields === 1) {
                    // Single field - centered
                    doc.setFont('helvetica', 'bold')
                    if (showSKU) {
                        doc.text('SKU:', width / 2, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        const skuText = String(item.itemNumber || item.sku)
                        const skuLines = doc.splitTextToSize(skuText, contentWidth * 0.9)
                        doc.text(skuLines[0], width / 2, currentY + lineHeight * 2, { align: 'center' })
                    } else if (showUnit) {
                        doc.text('Unit:', width / 2, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        doc.text(item.unit || 'EA', width / 2, currentY + lineHeight * 2, { align: 'center' })
                    } else if (showPrice) {
                        doc.text('Price:', width / 2, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        doc.text(`$${(item.unitPrice || item.cost || 0).toFixed(2)}`, width / 2, currentY + lineHeight * 2, { align: 'center' })
                    }
                } else if (activeFields === 2) {
                    // Two fields - side by side
                    const colWidth = contentWidth / 2
                    let col = 0

                    if (showSKU) {
                        const xPos = margin + (col * colWidth) + (colWidth / 2)
                        doc.setFont('helvetica', 'bold')
                        doc.text('SKU:', xPos, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        const skuText = String(item.itemNumber || item.sku)
                        const skuLines = doc.splitTextToSize(skuText, colWidth * 0.85)
                        doc.text(skuLines[0], xPos, currentY + lineHeight * 2, { align: 'center' })
                        col++
                    }
                    if (showUnit) {
                        const xPos = margin + (col * colWidth) + (colWidth / 2)
                        doc.setFont('helvetica', 'bold')
                        doc.text('Unit:', xPos, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        doc.text(item.unit || 'EA', xPos, currentY + lineHeight * 2, { align: 'center' })
                        col++
                    }
                    if (showPrice && col < 2) {
                        const xPos = margin + (col * colWidth) + (colWidth / 2)
                        doc.setFont('helvetica', 'bold')
                        doc.text('Price:', xPos, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        doc.text(`$${(item.unitPrice || item.cost || 0).toFixed(2)}`, xPos, currentY + lineHeight * 2, { align: 'center' })
                    }
                } else if (activeFields === 3) {
                    // Three fields - use abbreviations for small labels
                    const colWidth = contentWidth / 3

                    if (showSKU) {
                        const xPos = margin + (colWidth / 2)
                        doc.setFont('helvetica', 'bold')
                        doc.text('SKU', xPos, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        const skuText = String(item.itemNumber || item.sku)
                        const skuLines = doc.splitTextToSize(skuText, colWidth * 0.85)
                        doc.text(skuLines[0], xPos, currentY + lineHeight * 2, { align: 'center' })
                    }

                    if (showUnit) {
                        const xPos = margin + colWidth + (colWidth / 2)
                        doc.setFont('helvetica', 'bold')
                        doc.text('Unit', xPos, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        doc.text(item.unit || 'EA', xPos, currentY + lineHeight * 2, { align: 'center' })
                    }

                    if (showPrice) {
                        const xPos = margin + (colWidth * 2) + (colWidth / 2)
                        doc.setFont('helvetica', 'bold')
                        doc.text('Price', xPos, currentY + lineHeight, { align: 'center' })
                        doc.setFont('helvetica', 'normal')
                        doc.text(`$${(item.unitPrice || item.cost || 0).toFixed(2)}`, xPos, currentY + lineHeight * 2, { align: 'center' })
                    }
                }
            }

            // Add a subtle border around the entire label
            doc.setDrawColor(180, 180, 180)
            doc.setLineWidth(0.005)
            doc.rect(0.02, 0.02, width - 0.04, height - 0.04)

            // Save PDF
            const itemIdentifier = item.itemNumber || item.sku || item.id
            const timestamp = new Date().toISOString().slice(0, 10)
            doc.save(`label-${itemIdentifier}-${width}x${height}-${timestamp}.pdf`)

            toast.success("Label generated successfully!")
            setIsOpen(false)
        } catch (error) {
            console.error("Failed to generate label:", error)
            toast.error("Failed to generate label. Please try again.")
        } finally {
            setIsGenerating(false)
        }
    }

    return (
        <>
            {trigger ? (
                <div onClick={() => setIsOpen(true)}>{trigger}</div>
            ) : (
                <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
                    <QrCode className="h-4 w-4" />
                    <span className="hidden sm:inline">Label</span>
                </Button>
            )}

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <QrCode className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                            </div>
                            Generate Item Label
                        </DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Generate a printable label with QR code and barcode for this item.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Label Preview and Controls */}
                    <div className="space-y-2 py-0">
                        {/* Label Preview */}
                        <div className="border-2 border-dashed rounded-lg p-2 sm:p-3 bg-white text-black overflow-hidden">
                            <div className="space-y-1.5 sm:space-y-2">
                                {/* Header Section */}
                                {(showName || showDescription) && (
                                    <div className="text-center border-b border-gray-300 pb-1.5">
                                        {showName && (
                                            <h3 className="font-bold text-xs sm:text-sm line-clamp-1">
                                                {item.name}
                                            </h3>
                                        )}
                                        {showDescription && (
                                            <p className="text-[10px] sm:text-xs text-gray-600 line-clamp-1 mt-0.5">
                                                {item.description || "No description"}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Code Display Section */}
                                {(codeType === "qr" || codeType === "barcode" || codeType === "both") && (
                                    <>
                                        {codeType === "both" ? (
                                            <div className="flex flex-col items-center gap-2 py-1">
                                                <div className="w-24 h-24 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                                                    <div className="text-center">
                                                        <QrCode className="h-10 w-10 mx-auto text-gray-400" />
                                                        <p className="text-[8px] text-gray-500 mt-0.5">QR</p>
                                                    </div>
                                                </div>
                                                {item.barcode && (
                                                    <div className="w-32 h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                                                        <div className="text-center w-full px-2">
                                                            <Barcode className="h-8 w-8 mx-auto text-gray-400" />
                                                            <p className="text-[8px] text-gray-500 mt-0.5">Barcode</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : codeType === "qr" ? (
                                            <div className="flex justify-center py-1">
                                                <div className="w-32 h-32 border border-gray-300 rounded flex items-center justify-center bg-gray-50">
                                                    <div className="text-center">
                                                        <QrCode className="h-16 w-16 mx-auto text-gray-400" />
                                                        <p className="text-[10px] text-gray-500 mt-1">QR Code</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : item.barcode ? (
                                            <div className="py-1">
                                                <div className="h-16 border border-gray-300 rounded flex items-center justify-center bg-gray-50 w-full">
                                                    <div className="text-center w-full px-2">
                                                        <Barcode className="h-10 w-10 mx-auto text-gray-400" />
                                                        {showBarcode && (
                                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.barcode}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : null}
                                    </>
                                )}

                                {/* Footer Section */}
                                {(showSKU || showUnit || showPrice) && (
                                    <div className="border-t border-gray-300 pt-1.5 text-[10px]">
                                        {(() => {
                                            const activeFields = [showSKU, showUnit, showPrice].filter(Boolean).length

                                            if (activeFields === 1) {
                                                return (
                                                    <div className="text-center">
                                                        {showSKU && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">SKU:</p>
                                                                <p className="font-mono font-semibold truncate">{item.itemNumber || item.sku}</p>
                                                            </div>
                                                        )}
                                                        {showUnit && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Unit:</p>
                                                                <p className="font-semibold truncate">{item.unit || "EA"}</p>
                                                            </div>
                                                        )}
                                                        {showPrice && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Price:</p>
                                                                <p className="font-semibold">${(item.unitPrice || item.cost || 0).toFixed(2)}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            } else if (activeFields === 2) {
                                                return (
                                                    <div className="grid grid-cols-2 gap-1 text-center">
                                                        {showSKU && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">SKU:</p>
                                                                <p className="font-mono font-semibold truncate px-1">{item.itemNumber || item.sku}</p>
                                                            </div>
                                                        )}
                                                        {showUnit && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Unit:</p>
                                                                <p className="font-semibold truncate px-1">{item.unit || "EA"}</p>
                                                            </div>
                                                        )}
                                                        {showPrice && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Price:</p>
                                                                <p className="font-semibold">${(item.unitPrice || item.cost || 0).toFixed(2)}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            } else {
                                                return (
                                                    <div className="grid grid-cols-3 gap-1 text-center">
                                                        {showSKU && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">SKU</p>
                                                                <p className="font-mono font-semibold truncate text-[8px]">{item.itemNumber || item.sku}</p>
                                                            </div>
                                                        )}
                                                        {showUnit && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Unit</p>
                                                                <p className="font-semibold truncate text-[8px]">{item.unit || "EA"}</p>
                                                            </div>
                                                        )}
                                                        {showPrice && (
                                                            <div>
                                                                <p className="text-gray-600 font-medium">Price</p>
                                                                <p className="font-semibold text-[8px]">${(item.unitPrice || item.cost || 0).toFixed(2)}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            }
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            {/* Compact Size and Code Type */}
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
                                            onChange={(e) => handleWidthChange(e.target.value)}
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
                                            onChange={(e) => handleHeightChange(e.target.value)}
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
                                                    QR Only
                                                </SelectItem>
                                                <SelectItem value="barcode" className="text-xs">
                                                    Barcode Only
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            {/* Compact Field toggles */}
                            <div className="border rounded-lg p-2 bg-muted/30 space-y-1">
                                <Label className="text-xs font-semibold">Label Fields</Label>
                                <div className="grid grid-cols-3 gap-x-2 gap-y-1">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showName" className="text-[14px] font-normal cursor-pointer">
                                            Name
                                        </Label>
                                        <Switch id="showName" checked={showName} onCheckedChange={setShowName} className="scale-[0.65]" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showDescription" className="text-[14px] font-normal cursor-pointer">
                                            Desc
                                        </Label>
                                        <Switch
                                            id="showDescription"
                                            checked={showDescription}
                                            onCheckedChange={setShowDescription}
                                            className="scale-[0.65]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showSKU" className="text-[14px] font-normal cursor-pointer">
                                            SKU
                                        </Label>
                                        <Switch id="showSKU" checked={showSKU} onCheckedChange={setShowSKU} className="scale-[0.65]" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showUnit" className="text-[14px] font-normal cursor-pointer">
                                            Unit
                                        </Label>
                                        <Switch
                                            id="showUnit"
                                            checked={showUnit}
                                            onCheckedChange={setShowUnit}
                                            className="scale-[0.65]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showBarcode" className="text-[14px] font-normal cursor-pointer">
                                            Code #
                                        </Label>
                                        <Switch
                                            id="showBarcode"
                                            checked={showBarcode}
                                            onCheckedChange={setShowBarcode}
                                            className="scale-[0.65]"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="showPrice" className="text-[14px] font-normal cursor-pointer">
                                            Price
                                        </Label>
                                        <Switch id="showPrice" checked={showPrice} onCheckedChange={setShowPrice} className="scale-[0.65]" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                            className="h-8 text-xs"
                            disabled={isGenerating}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={generateItemLabel}
                            disabled={isGenerating}
                            className="gap-2 h-8 text-xs"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Printer className="h-3 w-3" />
                                    Print Label
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}