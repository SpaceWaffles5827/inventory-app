import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  /** Render without the dashed border, e.g. inside an existing card */
  bare?: boolean
}

export function EmptyState({ icon: Icon, title, description, action, className, bare = false }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        !bare && "rounded-xl border border-dashed bg-card/50",
        className
      )}
    >
      {Icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}
