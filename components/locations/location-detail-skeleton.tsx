import { Skeleton } from "@/components/ui/skeleton"
import { ListSkeleton, StatsSkeleton } from "@/components/common/states"

/** Location detail skeleton: back link, title with meta, stats, items list */
export function LocationDetailSkeleton() {
  return (
    <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-64 max-w-full" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-20 rounded-md" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-9" />
          </div>
        </div>
      </div>
      <StatsSkeleton count={4} />
      <ListSkeleton rows={5} />
    </div>
  )
}
