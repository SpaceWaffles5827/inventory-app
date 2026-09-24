"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, MailPlus, SearchX, UserPlus, Users } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageContainer, PageHeader, SectionHeader } from "@/components/common/page"
import { EmptyState } from "@/components/common/empty-state"
import { ErrorState, ListSkeleton } from "@/components/common/states"
import { SearchInput } from "@/components/common/search-input"
import { useConfirm } from "@/components/common/confirm-provider"
import { MembersList } from "@/components/workspace/members-list"
import { InvitationsList, type InvitationRow } from "@/components/workspace/invitations-list"
import { InviteMemberDialog } from "@/components/workspace/invite-member-dialog"
import { RoleBadge } from "@/components/workspace/role-badge"
import { ROLE_META, ROLES, normalizeRole } from "@/components/workspace/roles"
import { dateStamp, downloadCsv, slugify } from "@/components/reports/csv"
import {
  cancelInvitationApi,
  getInvitationsApi,
  getMembersApi,
  removeMemberApi,
  resendInvitationApi,
  updateMemberRoleApi,
  type WorkspaceMember,
} from "@/lib/api/workspaceMembers.api"
import { getErrorMessage } from "@/lib/api/client"
import { useWorkspace, type WorkspaceRole } from "@/lib/workspace-context"
import { formatNumber } from "@/lib/format"

type RoleFilter = "ALL" | WorkspaceRole

function memberName(member: WorkspaceMember) {
  return member.user.name?.trim() || member.user.email
}

function withArticle(role: WorkspaceRole) {
  const label = ROLE_META[role].label.toLowerCase()
  return role === "MEMBER" ? `a ${label}` : `an ${label}`
}

