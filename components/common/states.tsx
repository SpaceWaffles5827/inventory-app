import { AlertTriangle, Loader2, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function LoadingState({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground", className)}>
      <Loader2 className="size-6 animate-spin text-primary" />
      {label}
    </div>
  )
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="size-5 text-destructive" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  )
}

/** Skeleton rows for tables/lists while data loads */
export function ListSkeleton({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("divide-y rounded-xl border bg-card", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="size-10 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="hidden h-6 w-20 rounded-full sm:block" />
        </div>
      ))}
    </div>
  )
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 sm:p-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  )
}

/** Page-level skeleton: header + optional stats + list. Used by loading.tsx files. */
export function PageSkeleton({ stats = 0 }: { stats?: number }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      {stats > 0 && <StatsSkeleton count={stats} />}
      <ListSkeleton />
    </div>
  )
}
