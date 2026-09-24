import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

/** Standard page width + padding. Every dashboard page should render inside one. */
export function PageContainer({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8", className)}>{children}</div>
}

interface PageHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  /** Buttons shown on the right (wrap below the title on mobile) */
  actions?: React.ReactNode
  /** Optional back link rendered above the title */
  back?: { href: string; label: string }
  /** Extra content under the title row, e.g. badges or meta */
  meta?: React.ReactNode
  className?: string
}

export function PageHeader({ title, description, actions, back, meta, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-3", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">{title}</h1>
          {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

/** Section heading inside a page (e.g. above a table or card group) */
export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
