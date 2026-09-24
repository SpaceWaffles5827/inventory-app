"use client"

import type { KeyboardEvent, ReactNode } from "react"
import { cn } from "@/lib/utils"

const NAV_KEYS = new Set(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"])

/**
 * Radio-group container for big, tappable option rows. Arrow keys / Home / End move the selection,
 * Enter on an option selects it and advances (see OptionRow `onConfirm`).
 */
export function OptionList({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!NAV_KEYS.has(e.key)) return
    const radios = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)')
    )
    if (radios.length === 0) return
    const index = radios.indexOf(document.activeElement as HTMLButtonElement)
    let next = index
    if (e.key === "Home") next = 0
    else if (e.key === "End") next = radios.length - 1
    else if (e.key === "ArrowDown" || e.key === "ArrowRight") next = index < 0 ? 0 : (index + 1) % radios.length
    else next = index <= 0 ? radios.length - 1 : index - 1
    e.preventDefault()
    radios[next].focus()
    radios[next].click()
  }

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={handleKeyDown} className={cn("space-y-2", className)}>
      {children}
    </div>
  )
}

interface OptionRowProps {
  selected: boolean
  onSelect: () => void
  /** Enter / double-click: select and move on to the next step */
  onConfirm?: () => void
  title: ReactNode
  titleClassName?: string
  subtitle?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  disabled?: boolean
  /** Roving tab stop: only one option in the group should be tabbable */
  tabbable?: boolean
  "data-testid"?: string
}

export function OptionRow({
  selected,
  onSelect,
  onConfirm,
  title,
  titleClassName = "font-mono",
  subtitle,
  leading,
  trailing,
  disabled,
  tabbable = true,
  "data-testid": testId,
}: OptionRowProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={tabbable ? 0 : -1}
      disabled={disabled}
      data-testid={testId}
      onClick={onSelect}
      onDoubleClick={onConfirm}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onConfirm) {
          e.preventDefault()
          onSelect()
          onConfirm()
        }
      }}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-xl border bg-card px-3.5 py-2.5 text-left outline-none transition-colors",
        "hover:border-primary/40 hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        selected && "border-primary bg-primary/5 ring-1 ring-primary hover:border-primary hover:bg-primary/5"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected ? "border-primary" : "border-muted-foreground/40"
        )}
      >
        {selected && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      {leading}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-semibold", titleClassName)}>{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-right text-sm">{trailing}</span>}
    </button>
  )
}
