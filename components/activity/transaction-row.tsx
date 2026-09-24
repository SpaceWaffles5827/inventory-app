import Link from "next/link"
import { ArrowDownLeft, ArrowRight, ArrowRightLeft, ArrowUpRight } from "lucide-react"
import type { TransactionEntry } from "@/lib/api/transactions.api"
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

const TYPE_STYLE = {
  INPUT: { icon: ArrowDownLeft, className: "bg-success/12 text-success", verb: "Received", sign: "+" },
  OUTPUT: { icon: ArrowUpRight, className: "bg-destructive/10 text-destructive", verb: "Removed", sign: "−" },
  TRANSFER: { icon: ArrowRightLeft, className: "bg-info/12 text-info", verb: "Moved", sign: "" },
} as const

export function TransactionRow({ tx, showItem = true }: { tx: TransactionEntry; showItem?: boolean }) {
  const style = TYPE_STYLE[tx.type] ?? TYPE_STYLE.INPUT
  const Icon = style.icon
  const qty = `${style.sign}${formatNumber(tx.quantity)}${tx.item?.unit ? ` ${tx.item.unit}` : ""}`
  // The server's default transfer reason ("Transfer: A → B") just repeats the route shown above
  const reason = tx.type === "TRANSFER" && tx.reason?.startsWith("Transfer:") ? null : tx.reason

  return (
    <div className="flex items-start gap-3 px-4 py-3 sm:items-center">
      <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg sm:mt-0", style.className)}>
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
          <span className="text-muted-foreground">{style.verb}</span>
          {showItem && tx.item ? (
            <Link href={`/dashboard/items/${tx.item.id}`} className="truncate font-medium hover:underline">
              {tx.item.name}
            </Link>
          ) : showItem ? (
            <span className="font-medium text-muted-foreground">Deleted item</span>
          ) : null}
          {tx.lot && tx.lot.lotNumber !== "SYSTEM" && (
            <span className="font-mono text-xs text-muted-foreground">lot {tx.lot.lotNumber}</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
          {tx.type === "TRANSFER" ? (
            <span className="inline-flex items-center gap-1 font-mono">
              {tx.fromLocation?.code ?? "?"} <ArrowRight className="size-3" /> {tx.toLocation?.code ?? "?"}
            </span>
          ) : tx.toLocation || tx.fromLocation ? (
            <span className="font-mono">{(tx.toLocation ?? tx.fromLocation)?.code}</span>
          ) : null}
          {reason && (
            <>
              <span aria-hidden>·</span>
              <span className="max-w-[16rem] truncate">{reason}</span>
            </>
          )}
          {tx.user?.name && (
            <>
              <span aria-hidden>·</span>
              <span>{tx.user.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <div
          className={cn(
            "text-sm font-semibold tabular-nums",
            tx.type === "INPUT" && "text-success",
            tx.type === "OUTPUT" && "text-destructive"
          )}
        >
          {qty}
        </div>
        <time className="text-xs text-muted-foreground" dateTime={tx.createdAt} title={formatDateTime(tx.createdAt)}>
          {formatRelativeTime(tx.createdAt)}
        </time>
      </div>
    </div>
  )
}
