"use client"

import type { Dispatch, SetStateAction } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { presetsFor, type ReasonPreset, type ReasonValue, type StockDirection } from "./stock-utils"

interface ReasonFieldProps {
  value: ReasonValue
  /** A state setter (functional updates keep quick successive edits from clobbering each other) */
  onChange: Dispatch<SetStateAction<ReasonValue>>
  /** Presets shown as chips; defaults to the ones that fit the direction. Pass [] for a note-only field. */
  direction?: StockDirection
  presets?: ReasonPreset[]
  label?: string
  notePlaceholder?: string
  noteTestId?: string
  id?: string
}

/** Reason chips ("Received", "Damaged", …) plus an optional free-text note */
export function ReasonField({
  value,
  onChange,
  direction = "in",
  presets,
  label = "Reason",
  notePlaceholder = "Add a note (optional)",
  noteTestId,
  id = "stock-reason-note",
}: ReasonFieldProps) {
  const chips = presets ?? presetsFor(direction)

  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2.5 text-sm font-medium">{label}</legend>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={`${label} presets`}>
          {chips.map((preset) => {
            const active = value.presetId === preset.id
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange((prev) => ({ ...prev, presetId: prev.presetId === preset.id ? null : preset.id }))}
                data-testid={`stock-reason-${preset.id}`}
                className={cn(
                  "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors outline-none",
                  "focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card text-foreground hover:border-primary/40 hover:bg-accent"
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      )}
      <Label htmlFor={id} className="sr-only">
        Note
      </Label>
      <Input
        id={id}
        value={value.note}
        onChange={(e) => {
          const note = e.target.value
          onChange((prev) => ({ ...prev, note }))
        }}
        placeholder={notePlaceholder}
        autoComplete="off"
        maxLength={250}
        enterKeyHint="done"
        className="h-11"
        data-testid={noteTestId}
      />
    </fieldset>
  )
}
