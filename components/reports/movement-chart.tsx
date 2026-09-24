"use client"

import { useState } from "react"
import { ArrowDownLeft, ArrowUpRight, BarChart3 } from "lucide-react"
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { EmptyState } from "@/components/common/empty-state"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatNumber, formatNumberCompact } from "@/lib/format"
import { LegendItem, ReportCard, Segmented } from "./report-card"
import type { MovementPoint, ReportData } from "./report-data"

const IN_COLOR = "var(--chart-1)"
const OUT_COLOR = "var(--chart-2)"

function signed(n: number) {
  if (n === 0) return "0"
  return `${n > 0 ? "+" : "−"}${formatNumber(Math.abs(n))}`
}

function MovementTooltip({ active, payload }: { active?: boolean; payload?: { payload?: MovementPoint }[] }) {
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1.5 font-medium">{point.fullLabel}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <LegendItem color={IN_COLOR} label="Stock in" />
          <span className="font-medium tabular-nums">{formatNumber(point.in)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <LegendItem color={OUT_COLOR} label="Stock out" />
          <span className="font-medium tabular-nums">{formatNumber(point.out)}</span>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-1">
          <span className="text-muted-foreground">Net change</span>
          <span className="font-medium tabular-nums">{signed(point.net)}</span>
        </div>
        {point.transfers > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Transferred</span>
            <span className="tabular-nums">{formatNumber(point.transfers)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function MovementChart({
  movement,
  totals,
  periodLabel,
  granularity,
  className,
}: {
  movement: MovementPoint[] | null
  totals: ReportData["totals"]
  periodLabel: string
  granularity?: ReportData["granularity"]
  className?: string
}) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const hasData = !!movement && movement.some((p) => p.in > 0 || p.out > 0 || p.transfers > 0)
  const hasTransfers = !!movement && movement.some((p) => p.transfers > 0)

  return (
    <ReportCard
      className={className}
      title="Stock movement"
      description={`Units in and out${granularity ? ` per ${granularity}` : ""} · ${periodLabel.toLowerCase()}`}
      data-testid="report-movement"
      actions={
        hasData ? (
          <Segmented
            label="Stock movement view"
            value={view}
            onChange={setView}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        ) : undefined
      }
    >
      {!movement ? (
        <EmptyState
          bare
          icon={BarChart3}
          title="Movement history isn't available"
          description="The reports service didn't return stock movement for this period."
        />
      ) : !hasData ? (
        <EmptyState
          bare
          icon={BarChart3}
          title="No stock moved in this period"
          description="Receive or ship stock and it will show up here."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LegendItem color={IN_COLOR} label="Stock in" value={totals ? formatNumber(totals.in) : undefined} />
            <LegendItem color={OUT_COLOR} label="Stock out" value={totals ? formatNumber(totals.out) : undefined} />
            {totals && (
              <span className="text-xs text-muted-foreground">
                Net <span className="font-medium text-foreground tabular-nums">{signed(totals.net)}</span>
              </span>
            )}
            {totals && totals.transfers > 0 && (
              <span className="text-xs text-muted-foreground">
                Transferred <span className="font-medium text-foreground tabular-nums">{formatNumber(totals.transfers)}</span>
              </span>
            )}
          </div>

          {view === "chart" ? (
            <div className="h-64 w-full sm:h-72" role="img" aria-label="Bar chart of units in and out per period">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={movement} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickMargin={8}
                    minTickGap={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    allowDecimals={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickFormatter={(v: number) => formatNumberCompact(v)}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", fillOpacity: 0.6 }}
                    content={<MovementTooltip />}
                    wrapperStyle={{ outline: "none" }}
                  />
                  <Bar dataKey="in" name="Stock in" fill={IN_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  <Bar dataKey="out" name="Stock out" fill={OUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="max-h-72 overflow-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">In</TableHead>
                    <TableHead className="text-right">Out</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    {hasTransfers && <TableHead className="text-right">Transferred</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movement.map((p) => (
                    <TableRow key={p.key}>
                      <TableCell>{p.fullLabel}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.in)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.out)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          {p.net > 0 ? (
                            <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
                          ) : p.net < 0 ? (
                            <ArrowDownLeft className="size-3.5 text-muted-foreground" aria-hidden />
                          ) : null}
                          {signed(p.net)}
                        </span>
                      </TableCell>
                      {hasTransfers && (
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatNumber(p.transfers)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
                {totals && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-medium">Total</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatNumber(totals.in)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatNumber(totals.out)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{signed(totals.net)}</TableCell>
                      {hasTransfers && (
                        <TableCell className="text-right font-medium tabular-nums">{formatNumber(totals.transfers)}</TableCell>
                      )}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </div>
      )}
    </ReportCard>
  )
}
