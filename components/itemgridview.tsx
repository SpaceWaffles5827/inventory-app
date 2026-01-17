"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Diff, Trash2 } from "lucide-react"
import { ItemImage } from "@/components/imageItem"
import { ItemWithRelations } from "@/lib/api/items.api"

interface ItemGridViewProps {
    items: ItemWithRelations[]
    onAdjustmentClick: (item: ItemWithRelations) => void
    onDeleteClick: (item: ItemWithRelations) => void
}

export function ItemGridView({
    items,
    onAdjustmentClick,
    onDeleteClick
}: ItemGridViewProps) {
    const router = useRouter()

    if (items.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                No items found matching your filters
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {items.map((item) => (
                <Card
                    key={item.id}
                    className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-accent/50 flex flex-col pt-0 overflow-hidden"
                    onClick={() => router.push(`/dashboard/items/${item.id}`)}
                >
                    <div className="relative w-full h-48 bg-muted/30 border-b border-border overflow-hidden">
                        <ItemImage
                            itemId={item.id}
                            alt={item.name}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <CardHeader className="pb-3 flex-none pt-0">
                        <div className="space-y-2">
                            <div className="min-w-0 overflow-hidden h-[52px]">
                                <CardTitle
                                    className="text-base font-semibold line-clamp-2 break-words"
                                    title={item.name}
                                >
                                    {item.name}
                                </CardTitle>
                                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{item.itemNumber}</p>
                            </div>
                            <Badge
                                variant={item.status === "IN_STOCK" ? "default" : "destructive"}
                                className={
                                    item.status === "IN_STOCK"
                                        ? "bg-accent/10 text-accent w-fit"
                                        : "bg-destructive/10 text-destructive w-fit"
                                }
                            >
                                {item.status === "IN_STOCK" ? "In Stock" : item.status === "LOW_STOCK" ? "Low Stock" : "Out"}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 flex-1 flex flex-col justify-between pt-0">
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Stock</p>
                                    <div className="flex items-baseline gap-1.5">
                                        <p className="text-2xl font-bold tabular-nums">{item.onHand}</p>
                                        <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-tight">{item.unit || "EA"}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1">Cost</p>
                                    <p className="text-lg font-semibold">${item.cost.toFixed(2)}</p>
                                </div>
                            </div>
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
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}