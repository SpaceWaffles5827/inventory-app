"use client"

import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { cn } from "@/lib/utils"
import type { StockDirection } from "./stock-utils"

const OPTIONS: { value: StockDirection; label: string; hint: string; icon: typeof ArrowDownToLine }[] = [
  { value: "in", label: "Stock in", hint: "Add", icon: ArrowDownToLine },
  { value: "out", label: "Stock out", hint: "Remove", icon: ArrowUpFromLine },
]

/** Segmented Add / Remove switch */
export function DirectionToggle({
  value,
  onChange,
  className,
}: {
  value: StockDirection
  onChange: (value: StockDirection) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Adjustment type"
      className={cn("grid grid-cols-2 gap-1 rounded-xl border bg-muted p-1", className)}
    >
      {OPTIONS.map(({ value: v, label, hint, icon: Icon }) => {
        const active = value === v
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault()
                const other = v === "in" ? "out" : "in"
                onChange(other)
                e.currentTarget.parentElement
                  ?.querySelector<HTMLButtonElement>(`[data-testid="stock-direction-${other}"]`)
                  ?.focus()
              }
            }}
            tabIndex={active ? 0 : -1}
            data-testid={`stock-direction-${v}`}
            className={cn(
              "flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-all outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              active
                ? cn("bg-card shadow-sm", v === "in" ? "text-success" : "text-destructive")
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
            <span className="sr-only">({hint})</span>
          </button>
        )
      })}
    </div>
  )
}
