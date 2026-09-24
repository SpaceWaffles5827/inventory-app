import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Tone = "default" | "primary" | "success" | "warning" | "danger" | "info"

const TONE_ICON: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning-foreground dark:text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-info/12 text-info",
}

interface StatCardProps {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: React.ReactNode
  tone?: Tone
  href?: string
  className?: string
  "data-testid"?: string
}

export function StatCard({ label, value, icon: Icon, hint, tone = "default", href, className, ...rest }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONE_ICON[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div data-slot="stat-value" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </>
  )

  const classes = cn(
    "block rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:p-5",
    href && "transition-colors hover:border-primary/40 hover:bg-accent/40",
    className
  )

  return href ? (
    <Link href={href} className={classes} data-testid={rest["data-testid"]}>
      {body}
    </Link>
  ) : (
    <div className={classes} data-testid={rest["data-testid"]}>
      {body}
    </div>
  )
}
