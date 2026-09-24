// Role labels + the member-management rules. The backend enforces the same rules;
// these helpers only decide which actions the UI offers.
import type { WorkspaceRole } from "@/lib/workspace-context"

export const ROLES: WorkspaceRole[] = ["OWNER", "ADMIN", "MEMBER"]

export const ROLE_META: Record<WorkspaceRole, { label: string; description: string }> = {
  OWNER: {
    label: "Owner",
    description: "Everything an admin can do, plus promoting owners and deleting the workspace.",
  },
  ADMIN: {
    label: "Admin",
    description: "Invites and removes members, changes member roles and edits workspace settings.",
  },
  MEMBER: {
    label: "Member",
    description: "Works with inventory: items, stock movements, locations and reports.",
  },
}

/** Roles that can be offered in the invite dialog. Owner invitations are intentionally not supported. */
export const INVITABLE_ROLES: WorkspaceRole[] = ["MEMBER", "ADMIN"]

export function normalizeRole(role: string | null | undefined): WorkspaceRole {
  const upper = (role ?? "").toUpperCase()
  return upper === "OWNER" || upper === "ADMIN" ? upper : "MEMBER"
}

export function roleLabel(role: string | null | undefined): string {
  return ROLE_META[normalizeRole(role)].label
}

interface Target {
  role: WorkspaceRole
  isSelf: boolean
}

/**
 * Roles the current user may move `target` to (excluding the target's current role).
 * - nobody changes their own role
 * - OWNER may set any role, but never demote the last owner
 * - ADMIN may switch non-owners between MEMBER and ADMIN
 * - MEMBER can't change roles
 */
export function assignableRoles(actorRole: WorkspaceRole | null, target: Target, ownerCount: number): WorkspaceRole[] {
  if (!actorRole || target.isSelf) return []
  if (actorRole === "OWNER") {
    if (target.role === "OWNER" && ownerCount <= 1) return []
    return ROLES.filter((r) => r !== target.role)
  }
  if (actorRole === "ADMIN") {
    if (target.role === "OWNER") return []
    return (["ADMIN", "MEMBER"] as WorkspaceRole[]).filter((r) => r !== target.role)
  }
  return []
}

/**
 * Only admins remove members, never themselves (from this page), admins can't remove owners
 * and the last owner can never be removed.
 */
export function canRemoveMember(actorRole: WorkspaceRole | null, target: Target, ownerCount: number): boolean {
  if (!actorRole || target.isSelf) return false
  if (actorRole !== "OWNER" && actorRole !== "ADMIN") return false
  if (target.role === "OWNER") return actorRole === "OWNER" && ownerCount > 1
  return true
}
