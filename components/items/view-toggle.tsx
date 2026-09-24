"use client"

import { LayoutGrid, List, Table2, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type InventoryViewMode = "table" | "grid" | "list"

const VIEW_OPTIONS: { value: InventoryViewMode; label: string; icon: LucideIcon }[] = [
  { value: "table", label: "Table", icon: Table2 },
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
]

const STORAGE_KEY = "inventoryViewMode"

export function readStoredViewMode(): InventoryViewMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === "grid" || saved === "list" || saved === "table" ? saved : "table"
  } catch {
    return "table"
  }
}

export function storeViewMode(mode: InventoryViewMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // storage unavailable (private mode) — the choice just isn't remembered
  }
}

/** Segmented control for switching between inventory layouts */
export function ViewToggle({
  value,
  onChange,
  className,
}: {
  value: InventoryViewMode
  onChange: (mode: InventoryViewMode) => void
  className?: string
}) {
  return (
    <div role="group" aria-label="Layout" className={cn("inline-flex h-9 items-center rounded-md border bg-muted/50 p-0.5", className)}>
      {VIEW_OPTIONS.map(({ value: mode, label, icon: Icon }) => {
        const active = value === mode
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={active}
            aria-label={`${label} view`}
            title={`${label} view`}
            onClick={() => onChange(mode)}
            data-testid={`view-toggle-${mode}`}
            className={cn(
              "flex h-full items-center justify-center rounded-[5px] px-2.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "bg-background text-foreground shadow-xs"
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
