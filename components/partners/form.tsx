"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/** Text columns for categories, suppliers and customers are VARCHAR(191) in the database. */
export const TEXT_MAX = 191

interface FormFieldProps {
  id: string
  label: React.ReactNode
  required?: boolean
  error?: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** Label + control + inline error (or hint). Pair the control with `fieldA11y(id, error)`. */
export function FormField({ id, label, required, error, hint, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="gap-1">
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** id + aria wiring so screen readers announce the field as invalid and read its error */
export function fieldA11y(id: string, error?: string) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
  } as const
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

/** Loose international check: digits with common separators, 7–15 digits, optional extension */
export function isValidPhone(value: string): boolean {
  const s = value.trim()
  if (!/^\+?[\d\s().\-/]+(\s*(x|ext\.?)\s*\d{1,6})?$/i.test(s)) return false
  const digits = s.replace(/\s*(x|ext\.?)\s*\d+$/i, "").replace(/\D/g, "")
  return digits.length >= 7 && digits.length <= 15
}

/** Remaining-characters hint for long free-text fields */
export function lengthHint(value: string, max = TEXT_MAX) {
  const left = max - value.length
  return left <= 40 ? `${left} characters left` : undefined
}
