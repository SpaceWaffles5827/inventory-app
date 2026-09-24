import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Card shell shared by the Reports widgets: title row + optional actions + body */
export function ReportCard({
  title,
  description,
  actions,
  className,
  bodyClassName,
  children,
  "data-testid": testId,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
  "data-testid"?: string
}) {
  return (
    <section
      className={cn("flex min-w-0 flex-col rounded-xl border bg-card text-card-foreground shadow-xs", className)}
      data-testid={testId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3 sm:p-5 sm:pb-3">
        <div className="min-w-0 space-y-0.5">
          <h2 className="font-semibold leading-tight">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={cn("min-w-0 flex-1 px-4 pb-4 sm:px-5 sm:pb-5", bodyClassName)}>{children}</div>
    </section>
  )
}

/** Small colour key used next to chart titles (text stays in text tokens; only the swatch carries colour) */
export function LegendItem({ color, label, value }: { color: string; label: string; value?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: color }} />
      {label}
      {value !== undefined && <span className="font-medium text-foreground tabular-nums">{value}</span>}
    </span>
  )
}

/** Segmented two/three-way toggle (chart ↔ table, value ↔ units) */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-md px-3 text-xs font-medium sm:h-7 sm:px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === o.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
