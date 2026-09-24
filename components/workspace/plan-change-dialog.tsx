"use client"

import { Copy, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/format"
import { SALES_EMAIL, type Plan } from "./plans"

interface PlanChangeDialogProps {
  open: boolean
  /** The plan the user wants (kept while the dialog animates closed) */
  plan: Plan | null
  currentPlan: Plan | null
  workspaceName: string
  workspaceId: string
  onOpenChange: (open: boolean) => void
}

export function PlanChangeDialog({
  open,
  plan,
  currentPlan,
  workspaceName,
  workspaceId,
  onOpenChange,
}: PlanChangeDialogProps) {
  const isUpgrade = !currentPlan || (plan ? plan.price > currentPlan.price : false)
  const verb = isUpgrade ? "upgrade" : "switch"

  const body = plan
    ? [
        `Hi StockFlow team,`,
        ``,
        `I'd like to ${verb} my workspace to the ${plan.name} plan (${formatCurrency(plan.price)}/month).`,
        ``,
        `Workspace: ${workspaceName}`,
        `Workspace ID: ${workspaceId}`,
        `Current plan: ${currentPlan?.name ?? "none"}`,
        ``,
        `Thanks!`,
      ].join("\n")
    : ""
  const subject = plan ? `Plan change request: ${workspaceName} → ${plan.name}` : ""
  const mailto = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(`To: ${SALES_EMAIL}\nSubject: ${subject}\n\n${body}`)
      toast.success("Request copied — paste it into an email to us")
    } catch {
      toast.error("Couldn't copy to the clipboard")
    }
  }

  return (
    <Dialog open={open && plan !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {plan && (
          <>
            <DialogHeader>
              <DialogTitle>Contact us to {verb} to {plan.name}</DialogTitle>
              <DialogDescription>
                Online checkout isn&apos;t available yet, so plan changes are handled by our team. Send us a request and
                we&apos;ll get back to you — nothing is charged from this page.
              </DialogDescription>
            </DialogHeader>

            <dl className="divide-y rounded-lg border text-sm">
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <dt className="text-muted-foreground">Requested plan</dt>
                <dd className="font-medium">
                  {plan.name} · {formatCurrency(plan.price)}/mo
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <dt className="text-muted-foreground">Current plan</dt>
                <dd>{currentPlan?.name ?? "None"}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <dt className="text-muted-foreground">Workspace</dt>
                <dd className="min-w-0 truncate">{workspaceName}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-3 py-2.5">
                <dt className="text-muted-foreground">Contact</dt>
                <dd className="min-w-0 break-all">{SALES_EMAIL}</dd>
              </div>
            </dl>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={copyDetails}>
                <Copy /> Copy request
              </Button>
              <Button asChild data-testid="plan-change-email">
                <a href={mailto} onClick={() => onOpenChange(false)}>
                  <Mail /> Email us
                </a>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
