"use client"

import { Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const MAX_DIGITS = 9

interface QuantityStepperProps {
  /** null = empty field */
  value: number | null
  onChange: (value: number | null) => void
  min?: number
  /** Upper bound for the + button. Typed values above it are allowed so the caller can explain the limit. */
  max?: number
  step?: number
  id?: string
  unit?: string | null
  disabled?: boolean
  autoFocus?: boolean
  invalid?: boolean
  /** Called when the user types a leading "+" or "-" (e.g. "-3"). The sign is stripped from the value. */
  onSign?: (sign: "+" | "-") => void
  placeholder?: string
  inputTestId?: string
  "aria-label"?: string
  "aria-describedby"?: string
  className?: string
}

/** Big touch-friendly −/+ quantity input for the warehouse floor. Whole units only. */
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  id,
  unit,
  disabled,
  autoFocus,
  invalid,
  onSign,
  placeholder = "0",
  inputTestId,
  className,
  ...aria
}: QuantityStepperProps) {
  const current = value ?? 0
  const canDecrement = !disabled && current - step >= min
  const canIncrement = !disabled && (max === undefined || current + step <= max)

  const handleText = (raw: string) => {
    const text = raw.trim()
    const sign = text.startsWith("+") ? "+" : text.startsWith("-") || text.startsWith("−") ? "-" : null
    if (sign) onSign?.(sign)
    const digits = text.replace(/[^0-9]/g, "").slice(0, MAX_DIGITS)
    onChange(digits === "" ? null : Number.parseInt(digits, 10))
  }

  return (
    <div className={cn("flex items-stretch gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        className="size-12 shrink-0 rounded-lg [&_svg:not([class*='size-'])]:size-5"
        onClick={() => onChange(Math.max(min, current - step))}
        disabled={!canDecrement}
        aria-label="Decrease quantity"
      >
        <Minus />
      </Button>
      <div className="relative min-w-0 flex-1">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="next"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          value={value === null ? "" : String(value)}
          onChange={(e) => handleText(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          data-testid={inputTestId}
          className={cn(
            "h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 text-center text-xl font-semibold tabular-nums shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground/60 dark:bg-input/30",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
            "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
            "disabled:cursor-not-allowed disabled:opacity-50",
            unit && "pr-12"
          )}
          {...aria}
        />
        {unit && (
          <span className="pointer-events-none absolute right-3 top-1/2 max-w-10 -translate-y-1/2 truncate text-xs text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        className="size-12 shrink-0 rounded-lg [&_svg:not([class*='size-'])]:size-5"
        onClick={() => onChange(max === undefined ? current + step : Math.min(max, current + step))}
        disabled={!canIncrement}
        aria-label="Increase quantity"
      >
        <Plus />
      </Button>
    </div>
  )
}
