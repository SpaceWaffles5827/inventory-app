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
import { apiRequest } from "./client";

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
  return apiRequest<WorkspaceApiResponse>("/api/workspaces", {
    errorMessage: "Failed to fetch workspaces",
  });
}

/**
 * Get a single workspace by ID
 */
export async function getWorkspaceByIdApi(
  id: string
): Promise<WorkspaceApiResponse> {
  return apiRequest<WorkspaceApiResponse>(`/api/workspaces/${id}`, {
    errorMessage: "Failed to fetch workspace",
  });
}

/**
 * Create a new workspace
 */
export async function createWorkspaceApi(
  data: CreateWorkspaceRequest
): Promise<WorkspaceApiResponse> {
  return apiRequest<WorkspaceApiResponse>("/api/workspaces", {
    method: "POST",
    body: data,
    errorMessage: "Failed to create workspace",
  });
}

/**
 * Update a workspace
 */
export async function updateWorkspaceApi(
  id: string,
  data: UpdateWorkspaceRequest
): Promise<WorkspaceApiResponse> {
  return apiRequest<WorkspaceApiResponse>(`/api/workspaces/${id}`, {
    method: "PATCH",
    body: data,
    errorMessage: "Failed to update workspace",
  });
}

/**
 * Delete a workspace
 */
export async function deleteWorkspaceApi(
  id: string
): Promise<WorkspaceApiResponse> {
  return apiRequest<WorkspaceApiResponse>(`/api/workspaces/${id}`, {
    method: "DELETE",
    errorMessage: "Failed to delete workspace",
  });
}

/**
 * Invite a user to workspace
 */
export async function inviteUserToWorkspaceApi(
  workspaceId: string,
  data: InviteUserRequest
): Promise<WorkspaceApiResponse> {
  return apiRequest<WorkspaceApiResponse>(
    `/api/workspaces/${workspaceId}/invite`,
    {
      method: "POST",
      body: data,
      errorMessage: "Failed to invite user",
    }
  );
}

/**
 * Remove a member from workspace
 */
export async function removeMemberFromWorkspaceApi(
  workspaceId: string,
  memberId: string
): Promise<WorkspaceApiResponse> {
  return apiRequest<WorkspaceApiResponse>(
    `/api/workspaces/${workspaceId}/members/${memberId}`,
    {
      method: "DELETE",
      errorMessage: "Failed to remove member",
    }
  );
}

/**
 * Update member role
 */
export async function updateMemberRoleApi(
  workspaceId: string,
  memberId: string,
  data: UpdateMemberRoleRequest
): Promise<WorkspaceApiResponse> {
  return apiRequest<WorkspaceApiResponse>(
    `/api/workspaces/${workspaceId}/members/${memberId}/role`,
    {
      method: "PATCH",
      body: data,
      errorMessage: "Failed to update member role",
    }
  );
}
