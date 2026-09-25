"use client"

import { Loader2, Mail, RotateCw, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Invitation } from "@/lib/api/workspaceMembers.api"
import { formatDateTime, formatRelativeTime } from "@/lib/format"
import { RoleBadge } from "./role-badge"

/** The API may (or may not) include who sent the invitation — read it defensively. */
export type InvitationRow = Invitation & {
  invitedBy?: { name?: string | null; email?: string | null } | string | null
  inviter?: { name?: string | null; email?: string | null } | null
}

export function inviterName(invite: InvitationRow): string | null {
  const by = invite.invitedBy ?? invite.inviter
  if (!by) return null
  if (typeof by === "string") return by
  return by.name?.trim() || by.email || null
}

function isExpired(invite: InvitationRow) {
  const t = new Date(invite.expiresAt).getTime()
  return Number.isFinite(t) && t < Date.now()
}

type Action = "resend" | "cancel"

interface InvitationsListProps {
  invitations: readonly InvitationRow[]
  pending: { id: string; action: Action } | null
  onResend: (invite: InvitationRow) => void
  onCancel: (invite: InvitationRow) => void
}

function Expiry({ invite }: { invite: InvitationRow }) {
  if (isExpired(invite)) {
    return (
      <Badge variant="warning" title={formatDateTime(invite.expiresAt)}>
        Expired
      </Badge>
    )
  }
  return <span title={formatDateTime(invite.expiresAt)}>{formatRelativeTime(invite.expiresAt)}</span>
}

function InviteActions({
  invite,
  pending,
  onResend,
  onCancel,
}: Omit<InvitationsListProps, "invitations"> & { invite: InvitationRow }) {
  const busy = pending?.id === invite.id
  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9"
        disabled={busy}
        onClick={() => onResend(invite)}
        data-testid="invitation-resend"
      >
        {busy && pending?.action === "resend" ? <Loader2 className="animate-spin" /> : <RotateCw />}
        Resend
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
        disabled={busy}
        onClick={() => onCancel(invite)}
        data-testid="invitation-cancel"
      >
        {busy && pending?.action === "cancel" ? <Loader2 className="animate-spin" /> : <X />}
        Cancel
      </Button>
    </div>
  )
}

export function InvitationsList(props: InvitationsListProps) {
  const { invitations } = props

  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-full pl-4">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="pr-4 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.map((invite) => {
              const by = inviterName(invite)
              return (
                <TableRow key={invite.id} data-testid="invitation-row">
                  <TableCell className="w-full max-w-0 py-3 pl-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Mail className="size-4 text-muted-foreground" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{invite.email}</div>
                        {by && <div className="truncate text-sm text-muted-foreground">Invited by {by}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={invite.role} />
                  </TableCell>
                  <TableCell className="text-muted-foreground" title={formatDateTime(invite.createdAt)}>
                    {formatRelativeTime(invite.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <Expiry invite={invite} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <InviteActions {...props} invite={invite} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y rounded-xl border bg-card md:hidden">
        {invitations.map((invite) => {
          const by = inviterName(invite)
          return (
            <li key={invite.id} className="space-y-3 p-4" data-testid="invitation-card">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Mail className="size-4 text-muted-foreground" />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="break-all font-medium">{invite.email}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <RoleBadge role={invite.role} />
                    <span>Sent {formatRelativeTime(invite.createdAt)}</span>
                    <span aria-hidden>·</span>
                    <span className="inline-flex items-center gap-1">
                      {isExpired(invite) ? <Expiry invite={invite} /> : <>Expires {formatRelativeTime(invite.expiresAt)}</>}
                    </span>
                  </div>
                  {by && <div className="text-xs text-muted-foreground">Invited by {by}</div>}
                </div>
              </div>
              <InviteActions {...props} invite={invite} />
            </li>
          )
        })}
      </ul>
    </>
  )
}
