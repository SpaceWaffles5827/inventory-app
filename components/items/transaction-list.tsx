import { ArrowRight } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TransactionTypeBadge } from "@/components/common/status-badge"
import type { TransactionEntry } from "@/lib/api/transactions.api"
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/format"
import { getTransactionType } from "@/lib/stock"
import { cn } from "@/lib/utils"
import { SYSTEM_LOT_NUMBER, lotDisplayName } from "./items-data"

function SignedQuantity({ tx, unit }: { tx: TransactionEntry; unit?: string | null }) {
  const { sign } = getTransactionType(tx.type)
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        tx.type === "INPUT" && "text-success",
        tx.type === "OUTPUT" && "text-destructive"
      )}
    >
      {sign}
      {formatNumber(tx.quantity)}
      {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
    </span>
  )
}

function Route({ tx }: { tx: TransactionEntry }) {
  const from = tx.fromLocation?.code
  const to = tx.toLocation?.code
  if (!from && !to) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-1 font-mono text-xs">
      {from && <span className="truncate">{from}</span>}
      <ArrowRight aria-label={from && to ? "to" : from ? "out of" : "into"} className="size-3 shrink-0 text-muted-foreground" />
      {to && <span className="truncate">{to}</span>}
    </span>
  )
}

function When({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className="whitespace-nowrap">
      {formatRelativeTime(iso)}
    </time>
  )
}

function lotLabel(tx: TransactionEntry): string | null {
  const lot = tx.lot?.lotNumber
  return lot && lot !== SYSTEM_LOT_NUMBER ? lotDisplayName(lot) : null
}

interface TransactionListProps {
  transactions: TransactionEntry[]
  unit?: string | null
  /** Show the lot column */
  showLot?: boolean
  /** Show the item's on-hand total after each movement */
  showBalance?: boolean
}

/** Stock movements: a table from `md` up, stacked rows on phones */
export function TransactionList({ transactions, unit, showLot = false, showBalance = false }: TransactionListProps) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4">Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              {showBalance && <TableHead className="text-right">On hand after</TableHead>}
              <TableHead>Location</TableHead>
              {showLot && <TableHead>Lot</TableHead>}
              <TableHead>Reason</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="pr-4 text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="pl-4">
                  <TransactionTypeBadge type={tx.type} />
                </TableCell>
                <TableCell className="text-right">
                  <SignedQuantity tx={tx} unit={unit} />
                </TableCell>
                {showBalance && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {tx.newStock === null ? "—" : formatNumber(tx.newStock)}
                  </TableCell>
                )}
                <TableCell>
                  <Route tx={tx} />
                </TableCell>
                {showLot && <TableCell className="font-mono text-xs">{lotLabel(tx) ?? <span className="text-muted-foreground">—</span>}</TableCell>}
                <TableCell className="max-w-64 truncate text-muted-foreground" title={tx.reason ?? undefined}>
                  {tx.reason || "—"}
                </TableCell>
                <TableCell className="max-w-40 truncate">{tx.user?.name ?? <span className="text-muted-foreground">Unknown user</span>}</TableCell>
                <TableCell className="pr-4 text-right text-muted-foreground">
                  <When iso={tx.createdAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y md:hidden">
        {transactions.map((tx) => {
          const lot = showLot ? lotLabel(tx) : null
          return (
            <li key={tx.id} className="space-y-1.5 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <TransactionTypeBadge type={tx.type} />
                <SignedQuantity tx={tx} unit={unit} />
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <Route tx={tx} />
                {lot && <span className="font-mono">{lot}</span>}
                {showBalance && tx.newStock !== null && <span className="tabular-nums">On hand {formatNumber(tx.newStock)}</span>}
              </div>
              {tx.reason && <p className="line-clamp-2 text-sm">{tx.reason}</p>}
              <p className="text-xs text-muted-foreground">
                {tx.user?.name ?? "Unknown user"} · <When iso={tx.createdAt} />
              </p>
            </li>
          )
        })}
      </ul>
    </>
  )
}
