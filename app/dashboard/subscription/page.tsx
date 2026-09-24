"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, CalendarClock, Check, FolderTree, Info, MapPin, Package, Sparkles, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PageContainer, PageHeader, SectionHeader } from "@/components/common/page"
import { EmptyState } from "@/components/common/empty-state"
import { PlanChangeDialog } from "@/components/workspace/plan-change-dialog"
import { getPlan, planRank, PLANS, type Plan } from "@/components/workspace/plans"
import { getWorkspaceByIdApi, type WorkspaceWithDetails } from "@/lib/api/workspace.api"
import { useWorkspace } from "@/lib/workspace-context"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"

const DAY_MS = 24 * 60 * 60 * 1000

type StatusVariant = "success" | "info" | "warning" | "danger" | "muted"

const STATUS: Record<string, { label: string; variant: StatusVariant }> = {
  ACTIVE: { label: "Active", variant: "success" },
  TRIALING: { label: "Free trial", variant: "info" },
  PAST_DUE: { label: "Past due", variant: "warning" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
}

function toTime(value: unknown): number | null {
  if (!value) return null
  const t = new Date(value as string).getTime()
  return Number.isFinite(t) ? t : null
}

function daysLabel(days: number) {
  return `${formatNumber(days)} ${days === 1 ? "day" : "days"}`
}

function UsageRow({
  icon: Icon,
  label,
  used,
  limit,
  loading,
}: {
  icon: typeof Package
  label: string
  used: number | null
  /** undefined = this plan doesn't cap it; null = unlimited */
  limit?: number | null
  loading?: boolean
}) {
  const capped = typeof limit === "number" && limit > 0
  const pct = capped && used !== null ? Math.min(100, (used / limit) * 100) : 0
  const over = capped && used !== null && used > limit
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </span>
        <span className="tabular-nums">
          {loading || used === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <>
              <span className="font-medium">{formatNumber(used)}</span>
              {capped && <span className="text-muted-foreground"> / {formatNumber(limit)}</span>}
              {limit === null && <span className="text-muted-foreground"> · unlimited</span>}
            </>
          )}
        </span>
      </div>
      {capped && (
        <Progress
          value={pct}
          aria-label={`${label} used`}
          className={cn(over && "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning")}
        />
      )}
      {over && (
        <p className="text-xs text-warning-foreground dark:text-warning">
          Above what this plan includes — consider upgrading.
        </p>
      )}
    </div>
  )
}

