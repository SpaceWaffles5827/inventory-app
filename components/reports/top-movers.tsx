"use client"

import Link from "next/link"
import { Minus, TrendingDown, TrendingUp, Trophy } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/common/empty-state"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber, formatQuantity } from "@/lib/format"
import { ReportCard } from "./report-card"
import type { MoverRow } from "./report-data"

export function formatChange(pct: number) {
  const abs = Math.abs(pct)
  const rounded = abs >= 10 ? Math.round(abs) : Math.round(abs * 10) / 10
  if (rounded === 0) return "0%"
  return `${pct > 0 ? "+" : "−"}${formatNumber(rounded)}%`
}

function Change({ mover }: { mover: MoverRow }) {
  if (mover.changePct === null) {
    return mover.isNew ? <Badge variant="secondary">New</Badge> : <span className="text-muted-foreground">—</span>
  }
  const Icon = mover.changePct > 0 ? TrendingUp : mover.changePct < 0 ? TrendingDown : Minus
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      {formatChange(mover.changePct)}
    </span>
  )
}

function ItemName({ mover, linked = true }: { mover: MoverRow; linked?: boolean }) {
  const name = <span className="block truncate font-medium">{mover.name}</span>
  return (
    <div className="min-w-0">
      {linked && mover.id ? (
        <Link href={`/dashboard/items/${mover.id}`} className="block truncate hover:underline">
          {name}
        </Link>
      ) : (
        name
      )}
      {mover.sku && <span className="block truncate font-mono text-xs text-muted-foreground">{mover.sku}</span>}
    </div>
  )
}

function primaryAmount(mover: MoverRow) {
  if (mover.units !== null) return formatQuantity(mover.units, mover.unit)
  if (mover.movements !== null) return `${formatNumber(mover.movements)} ${mover.movements === 1 ? "move" : "moves"}`
  return "—"
}

export function TopMovers({
  movers,
  showChange,
  periodShort,
  className,
}: {
  movers: MoverRow[]
  showChange: boolean
  periodShort: string
  className?: string
}) {
  const hasUnits = movers.some((m) => m.units !== null)
  const showMovementsColumn = hasUnits && movers.some((m) => m.movements !== null)

  return (
    <ReportCard
      className={className}
      title="Top movers"
      description={
        showChange
          ? `Most-moved items in the last ${periodShort}, compared with the ${periodShort} before`
          : `Most-moved items in the last ${periodShort}`
      }
      bodyClassName="px-0 sm:px-0"
      data-testid="report-top-movers"
    >
      {movers.length === 0 ? (
        <EmptyState
          bare
          icon={Trophy}
          title="No movement yet"
          description="Items you receive, ship or transfer in this period will be ranked here."
        />
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-5">#</TableHead>
                  <TableHead className="w-full">Item</TableHead>
                  <TableHead className="text-right">{hasUnits ? "Units moved" : "Movements"}</TableHead>
                  {showMovementsColumn && <TableHead className="text-right">Movements</TableHead>}
                  {showChange && <TableHead className="pr-5 text-right">vs previous</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {movers.map((mover, i) => (
                  <TableRow key={mover.id ?? `${mover.name}-${i}`}>
                    <TableCell className="pl-5 text-muted-foreground tabular-nums">{i + 1}</TableCell>
                    <TableCell className="w-full max-w-0">
                      <ItemName mover={mover} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{primaryAmount(mover)}</TableCell>
                    {showMovementsColumn && (
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {mover.movements !== null ? formatNumber(mover.movements) : "—"}
                      </TableCell>
                    )}
                    {showChange && (
                      <TableCell className="pr-5 text-right">
                        <Change mover={mover} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ol className="divide-y border-t md:hidden">
            {movers.map((mover, i) => {
              const row = (
                <>
                  <span className="w-5 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <ItemName mover={mover} linked={false} />
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <div className="font-medium tabular-nums">{primaryAmount(mover)}</div>
                    {showChange && (
                      <div className="text-xs text-muted-foreground">
                        <Change mover={mover} />
                      </div>
                    )}
                  </div>
                </>
              )
              const rowClass = "flex min-h-14 items-center gap-3 px-4 py-3"
              return (
                <li key={mover.id ?? `${mover.name}-${i}`}>
                  {mover.id ? (
                    <Link href={`/dashboard/items/${mover.id}`} className={`${rowClass} transition-colors hover:bg-accent/50`}>
                      {row}
                    </Link>
                  ) : (
                    <div className={rowClass}>{row}</div>
                  )}
                </li>
              )
            })}
          </ol>
        </>
      )}
    </ReportCard>
  )
}
