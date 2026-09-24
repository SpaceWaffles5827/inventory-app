"use client"

import Link from "next/link"
import { Eye, FolderTree, Pencil, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { RowActions } from "@/components/partners/row-actions"
import type { CategoryRow } from "@/components/catalog/category-row"
import { formatCurrencyCompact, formatNumber } from "@/lib/format"

interface CategoryMobileViewProps {
    categories: CategoryRow[]
    onEditClick: (category: CategoryRow) => void
    /** Omit to hide the delete action (non-admins) */
    onDeleteClick?: (category: CategoryRow) => void
}

/** Stacked card list of categories for phones (the page shows a table from `md` up). */
export function CategoryMobileView({ categories, onEditClick, onDeleteClick }: CategoryMobileViewProps) {
    return (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {categories.map((category) => {
                const href = `/dashboard/categories/${category.id}`
                const meta = [
                    `${formatNumber(category.itemCount)} ${category.itemCount === 1 ? "item" : "items"}`,
                    category.units !== null && category.itemCount > 0 ? `${formatNumber(category.units)} units` : null,
                    category.value !== null && category.value > 0 ? formatCurrencyCompact(category.value) : null,
                ].filter(Boolean)

                return (
                    <li
                        key={category.id}
                        className="relative flex items-center gap-3 p-4 transition-colors active:bg-accent/60"
                        data-testid={`category-row-${category.id}`}
                    >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FolderTree className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <Link
                                href={href}
                                className="block truncate font-medium after:absolute after:inset-0 after:content-['']"
                            >
                                {category.name}
                            </Link>
                            {category.description && (
                                <p className="truncate text-sm text-muted-foreground">{category.description}</p>
                            )}
                            <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{meta.join(" · ")}</p>
                        </div>
                        {category.lowStock !== null && category.lowStock > 0 && (
                            <Badge variant="warning" className="tabular-nums">
                                {formatNumber(category.lowStock)} low
                            </Badge>
                        )}
                        <RowActions
                            className="relative z-10"
                            label={`Actions for ${category.name}`}
                            actions={[
                                { label: "View items", icon: Eye, href },
                                { label: "Edit", icon: Pencil, onSelect: () => onEditClick(category) },
                                {
                                    label: "Delete",
                                    icon: Trash2,
                                    destructive: true,
                                    separated: true,
                                    hidden: !onDeleteClick,
                                    onSelect: () => onDeleteClick?.(category),
                                },
                            ]}
                        />
                    </li>
                )
            })}
        </ul>
    )
}