export default function SubscriptionPage() {
  const { workspace, workspaceId, isAdmin } = useWorkspace()
  const subscription = workspace?.subscription ?? null
  const currentPlan = getPlan(subscription?.plan)
  const nextPlan = currentPlan ? (PLANS[planRank(currentPlan.id) + 1] ?? null) : null
  const status = subscription ? (STATUS[subscription.status] ?? { label: subscription.status, variant: "muted" }) : null

  // Details endpoint gives cheap counts for locations/categories (the list endpoint only has items/members)
  const [details, setDetails] = useState<WorkspaceWithDetails["_count"] | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(true)

  const loadDetails = useCallback(async () => {
    try {
      const res = await getWorkspaceByIdApi(workspaceId)
      const ws = res.data?.workspace as Partial<WorkspaceWithDetails> | undefined
      setDetails(ws?._count ?? null)
    } catch {
      // Counts are a nice-to-have here; the rows fall back to "—"
      setDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    loadDetails()
  }, [loadDetails])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [targetPlan, setTargetPlan] = useState<Plan | null>(null)
  const requestPlan = (plan: Plan) => {
    setTargetPlan(plan)
    setDialogOpen(true)
  }

  // ----- period / trial maths -----
  const now = Date.now()
  const start = toTime(subscription?.currentPeriodStart)
  const end = toTime(subscription?.currentPeriodEnd)
  const isTrial = subscription?.status === "TRIALING"
  const daysLeft = end !== null ? Math.ceil((end - now) / DAY_MS) : null
  const totalDays = start !== null && end !== null ? Math.max(1, Math.round((end - start) / DAY_MS)) : null
  const elapsedPct =
    start !== null && end !== null && end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0

  const itemCount = workspace?._count?.items ?? null
  const memberCount = workspace?._count?.members ?? null

  const periodLine = (() => {
    if (!subscription || end === null || daysLeft === null) return null
    if (isTrial) {
      return daysLeft > 0
        ? `Trial ends in ${daysLabel(daysLeft)} · ${formatDate(end)}`
        : `Trial ended ${formatDate(end)}`
    }
    if (subscription.status === "CANCELLED") return `Ended ${formatDate(end)}`
    if (subscription.cancelAtPeriodEnd) return `Cancels on ${formatDate(end)}`
    return `Current period ends ${formatDate(end)}`
  })()

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Billing"
        description={workspace ? `Plan and usage for ${workspace.name}` : "Plan and usage for this workspace"}
      />

      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-sm"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-info" />
        <p className="text-muted-foreground">
          <span className="font-medium text-foreground">Online payments aren&apos;t set up yet.</span> There are no
          invoices or payment methods to manage here — to change plans, contact us and our team will switch your
          workspace over.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        {/* Current plan */}
        <section
          aria-labelledby="current-plan-title"
          className="rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:p-6 lg:col-span-3"
          data-testid="current-plan"
        >
          {subscription ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">Current plan</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="current-plan-title" className="text-2xl font-semibold tracking-tight">
                      {currentPlan?.name ?? subscription.plan}
                    </h2>
                    {status && <Badge variant={status.variant}>{status.label}</Badge>}
                  </div>
                  {currentPlan && <p className="text-sm text-muted-foreground">{currentPlan.teamSize}</p>}
                </div>
                {currentPlan && (
                  <div className="text-left sm:text-right">
                    <p className="text-2xl font-semibold tracking-tight">
                      {formatCurrency(currentPlan.price)}
                      <span className="text-sm font-normal text-muted-foreground">/month</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isTrial ? "after your trial · not charged in-app" : "list price · not charged in-app"}
                    </p>
                  </div>
                )}
              </div>

              {periodLine && (
                <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <CalendarClock className="size-4 text-muted-foreground" />
                    {periodLine}
                  </div>
                  {isTrial && totalDays !== null && daysLeft !== null && daysLeft > 0 && (
                    <>
                      <Progress value={elapsedPct} aria-label="Trial elapsed" />
                      <p className="text-xs text-muted-foreground">
                        Day {formatNumber(Math.min(totalDays, Math.max(1, totalDays - daysLeft + 1)))} of{" "}
                        {formatNumber(totalDays)}
                      </p>
                    </>
                  )}
                  {subscription.status === "PAST_DUE" && (
                    <p className="text-xs text-muted-foreground">Contact us to sort out your subscription.</p>
                  )}
                </div>
              )}

              {currentPlan && (
                <ul className="grid gap-2 text-sm sm:grid-cols-2">
                  {currentPlan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {isAdmin && nextPlan && (
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button onClick={() => requestPlan(nextPlan)} data-testid="upgrade-plan">
                    <Sparkles /> Upgrade to {nextPlan.name}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#plans">Compare plans</a>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              bare
              className="py-8"
              icon={Sparkles}
              title="No plan on file"
              description="This workspace doesn't have a subscription record. Pick a plan below and contact us to set it up."
            />
          )}
        </section>

        {/* Usage */}
        <section
          aria-labelledby="usage-title"
          className="space-y-5 rounded-xl border bg-card p-4 text-card-foreground shadow-xs sm:p-6 lg:col-span-2"
          data-testid="plan-usage"
        >
          <div className="space-y-1">
            <h2 id="usage-title" className="font-semibold">
              Usage
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentPlan ? `Compared with what ${currentPlan.name} includes.` : "What this workspace holds today."}
            </p>
          </div>
          <UsageRow icon={Package} label="Items" used={itemCount} limit={currentPlan?.limits.items} />
          <UsageRow icon={Users} label="Members" used={memberCount} limit={currentPlan?.limits.members} />
          <div className="grid grid-cols-2 gap-3 border-t pt-4">
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5" /> Storage locations
              </p>
              <p className="text-lg font-semibold">
                {detailsLoading ? "…" : details ? formatNumber(details.locations) : "—"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <FolderTree className="size-3.5" /> Categories
              </p>
              <p className="text-lg font-semibold">
                {detailsLoading ? "…" : details ? formatNumber(details.categories) : "—"}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Plans */}
      <section id="plans" aria-labelledby="plans-title" className="scroll-mt-20 space-y-4">
        <SectionHeader
          title={<span id="plans-title">Plans</span>}
          description="Same plans and prices as our public pricing page. All prices are per workspace, per month."
          actions={
            <Button variant="link" asChild className="h-auto px-0">
              <Link href="/pricing" target="_blank">
                Pricing page <ArrowRight />
              </Link>
            </Button>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlan?.id
            const higher = currentPlan ? plan.price > currentPlan.price : true
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-card p-5 text-card-foreground shadow-xs",
                  isCurrent && "border-primary ring-1 ring-primary"
                )}
                data-testid={`plan-${plan.id.toLowerCase()}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  {isCurrent ? (
                    <Badge>Current</Badge>
                  ) : plan.popular ? (
                    <Badge variant="outline" className="border-transparent bg-primary/10 text-primary">
                      Most popular
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                <p className="mt-4">
                  <span className="text-3xl font-semibold tracking-tight">{formatCurrency(plan.price).replace(/\.00$/, "")}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </p>
                <p className="text-sm text-muted-foreground">{plan.teamSize}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <Button variant="secondary" className="w-full" disabled>
                      {isTrial ? "Trialing this plan" : "Your current plan"}
                    </Button>
                  ) : isAdmin ? (
                    <Button
                      variant={higher ? "default" : "outline"}
                      className="w-full"
                      onClick={() => requestPlan(plan)}
                      data-testid={`request-plan-${plan.id.toLowerCase()}`}
                    >
                      {higher ? `Upgrade to ${plan.name}` : `Switch to ${plan.name}`}
                    </Button>
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">Ask a workspace admin to change plans</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Need more than 100 people?{" "}
          {isAdmin ? (
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => requestPlan(PLANS[PLANS.length - 1])}
            >
              Talk to us about custom pricing
            </button>
          ) : (
            "Ask a workspace admin to contact us about custom pricing."
          )}
        </p>
      </section>

      <PlanChangeDialog
        open={dialogOpen}
        plan={targetPlan}
        currentPlan={currentPlan}
        workspaceName={workspace?.name ?? "My workspace"}
        workspaceId={workspaceId}
        onOpenChange={setDialogOpen}
      />
    </PageContainer>
  )
}
