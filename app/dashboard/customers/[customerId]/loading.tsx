import { ListSkeleton, StatsSkeleton } from "@/components/common/states"
import { PageContainer } from "@/components/common/page"
import { Skeleton } from "@/components/ui/skeleton"

export default function CustomerDetailLoading() {
  return (
    <PageContainer>
      <div className="mb-6 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="space-y-6">
        <StatsSkeleton count={4} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 rounded-xl border bg-card p-5 lg:col-start-3 lg:row-start-1">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-1.5 pt-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
          <div className="space-y-4 lg:col-span-2 lg:row-start-1">
            <Skeleton className="h-5 w-32" />
            <ListSkeleton rows={4} />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
