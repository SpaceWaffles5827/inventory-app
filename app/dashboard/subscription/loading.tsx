import { Skeleton } from "@/components/ui/skeleton"

export default function SubscriptionLoading() {
  return (
    <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="space-y-4 rounded-xl border bg-card p-4 sm:p-6 lg:col-span-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-40" />
            ))}
          </div>
        </div>
        <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-6 lg:col-span-2">
          <Skeleton className="h-5 w-20" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
