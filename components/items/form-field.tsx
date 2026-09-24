import type { ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FieldProps {
  label: ReactNode
  htmlFor: string
  required?: boolean
  /** Helper text shown when there is no error */
  hint?: ReactNode
  error?: string | null
  errorTestId?: string
  className?: string
  children: ReactNode
}

/** Label + control + inline hint/error. Give the control `aria-invalid` and `aria-describedby={fieldDescriptionId(id)}`. */
export function Field({ label, htmlFor, required, hint, error, errorTestId, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && (
          <span aria-hidden className="-ml-1 text-destructive">
            *
          </span>
        )}
      </Label>
      {children}
      {error ? (
        <p id={fieldDescriptionId(htmlFor)} className="text-xs font-medium text-destructive" data-testid={errorTestId}>
          {error}
        </p>
      ) : hint ? (
        <p id={fieldDescriptionId(htmlFor)} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function fieldDescriptionId(id: string): string {
  return `${id}-description`
}

/** Props that wire an input to its <Field> error */
export function invalidProps(id: string, error?: string | null) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": fieldDescriptionId(id),
  } as const
}
