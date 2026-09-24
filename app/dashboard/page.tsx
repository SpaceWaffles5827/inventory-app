"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Circle,
  DollarSign,
  History,
  MapPin,
  PackagePlus,
  Package,
  ScanLine,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
import { PageContainer, PageHeader } from "@/components/common/page"
import { StatCard } from "@/components/common/stat-card"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton, StatsSkeleton } from "@/components/common/states"
import { TransactionRow } from "@/components/activity/transaction-row"
import { useScanner } from "@/components/app-shell/scan-provider"
import { useWorkspace } from "@/lib/workspace-context"
import { getDashboardSummaryApi, type DashboardSummary } from "@/lib/api/transactions.api"
import { getErrorMessage } from "@/lib/api/client"
import { formatCurrencyCompact, formatNumber, formatNumberCompact } from "@/lib/format"
import { cn } from "@/lib/utils"

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export default function OverviewPage() {
  const { workspaceId, workspace, user, isAdmin } = useWorkspace()
  const { openScanner } = useScanner()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getDashboardSummaryApi(workspaceId)
      setSummary(res.data)
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load the overview"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  // Stock changed from the global scanner (or another dialog) — refresh the numbers
  useEffect(() => {
    const onChange = () => load()
    window.addEventListener("stockflow:stock-changed", onChange)
    return () => window.removeEventListener("stockflow:stock-changed", onChange)
  }, [load])

  const firstName = user?.name?.split(" ")[0]
  const attention = (summary?.lowStockCount ?? 0) + (summary?.outOfStockCount ?? 0)
  const isEmpty = summary !== null && summary.totalSkus === 0

  return (
    <PageContainer>
      <PageHeader
        title={firstName ? `${greeting()}, ${firstName}` : greeting()}
        description={`Here's what's happening in ${workspace?.name ?? "your workspace"}.`}
        actions={
          <>
            <Button variant="outline" onClick={openScanner}>
              <ScanLine /> Scan
            </Button>
            <Button asChild>
              <Link href="/dashboard/items?new=1">
                <PackagePlus /> Add item
              </Link>
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading || !summary ? (
        <div className="space-y-6">
          <StatsSkeleton />
          <div className="grid gap-6 lg:grid-cols-3">
            <ListSkeleton className="lg:col-span-2" rows={5} />
            <ListSkeleton rows={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard
              label="SKUs"
              value={formatNumber(summary.totalSkus)}
              icon={Package}
              tone="primary"
              hint={`${formatNumber(summary.locationsCount)} locations`}
              href="/dashboard/items"
              data-testid="stat-skus"
            />
            <StatCard
              label="Units on hand"
              value={formatNumberCompact(summary.totalUnits)}
              icon={Boxes}
              tone="info"
              hint="Across all locations"
            />
            <StatCard
              label="Inventory value"
              value={formatCurrencyCompact(summary.inventoryValue)}
              icon={DollarSign}
              tone="success"
              hint="At cost"
              href="/dashboard/analytics"
            />
            <StatCard
              label="Needs attention"
              value={formatNumber(attention)}
              icon={AlertTriangle}
              tone={attention > 0 ? "warning" : "default"}
              hint={
                attention > 0
                  ? `${formatNumber(summary.outOfStockCount)} out · ${formatNumber(summary.lowStockCount)} low`
                  : "Everything is stocked"
              }
              href="/dashboard/items?status=LOW_STOCK"
            />
          </div>

          {isEmpty && <GettingStarted locations={summary.locationsCount} isAdmin={isAdmin} />}

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="gap-0 py-0 lg:col-span-2">
              <CardHeader className="border-b py-4 [.border-b]:pb-4">
                <CardTitle className="text-base">Recent activity</CardTitle>
                <CardAction>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/dashboard/activity">
                      View all <ArrowRight />
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              {summary.recentTransactions.length === 0 ? (
                <EmptyState
                  bare
                  icon={History}
                  title="No stock movements yet"
                  description="Adjustments, transfers and received stock will show up here."
                />
              ) : (
                <div className="divide-y">
                  {summary.recentTransactions.map((tx) => (
                    <TransactionRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card className="gap-0 py-0">
                <CardHeader className="border-b py-4 [.border-b]:pb-4">
                  <CardTitle className="text-base">Needs restocking</CardTitle>
                  {summary.lowStockItems.length > 0 && (
                    <CardAction>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href="/dashboard/items?status=LOW_STOCK">
                          All <ArrowRight />
                        </Link>
                      </Button>
                    </CardAction>
                  )}
                </CardHeader>
                {summary.lowStockItems.length === 0 ? (
                  <div className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
                    <CheckCircle2 className="size-5 text-success" />
                    All items are above their reorder point.
                  </div>
                ) : (
                  <ul className="divide-y">
                    {summary.lowStockItems.map((item) => {
                      const pct =
                        item.reorderPoint > 0 ? Math.min(100, Math.round((item.onHand / item.reorderPoint) * 100)) : 0
                      const out = item.onHand <= 0
                      return (
                        <li key={item.id}>
                          <Link
                            href={`/dashboard/items/${item.id}`}
                            className="block px-4 py-3 transition-colors hover:bg-accent/50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{item.name}</div>
                                <div className="font-mono text-xs text-muted-foreground">{item.itemNumber}</div>
                              </div>
                              <div className="shrink-0 text-right text-sm">
                                <span className={cn("font-semibold tabular-nums", out ? "text-destructive" : "text-warning-foreground dark:text-warning")}>
                                  {formatNumber(item.onHand)}
                                </span>
                                <span className="text-muted-foreground"> / {formatNumber(item.reorderPoint)}</span>
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", out ? "bg-destructive" : "bg-warning")}
                                style={{ width: `${Math.max(pct, out ? 0 : 4)}%` }}
                              />
                            </div>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>

              <Card className="gap-3 py-4">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base">Quick actions</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  <QuickAction icon={ScanLine} label="Scan barcode" onClick={openScanner} />
                  <QuickAction icon={PackagePlus} label="Add item" href="/dashboard/items?new=1" />
                  <QuickAction icon={MapPin} label="Locations" href="/dashboard/locations" />
                  <QuickAction icon={UserPlus} label="Invite team" href="/dashboard/members" />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}

function QuickAction({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  onClick?: () => void
}) {
  const className =
    "flex flex-col items-start gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent/50"
  const content = (
    <>
      <Icon className="size-5 text-primary" />
      {label}
    </>
  )
  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cn(className, "text-left")}>
      {content}
    </button>
  )
}

function GettingStarted({ locations, isAdmin }: { locations: number; isAdmin: boolean }) {
  const steps = [
    {
      done: locations > 0,
      title: "Set up your locations",
      description: "Define zones, aisles, shelves or bins so every unit has a home.",
      href: "/dashboard/locations",
      cta: "Add locations",
    },
    {
      done: false,
      title: "Add your first item",
      description: "Create items with SKUs, barcodes, costs and reorder points.",
      href: "/dashboard/items?new=1",
      cta: "Add item",
    },
    ...(isAdmin
      ? [
          {
            done: false,
            title: "Invite your team",
            description: "Give warehouse staff access to scan, receive and move stock.",
            href: "/dashboard/members",
            cta: "Invite",
          },
        ]
      : []),
  ]

  return (
    <Card className="gap-4 border-primary/20 bg-primary/[0.03] py-5">
      <CardHeader>
        <CardTitle>Get started</CardTitle>
        <p className="text-sm text-muted-foreground">A few steps to get your warehouse running in StockFlow.</p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {steps.map((step) => (
          <div key={step.title} className="flex flex-col rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 font-medium">
              {step.done ? (
                <CheckCircle2 className="size-5 text-success" />
              ) : (
                <Circle className="size-5 text-muted-foreground" />
              )}
              {step.title}
            </div>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{step.description}</p>
            {!step.done && (
              <Button asChild variant="outline" size="sm" className="mt-3 self-start">
                <Link href={step.href}>
                  {step.cta} <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
