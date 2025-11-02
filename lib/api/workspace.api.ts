// Client-side API helper functions for workspaces
import type {
  Workspace,
  WorkspaceMember,
  User,
  Subscription,
  Invitation,
  Role,
} from "@prisma/client";
import type { ApiResponse } from "./types";

// ============================================
// Use Prisma's generated types directly
// ============================================

// Workspace with members (for list view)
export type WorkspaceWithMembers = Workspace & {
  members: Array<{
    role: Role;
    lastActive: Date;
  }>;
  subscription: Subscription | null;
  _count: {
    items: number;
    members: number;
  };
};

// Workspace with full details (for detail view)
export type WorkspaceWithDetails = Workspace & {
  members: Array<
    WorkspaceMember & {
      user: Pick<User, "id" | "name" | "email" | "createdAt">;
    }
  >;
  subscription: Subscription | null;
  _count: {
    items: number;
    categories: number;
    locations: number;
    suppliers: number;
  };
};

// Workspace with member info for creation
export type WorkspaceWithMemberInfo = Workspace & {
  members: Array<
    WorkspaceMember & {
      user: Pick<User, "id" | "name" | "email">;
    }
  >;
  subscription: Subscription | null;
};

// Member with user info
export type MemberWithUser = WorkspaceMember & {
  user: Pick<User, "id" | "name" | "email">;
};

// Invitation with workspace
export type InvitationWithWorkspace = Invitation & {
  workspace: Workspace;
};

// ============================================
// Request types
// ============================================

export type CreateWorkspaceRequest = {
  name: string;
  description?: string;
};

export type UpdateWorkspaceRequest = {
  name?: string;
  description?: string;
};

export type InviteUserRequest = {
  email: string;
  role?: Role;
};

export type UpdateMemberRoleRequest = {
  role: Role;
};

// ============================================
// API Response types
// ============================================

export type WorkspaceApiResponse = ApiResponse<{
  workspace?:
    | WorkspaceWithMembers
    | WorkspaceWithDetails
    | WorkspaceWithMemberInfo;
  workspaces?: WorkspaceWithMembers[];
  invitation?: InvitationWithWorkspace;
  member?: MemberWithUser;
}>;

/**
 * Get all workspaces for the current user
 */
export async function getWorkspacesApi(): Promise<WorkspaceApiResponse> {
  const response = await fetch("/api/workspaces", {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch workspaces");
  }

  return result;
}

/**
 * Get a single workspace by ID
 */
export async function getWorkspaceByIdApi(
  id: string
): Promise<WorkspaceApiResponse> {
  const response = await fetch(`/api/workspaces/${id}`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch workspace");
  }

  return result;
}

/**
 * Create a new workspace
 */
export async function createWorkspaceApi(
  data: CreateWorkspaceRequest
): Promise<WorkspaceApiResponse> {
  const response = await fetch("/api/workspaces", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to create workspace");
  }

  return result;
}

/**
 * Update a workspace
 */
export async function updateWorkspaceApi(
  id: string,
  data: UpdateWorkspaceRequest
): Promise<WorkspaceApiResponse> {
  const response = await fetch(`/api/workspaces/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update workspace");
  }

  return result;
}

/**
 * Delete a workspace
 */
export async function deleteWorkspaceApi(
  id: string
): Promise<WorkspaceApiResponse> {
  const response = await fetch(`/api/workspaces/${id}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to delete workspace");
  }

  return result;
}

/**
 * Invite a user to workspace
 */
export async function inviteUserToWorkspaceApi(
  workspaceId: string,
  data: InviteUserRequest
): Promise<WorkspaceApiResponse> {
  const response = await fetch(`/api/workspaces/${workspaceId}/invite`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to invite user");
  }

  return result;
}

/**
 * Remove a member from workspace
 */
export async function removeMemberFromWorkspaceApi(
  workspaceId: string,
  memberId: string
): Promise<WorkspaceApiResponse> {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/members/${memberId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to remove member");
  }

  return result;
}

/**
 * Update member role
 */
export async function updateMemberRoleApi(
  workspaceId: string,
  memberId: string,
  data: UpdateMemberRoleRequest
): Promise<WorkspaceApiResponse> {
  const response = await fetch(
    `/api/workspaces/${workspaceId}/members/${memberId}/role`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update member role");
  }

  return result;
}
