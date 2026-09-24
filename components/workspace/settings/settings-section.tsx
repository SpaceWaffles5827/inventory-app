import type { FormEventHandler, ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface SettingsSectionProps {
  id: string
  title: string
  description?: ReactNode
  icon?: LucideIcon
  /** Buttons rendered in the footer bar (right-aligned) */
  footer?: ReactNode
  /** Left side of the footer, e.g. a hint */
  footerHint?: ReactNode
  /** When set, the whole section is a <form> so Enter submits */
  onSubmit?: FormEventHandler<HTMLFormElement>
  tone?: "default" | "danger"
  className?: string
  children?: ReactNode
}

export function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  footer,
  footerHint,
  onSubmit,
  tone = "default",
  className,
  children,
}: SettingsSectionProps) {
  const body = (
    <>
      <header className={cn("flex items-start gap-3 p-4 sm:p-6", children && "pb-0 sm:pb-0")}>
        {Icon && (
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
            )}
          >
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <h2 id={`${id}-title`} className={cn("font-semibold leading-tight", tone === "danger" && "text-destructive")}>
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children && <div className="p-4 sm:p-6">{children}</div>}
      {(footer || footerHint) && (
        <div className="flex flex-col-reverse gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-xs text-muted-foreground">{footerHint}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2">{footer}</div>}
        </div>
      )}
    </>
  )

  const classes = cn(
    "scroll-mt-20 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs outline-none lg:scroll-mt-8",
    tone === "danger" && "border-destructive/40",
    className
  )

  return onSubmit ? (
    <form id={id} aria-labelledby={`${id}-title`} onSubmit={onSubmit} noValidate className={classes}>
      {body}
    </form>
  ) : (
    <section id={id} aria-labelledby={`${id}-title`} className={classes}>
      {body}
    </section>
  )
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null
  return (
    <p id={id} className="text-sm text-destructive">
      {children}
    </p>
  )
}
