"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Diff, ArrowRightLeft, Trash2 } from "lucide-react"
import { ItemImage } from "@/components/imageItem"
import { ItemWithRelations } from "@/lib/api/items.api"

interface ItemTableViewProps {
    items: ItemWithRelations[]
    onAdjustmentClick: (item: ItemWithRelations) => void
    onTransferClick: (item: ItemWithRelations) => void
    onDeleteClick: (item: ItemWithRelations) => void
}

export function ItemTableView({
    items,
    onAdjustmentClick,
    onTransferClick,
    onDeleteClick
}: ItemTableViewProps) {
    const router = useRouter()

    if (items.length === 0) {
        return (
            <div className="rounded-lg border border-border/50 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[60px]"></TableHead>
                            <TableHead className="font-semibold">Item #</TableHead>
                            <TableHead className="font-semibold">Product Name</TableHead>
                            <TableHead className="text-center font-semibold">Stock</TableHead>
                            <TableHead className="text-right font-semibold">Cost</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="text-center font-semibold">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                No items found matching your filters
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        )
    }

    return (
        <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[60px]"></TableHead>
                        <TableHead className="font-semibold">Item #</TableHead>
                        <TableHead className="font-semibold">Product Name</TableHead>
                        <TableHead className="text-center font-semibold">Stock</TableHead>
                        <TableHead className="text-right font-semibold">Cost</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-center font-semibold">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <TableRow
                            key={item.id}
                            className="hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => router.push(`/dashboard/items/${item.id}`)}
                        >
                            <TableCell>
                                <div className="w-12 h-12 rounded-md bg-muted/50 border border-border flex items-center justify-center overflow-hidden">
                                    <ItemImage
                                        itemId={item.id}
                                        alt={item.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm text-muted-foreground">{item.itemNumber}</TableCell>
                            <TableCell className="max-w-0 w-full">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono truncate">{item.barcode || "—"}</p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-baseline justify-end gap-1.5 pr-4">
                                    <span className="font-semibold text-lg tabular-nums text-right min-w-[3ch]">{item.onHand}</span>
                                    <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-tight w-[3.5ch] text-left">{item.unit || "EA"}</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">${item.cost.toFixed(2)}</TableCell>
                            <TableCell>
                                <Badge
                                    variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                    className={
                                        item.status === "IN_STOCK"
                                            ? "bg-accent/10 text-accent hover:bg-accent/20"
                                            : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                                    }
                                >
                                    {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                                </Badge>
                            </TableCell>
                            <TableCell>
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="flex-1 h-9 hover:bg-accent/10 hover:text-accent bg-transparent"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onAdjustmentClick(item)
                                        }}
                                    >
                                        <Diff className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="flex-1 h-9 hover:bg-blue-500/10 hover:text-blue-600 bg-transparent"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onTransferClick(item)
                                        }}
                                        title="Transfer stock between locations"
                                    >
                                        <ArrowRightLeft className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="flex-1 h-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDeleteClick(item)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}