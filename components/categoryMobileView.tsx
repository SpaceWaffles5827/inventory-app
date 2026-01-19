// components/categoryMobileView.tsx
"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { MoreVertical, FolderOpen } from "lucide-react"
import { CategoryWithCount } from "@/lib/api/categories.api"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface CategoryMobileViewProps {
    categories: CategoryWithCount[]
    onEditClick: (category: CategoryWithCount) => void
    onDeleteClick: (id: string) => void
}

export function CategoryMobileView({
    categories,
    onEditClick,
    onDeleteClick
}: CategoryMobileViewProps) {
    const router = useRouter()

    if (categories.length === 0) {
        return (
            <div className="text-center py-12 px-4 text-muted-foreground">
                No categories found. Create your first category to get started.
            </div>
        )
    }

    return (
        <div className="divide-y divide-border">
            {categories.map((category) => (
                <div
                    key={category.id}
                    className="flex items-center gap-3 p-4 active:bg-muted/50 transition-colors"
                    onClick={() => router.push(`/dashboard/categories/${category.id}`)}
                >
                    {/* Category Icon */}
                    <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0">
                        <FolderOpen className="h-5 w-5 text-accent" />
                    </div>

                    {/* Category Info */}
                    <div className="flex-1 min-w-0">
                        {/* Category Name */}
                        <h3 className="font-semibold text-base leading-tight mb-1">
                            {category.name}
                        </h3>

                        {/* Description */}
                        {category.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                                {category.description}
                            </p>
                        )}

                        {/* Stats Row */}
                        <div className="flex items-center gap-3 text-sm">
                            <span className="font-medium text-accent">
                                {category.itemCount} {category.itemCount === 1 ? 'item' : 'items'}
                            </span>
                            <span className="text-muted-foreground">|</span>
                            <span className="text-muted-foreground text-xs">
                                {new Date(category.createdAt).toLocaleDateString()}
                            </span>
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
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/categories/${category.id}`)}>
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation()
                                onEditClick(category)
                            }}>
                                Edit Category
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDeleteClick(category.id)
                                }}
                            >
                                Delete Category
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            ))}
        </div>
    )
}