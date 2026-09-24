import { Badge } from "@/components/ui/badge"
import { getLotStatus, getStockStatus, getTransactionType } from "@/lib/stock"
import { cn } from "@/lib/utils"

function Dot() {
  return <span aria-hidden className="size-1.5 rounded-full bg-current" />
}

export function StockStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const s = getStockStatus(status)
  return (
    <Badge variant={s.variant} className={cn("gap-1.5", className)}>
      <Dot />
      {s.label}
    </Badge>
  )
}

export function LotStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const s = getLotStatus(status)
  return (
    <Badge variant={s.variant} className={cn("gap-1.5", className)} title={s.description}>
      <Dot />
      {s.label}
    </Badge>
  )
}

export function TransactionTypeBadge({ type, className }: { type?: string | null; className?: string }) {
  const t = getTransactionType(type)
  return (
    <Badge variant={t.variant} className={className}>
      {t.label}
    </Badge>
  )
}
