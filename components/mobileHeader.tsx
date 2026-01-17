// components/mobileHeader.tsx
"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Package, Plus, Search } from "lucide-react"

interface MobileHeaderProps {
    title?: string
    onAddClick?: () => void
    showAddButton?: boolean
    showSearch?: boolean
    searchValue?: string
    onSearchChange?: (value: string) => void
    searchPlaceholder?: string
}

export function MobileHeader({
    title = "StockFlow",
    onAddClick,
    showAddButton = false,
    showSearch = false,
    searchValue = "",
    onSearchChange,
    searchPlaceholder = "Search..."
}: MobileHeaderProps) {
    return (
        <div className="lg:hidden fixed top-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-b border-border/40 z-50">
            <div className="flex items-center gap-3 px-4 h-14">
                {showSearch && (
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={searchPlaceholder}
                            value={searchValue}
                            onChange={(e) => onSearchChange?.(e.target.value)}
                            className="pl-9 h-9 text-sm"
                        />
                    </div>
                )}

                {showAddButton && onAddClick && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onAddClick}
                        className="text-primary h-8 gap-1.5 shrink-0"
                    >
                        <Plus className="h-4 w-4" />
                        Add
                    </Button>
                )}
            </div>
        </div>
    )
}