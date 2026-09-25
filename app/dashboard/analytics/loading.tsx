import { Skeleton } from "@/components/ui/skeleton"
import { StatsSkeleton } from "@/components/common/states"

export default function ReportsLoading() {
  return (
    <div className="w-full space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-[170px]" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <StatsSkeleton />
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-96 rounded-xl xl:col-span-3" />
        <Skeleton className="h-96 rounded-xl xl:col-span-2" />
      </div>
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-80 rounded-xl xl:col-span-3" />
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
      </div>
    </div>
  )
}
