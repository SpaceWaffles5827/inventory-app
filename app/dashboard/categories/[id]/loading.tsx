import { ListSkeleton, StatsSkeleton } from "@/components/common/states"
import { PageContainer } from "@/components/common/page"
import { Skeleton } from "@/components/ui/skeleton"

export default function CategoryDetailLoading() {
  return (
    <PageContainer>
      <div className="mb-6 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-6">
        <StatsSkeleton count={4} />
        <ListSkeleton rows={5} />
      </div>
    </PageContainer>
  )
}
