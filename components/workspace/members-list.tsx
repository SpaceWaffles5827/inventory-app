"use client"

import { Loader2, MoreHorizontal, UserMinus, UserCog } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import type { WorkspaceMember } from "@/lib/api/workspaceMembers.api"
import type { WorkspaceRole } from "@/lib/workspace-context"
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format"
import { assignableRoles, canRemoveMember, normalizeRole, ROLE_META } from "./roles"
import { MemberAvatar, RoleBadge } from "./role-badge"

interface MembersListProps {
  members: WorkspaceMember[]
  currentUserId?: string
  actorRole: WorkspaceRole | null
  ownerCount: number
  /** Member id with a request in flight */
  pendingId: string | null
  onChangeRole: (member: WorkspaceMember, role: WorkspaceRole) => void
  onRemove: (member: WorkspaceMember) => void
}

function displayName(member: WorkspaceMember) {
  return member.user.name?.trim() || member.user.email.split("@")[0]
}

function MemberActions({
  member,
  currentUserId,
  actorRole,
  ownerCount,
  pending,
  onChangeRole,
  onRemove,
}: Omit<MembersListProps, "members" | "pendingId"> & { member: WorkspaceMember; pending: boolean }) {
  const target = { role: normalizeRole(member.role), isSelf: member.user.id === currentUserId }
  const roles = assignableRoles(actorRole, target, ownerCount)
  const removable = canRemoveMember(actorRole, target, ownerCount)

  if (pending) {
    return (
      <span className="flex size-10 items-center justify-center" aria-label="Saving">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </span>
    )
  }
  // Keep the column width stable when there is nothing to offer
  if (roles.length === 0 && !removable) return <span className="block size-10" aria-hidden />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label={`Actions for ${displayName(member)}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {roles.length > 0 && (
          <>
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Change role</DropdownMenuLabel>
            {roles.map((role) => (
              <DropdownMenuItem key={role} onSelect={() => onChangeRole(member, role)}>
                <UserCog />
                Make {ROLE_META[role].label.toLowerCase()}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {roles.length > 0 && removable && <DropdownMenuSeparator />}
        {removable && (
          <DropdownMenuItem variant="destructive" onSelect={() => onRemove(member)}>
            <UserMinus />
            Remove from workspace
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function MembersList(props: MembersListProps) {
  const { members, currentUserId, pendingId, actorRole } = props
  // Members can't manage anyone — drop the actions column instead of rendering empty cells
  const canManage = actorRole === "OWNER" || actorRole === "ADMIN"

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-full pl-4">Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="pr-4">Joined</TableHead>
              <TableHead className="pr-4">Last active</TableHead>
              {canManage && (
                <TableHead className="w-14 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.user.id === currentUserId
              return (
                <TableRow key={member.id} data-testid="member-row">
                  <TableCell className="w-full max-w-0 py-3 pl-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <MemberAvatar name={member.user.name} email={member.user.email} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{displayName(member)}</span>
                          {isSelf && (
                            <Badge variant="muted" className="px-1.5">
                              You
                            </Badge>
                          )}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">{member.user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={member.role} />
                  </TableCell>
                  <TableCell className="pr-4 text-muted-foreground tabular-nums">{formatDate(member.joinedAt)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground" title={formatDateTime(member.lastActive)}>
                    {formatRelativeTime(member.lastActive)}
                  </TableCell>
                  {canManage && (
                    <TableCell className="pr-4 text-right">
                      <MemberActions {...props} member={member} pending={pendingId === member.id} />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y rounded-xl border bg-card md:hidden">
        {members.map((member) => {
          const isSelf = member.user.id === currentUserId
          return (
            <li key={member.id} className="flex items-start gap-3 p-4" data-testid="member-card">
              <MemberAvatar name={member.user.name} email={member.user.email} className="size-10" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{displayName(member)}</span>
                  {isSelf && (
                    <Badge variant="muted" className="px-1.5">
                      You
                    </Badge>
                  )}
                </div>
                <div className="truncate text-sm text-muted-foreground">{member.user.email}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <RoleBadge role={member.role} />
                  <span>Joined {formatDate(member.joinedAt)}</span>
                  <span aria-hidden>·</span>
                  <span>Active {formatRelativeTime(member.lastActive)}</span>
                </div>
              </div>
              {canManage && (
                <div className="-mr-2 -mt-1 shrink-0">
                  <MemberActions {...props} member={member} pending={pendingId === member.id} />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}
