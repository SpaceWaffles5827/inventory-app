import type { CategoryWithCount } from "@/lib/api/categories.api"

/** A category plus stock figures derived from the workspace's items (null when items couldn't be loaded). */
export type CategoryRow = CategoryWithCount & {
  units: number | null
  value: number | null
  lowStock: number | null
}
