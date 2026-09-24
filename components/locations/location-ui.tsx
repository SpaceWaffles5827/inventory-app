"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/format"
import type { LocationStructure } from "@/lib/api/locations.api"
import { utilisationTone } from "./types"

/** Thin capacity bar: "45 / 100" with a fill that turns warning ≥ 90% and destructive when over */
export function UtilisationBar({
  units,
  capacity,
  className,
  showLabel = true,
}: {
  units: number
  capacity: number
  className?: string
  showLabel?: boolean
}) {
  const ratio = capacity > 0 ? units / capacity : null
  const tone = utilisationTone(ratio)
  const pct = ratio === null ? 0 : Math.min(100, Math.round(ratio * 100))
  const label = ratio === null ? "No capacity set" : `${Math.round(ratio * 100)}% of capacity used`

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      {showLabel && (
        <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
          <span className="text-muted-foreground">
            {formatNumber(units)} / {formatNumber(capacity)}
          </span>
          <span
            className={cn(
              "font-medium",
              tone === "danger" && "text-destructive",
              tone === "warning" && "text-warning-foreground dark:text-warning",
              tone === "default" && "text-muted-foreground"
            )}
          >
            {ratio === null ? "—" : `${Math.round(ratio * 100)}%`}
          </span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={units}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            tone === "danger" ? "bg-destructive" : tone === "warning" ? "bg-warning" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Icon button that copies a value and briefly shows a check */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Copied to clipboard")
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access")
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-8 shrink-0 text-muted-foreground hover:text-foreground", className)}
      onClick={copy}
      aria-label={label}
      title={label}
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  )
}

/** Inline "Zone A › Aisle 01" chips */
export function StructureChips({
  structure,
  className,
  max,
}: {
  structure: LocationStructure
  className?: string
  /** Show at most this many chips, then "+N" */
  max?: number
}) {
  if (structure.length === 0) return null
  const shown = max ? structure.slice(0, max) : structure
  const hidden = structure.length - shown.length
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((part, i) => (
        <span
          key={`${part.label}-${i}`}
          className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
        >
          {part.label && <span>{part.label}</span>}
          <span className="font-mono font-medium text-foreground">{part.value}</span>
        </span>
      ))}
      {hidden > 0 && <span className="text-xs text-muted-foreground">+{hidden}</span>}
    </div>
  )
}