function toIso(value: string | null | undefined) {
  if (!value) return ""
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

export default function MembersPage() {
  const { workspaceId, workspace, user, role, isAdmin } = useWorkspace()
  const confirm = useConfirm()

  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invitesLoading, setInvitesLoading] = useState(isAdmin)
  const [invitesError, setInvitesError] = useState<string | null>(null)

  const [tab, setTab] = useState("members")
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL")
  const [inviteOpen, setInviteOpen] = useState(false)
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [pendingInvite, setPendingInvite] = useState<{ id: string; action: "resend" | "cancel" } | null>(null)

  const loadMembers = useCallback(async () => {
    try {
      const res = await getMembersApi(workspaceId)
      setMembers(res.data?.members ?? [])
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load members"))
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  // Only admins can list invitations (the API rejects everyone else)
  const loadInvitations = useCallback(async () => {
    if (!isAdmin) return
    try {
      const res = await getInvitationsApi(workspaceId)
      setInvitations((res.data?.invitations ?? []) as InvitationRow[])
      setInvitesError(null)
    } catch (err) {
      setInvitesError(getErrorMessage(err, "Couldn't load invitations"))
    } finally {
      setInvitesLoading(false)
    }
  }, [workspaceId, isAdmin])

  useEffect(() => {
    loadMembers()
    loadInvitations()
  }, [loadMembers, loadInvitations])

  const retryMembers = () => {
    setLoading(true)
    setError(null)
    loadMembers()
  }

  const retryInvitations = () => {
    setInvitesLoading(true)
    setInvitesError(null)
    loadInvitations()
  }

  const ownerCount = useMemo(() => members.filter((m) => m.role === "OWNER").length, [members])
  const memberEmails = useMemo(() => new Set(members.map((m) => m.user.email.toLowerCase())), [members])
  const pendingEmails = useMemo(() => new Set(invitations.map((i) => i.email.toLowerCase())), [invitations])

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase()
    return members.filter((m) => {
      if (roleFilter !== "ALL" && normalizeRole(m.role) !== roleFilter) return false
      if (!q) return true
      return (m.user.name ?? "").toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q)
    })
  }, [members, query, roleFilter])

  const filtersActive = query.trim() !== "" || roleFilter !== "ALL"

  // ---------- actions ----------

  const applyRoleChange = async (member: WorkspaceMember, newRole: WorkspaceRole) => {
    setPendingMemberId(member.id)
    try {
      const res = await updateMemberRoleApi(member.id, newRole, workspaceId)
      const updated = res.data?.member
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, ...(updated ?? {}), role: updated?.role ?? newRole } : m))
      )
      toast.success(`${memberName(member)} is now ${withArticle(newRole)}`)
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't change the role"))
    } finally {
      setPendingMemberId(null)
    }
  }

  const handleChangeRole = async (member: WorkspaceMember, newRole: WorkspaceRole) => {
    const name = memberName(member)
    if (newRole === "OWNER") {
      const ok = await confirm({
        title: `Make ${name} an owner?`,
        description:
          "Owners have full control of the workspace, including deleting it and changing other owners' roles.",
        confirmLabel: "Make owner",
      })
      if (!ok) return
    } else if (member.role === "OWNER") {
      const ok = await confirm({
        title: `Remove owner access for ${name}?`,
        description: `${name} will become ${withArticle(newRole)} and can no longer delete the workspace or manage owners.`,
        confirmLabel: `Make ${ROLE_META[newRole].label.toLowerCase()}`,
      })
      if (!ok) return
    }
    await applyRoleChange(member, newRole)
  }

  const handleRemove = async (member: WorkspaceMember) => {
    const name = memberName(member)
    const removed = await confirm({
      title: `Remove ${name}?`,
      description: `${member.user.email} will lose access to ${workspace?.name ?? "this workspace"} immediately. You can invite them again later.`,
      destructive: true,
      confirmLabel: "Remove member",
      action: async () => {
        try {
          await removeMemberApi(member.id, workspaceId)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't remove the member"))
          throw err
        }
      },
    })
    if (removed) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
      toast.success(`${name} was removed from the workspace`)
    }
  }

  const handleResend = async (invite: InvitationRow) => {
    setPendingInvite({ id: invite.id, action: "resend" })
    try {
      const res = await resendInvitationApi(invite.id, workspaceId)
      if ((res.data as { emailSent?: boolean } | undefined)?.emailSent === false) {
        toast.warning(`The invitation for ${invite.email} was renewed, but the email couldn't be sent`)
      } else {
        toast.success(`Invitation resent to ${invite.email}`)
      }
      await loadInvitations()
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't resend the invitation"))
    } finally {
      setPendingInvite(null)
    }
  }

  const handleCancelInvite = async (invite: InvitationRow) => {
    const cancelled = await confirm({
      title: "Cancel this invitation?",
      description: `The invitation link sent to ${invite.email} will stop working.`,
      destructive: true,
      confirmLabel: "Cancel invitation",
      cancelLabel: "Keep",
      action: async () => {
        try {
          await cancelInvitationApi(invite.id, workspaceId)
        } catch (err) {
          toast.error(getErrorMessage(err, "Couldn't cancel the invitation"))
          throw err
        }
      },
    })
    if (cancelled) {
      setInvitations((prev) => prev.filter((i) => i.id !== invite.id))
      toast.success(`Invitation for ${invite.email} cancelled`)
    }
  }

  const handleInvited = () => {
    setTab("invitations")
    loadInvitations()
  }

  const handleExport = () => {
    const rows = filteredMembers.map((m) => [
      m.user.name ?? "",
      m.user.email,
      ROLE_META[normalizeRole(m.role)].label,
      toIso(m.joinedAt),
      toIso(m.lastActive),
    ])
    const ok = downloadCsv(
      `${slugify(workspace?.name)}-members-${dateStamp()}.csv`,
      ["Name", "Email", "Role", "Joined", "Last active"],
      rows
    )
    if (ok) toast.success(`Exported ${formatNumber(rows.length)} ${rows.length === 1 ? "member" : "members"}`)
    else toast.error("There are no members to export")
  }

  // ---------- render ----------

  const membersPanel = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search by name or email…"
          className="sm:max-w-xs sm:flex-1"
          aria-label="Search members"
        />
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
          <SelectTrigger className="h-10 w-full sm:w-40" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_META[r].label}s
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtersActive && (
          <p className="text-sm text-muted-foreground sm:ml-auto">
            {formatNumber(filteredMembers.length)} of {formatNumber(members.length)}
          </p>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState title="Couldn't load members" message={error} onRetry={retryMembers} />
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No members match"
          description="Try a different name, email or role."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("")
                setRoleFilter("ALL")
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <MembersList
          members={filteredMembers}
          currentUserId={user?.id}
          actorRole={role}
          ownerCount={ownerCount}
          pendingId={pendingMemberId}
          onChangeRole={handleChangeRole}
          onRemove={handleRemove}
        />
      )}
    </div>
  )

  const invitationsPanel = invitesLoading ? (
    <ListSkeleton rows={2} />
  ) : invitesError ? (
    <ErrorState title="Couldn't load invitations" message={invitesError} onRetry={retryInvitations} />
  ) : invitations.length === 0 ? (
    <EmptyState
      icon={MailPlus}
      title="No pending invitations"
      description="Invite teammates by email. Invitations you send show up here until they're accepted."
      action={
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus /> Invite member
        </Button>
      }
    />
  ) : (
    <InvitationsList
      invitations={invitations}
      pending={pendingInvite}
      onResend={handleResend}
      onCancel={handleCancelInvite}
    />
  )

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Members"
        description={workspace ? `People with access to ${workspace.name}` : "People with access to this workspace"}
        actions={
          <>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={loading || !!error || filteredMembers.length === 0}
              data-testid="members-export"
            >
              <Download /> Export CSV
            </Button>
            {isAdmin && (
              <Button onClick={() => setInviteOpen(true)} data-testid="invite-member">
                <UserPlus /> Invite member
              </Button>
            )}
          </>
        }
      />

      {isAdmin ? (
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="h-10 w-full sm:w-fit">
            <TabsTrigger value="members" className="px-3" data-testid="members-tab">
              <Users /> Members
              {!loading && !error && (
                <span className="ml-1 rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums">
                  {formatNumber(members.length)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="invitations" className="px-3" data-testid="invitations-tab">
              <MailPlus />
              <span className="sm:hidden">Invitations</span>
              <span className="hidden sm:inline">Pending invitations</span>
              {!invitesLoading && !invitesError && (
                <span className="ml-1 rounded-full bg-muted-foreground/10 px-1.5 text-xs tabular-nums">
                  {formatNumber(invitations.length)}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="members">{membersPanel}</TabsContent>
          <TabsContent value="invitations">{invitationsPanel}</TabsContent>
        </Tabs>
      ) : (
        membersPanel
      )}

      <section className="space-y-3">
        <SectionHeader
          title="About roles"
          description={
            isAdmin
              ? "Nobody can change their own role, and a workspace always keeps at least one owner."
              : "Ask an admin or owner if you need a different role."
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {ROLES.map((r) => (
            <div key={r} className="space-y-2 rounded-xl border bg-card p-4">
              <RoleBadge role={r} />
              <p className="text-sm text-muted-foreground">{ROLE_META[r].description}</p>
            </div>
          ))}
        </div>
      </section>

      {isAdmin && (
        <InviteMemberDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          workspaceId={workspaceId}
          workspaceName={workspace?.name}
          memberEmails={memberEmails}
          pendingEmails={pendingEmails}
          onInvited={handleInvited}
        />
      )}
    </PageContainer>
  )
}
