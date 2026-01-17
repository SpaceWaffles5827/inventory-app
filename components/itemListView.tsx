"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Diff, Trash2 } from "lucide-react"
import { ItemImage } from "@/components/imageItem"
import { ItemWithRelations } from "@/lib/api/items.api"

interface ItemListViewProps {
    items: ItemWithRelations[]
    onAdjustmentClick: (item: ItemWithRelations) => void
    onDeleteClick: (item: ItemWithRelations) => void
}

export function ItemListView({
    items,
    onAdjustmentClick,
    onDeleteClick
}: ItemListViewProps) {
    const router = useRouter()

    if (items.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                No items found matching your filters
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {items.map((item) => (
                <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-accent/50 overflow-hidden"
                    onClick={() => router.push(`/dashboard/items/${item.id}`)}
                >
                    <CardContent className="pt-0 pb-0">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-20 h-20 rounded-md bg-muted/50 border border-border overflow-hidden flex-shrink-0">
                                <ItemImage
                                    itemId={item.id}
                                    alt={item.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-start gap-3 mb-1 min-w-0">
                                    <h3 className="font-semibold text-base line-clamp-2 break-words flex-1 min-w-0 overflow-hidden" title={item.name}>
                                        {item.name}
                                    </h3>
                                    <Badge
                                        variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                        className={
                                            item.status === "IN_STOCK"
                                                ? "bg-accent/10 text-accent flex-shrink-0"
                                                : "bg-destructive/10 text-destructive flex-shrink-0"
                                        }
                                    >
                                        {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out of Stock"}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap min-w-0">
                                    <span className="font-mono">{item.itemNumber}</span>
                                    <span className="text-xs truncate min-w-0">
                                        {item.locations && item.locations.filter(loc => loc.quantity > 0).length > 0
                                            ? item.locations
                                                .filter(loc => loc.quantity > 0)
                                                .map(loc => `${loc.location.code} (${loc.quantity})`)
                                                .join(', ')
                                            : "Unassigned"}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-6 flex-none">
                                <div className="text-center">
                                    <p className="text-xs text-muted-foreground mb-1">Stock</p>
                                    <div className="flex items-baseline gap-1.5 justify-center">
                                        <p className="text-2xl font-semibold tabular-nums text-right min-w-[3ch]">{item.onHand}</p>
                                        <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-tight w-[4ch] text-left">{item.unit || "EA"}</span>
                                    </div>
                                </div>
                                <div className="text-center min-w-[70px]">
                                    <p className="text-xs text-muted-foreground mb-1">Cost</p>
                                    <p className="text-base font-medium">${item.cost.toFixed(2)}</p>
                                </div>
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
                                        className="flex-1 h-9 hover:bg-destructive/10 hover:text-destructive bg-transparent"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onDeleteClick(item)
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}