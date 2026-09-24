"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Mail, Send } from "lucide-react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { inviteMemberApi } from "@/lib/api/workspaceMembers.api"
import { getErrorMessage } from "@/lib/api/client"
import type { WorkspaceRole } from "@/lib/workspace-context"
import { cn } from "@/lib/utils"
import { INVITABLE_ROLES, ROLE_META } from "./roles"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId: string
  workspaceName?: string
  /** Lower-cased emails of current members — used to catch duplicates before calling the API */
  memberEmails: Set<string>
  /** Lower-cased emails that already have a pending invitation */
  pendingEmails: Set<string>
  onInvited: () => void
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  workspaceId,
  workspaceName,
  memberEmails,
  pendingEmails,
  onInvited,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<WorkspaceRole>("MEMBER")
  const [touched, setTouched] = useState(false)
  const [sending, setSending] = useState(false)

  const trimmed = email.trim().toLowerCase()
  const validationError = !trimmed
    ? "Enter an email address"
    : !EMAIL_RE.test(trimmed)
      ? "Enter a valid email address, e.g. name@company.com"
      : memberEmails.has(trimmed)
        ? "This person is already a member of the workspace"
        : pendingEmails.has(trimmed)
          ? "An invitation is already pending for this email"
          : null
  const showError = touched && validationError

  const reset = () => {
    setEmail("")
    setRole("MEMBER")
    setTouched(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (sending) return
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (validationError) return
    setSending(true)
    try {
      const res = await inviteMemberApi(trimmed, role, workspaceId)
      // The API creates the invitation even if the email can't be delivered
      if ((res.data as { emailSent?: boolean } | undefined)?.emailSent === false) {
        toast.warning(`Invitation created for ${trimmed}, but the email couldn't be sent`, {
          description: "Use Resend from Pending invitations to try again.",
        })
      } else {
        toast.success(`Invitation sent to ${trimmed}`)
      }
      reset()
      onOpenChange(false)
      onInvited()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't send the invitation"))
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              We&apos;ll email them a link to join {workspaceName ? <strong>{workspaceName}</strong> : "this workspace"}.
              The link expires after 7 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                autoFocus
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                className="h-10 pl-9"
                disabled={sending}
                aria-invalid={Boolean(showError)}
                aria-describedby={showError ? "invite-email-error" : undefined}
                data-testid="invite-email-input"
              />
            </div>
            {showError && (
              <p id="invite-email-error" className="text-sm text-destructive">
                {validationError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label id="invite-role-label">Role</Label>
            <RadioGroup
              aria-labelledby="invite-role-label"
              value={role}
              onValueChange={(v) => setRole(v as WorkspaceRole)}
              className="gap-2"
              disabled={sending}
            >
              {INVITABLE_ROLES.map((r) => (
                <Label
                  key={r}
                  htmlFor={`invite-role-${r}`}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal leading-normal transition-colors hover:bg-accent/50",
                    role === r && "border-primary/50 bg-primary/5"
                  )}
                >
                  <RadioGroupItem id={`invite-role-${r}`} value={r} className="mt-0.5" />
                  <span className="space-y-0.5">
                    <span className="block text-sm font-medium">{ROLE_META[r].label}</span>
                    <span className="block text-xs text-muted-foreground">{ROLE_META[r].description}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending} data-testid="invite-send">
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              Send invitation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
