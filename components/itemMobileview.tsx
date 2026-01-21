"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MoreVertical } from "lucide-react"
import { ItemImage } from "@/components/imageItem"
import { ItemWithRelations } from "@/lib/api/items.api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface ItemMobileViewProps {
    items: ItemWithRelations[]
    onAdjustmentClick: (item: ItemWithRelations) => void
    onDeleteClick: (item: ItemWithRelations) => void
}

export function ItemMobileView({
    items,
    onAdjustmentClick,
    onDeleteClick
}: ItemMobileViewProps) {
    const router = useRouter()

    if (items.length === 0) {
        return (
            <div className="text-center py-12 px-4 text-muted-foreground">
                No items found matching your filters
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {items.map((item) => (
                <div
                    key={item.id}
                    className="flex items-center gap-3 p-4 active:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/items/${item.id}`)}
                >
                    {/* Item Image */}
                    <div className="w-16 h-16 rounded-lg bg-muted/50 border border-border overflow-hidden flex-shrink-0">
                        <ItemImage
                            itemId={item.id}
                            alt={item.name}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                        {/* Item Number */}
                        <p className="text-xs text-muted-foreground font-mono mb-0.5">
                            {item.itemNumber}
                        </p>

                        {/* Item Name */}
                        <h3 className="font-semibold text-base leading-tight mb-1 line-clamp-1">
                            {item.name}
                        </h3>

                        {/* Stock and Value Info */}
                        <div className="flex items-center gap-3 text-sm">
                            <span className="font-medium">
                                {item.onHand} {item.unit?.toLowerCase() || "units"}
                            </span>
                            {item.onHand > 0 && item.cost > 0 && (
                                <>
                                    <span className="text-muted-foreground">|</span>
                                    <span className="text-muted-foreground">
                                        ${(item.onHand * item.cost).toLocaleString()}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Actions Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-10 w-10"
                            >
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/items/${item.id}`)}>
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                onAdjustmentClick(item)
                            }}>
                                Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteClick(item)
                                }}
                            >
                                Delete Item
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ))}
        </div>
    )
}