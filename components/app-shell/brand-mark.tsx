import { Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

/** StockFlow logo + wordmark. Dependency-free so marketing pages can use it without the app shell. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Boxes className="size-4" />
      </span>
      StockFlow
    </span>
  )
}
