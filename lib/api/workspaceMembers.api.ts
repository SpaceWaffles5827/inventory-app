import { apiRequest } from "./client";

export interface WorkspaceMember {
  id: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  joinedAt: string;
  lastActive: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

export interface Invitation {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: string;
  createdAt: string;
  expiresAt: string;
}

export interface WorkspaceMembersApiResponse {
  status: "success" | "error";
  message?: string;
  data?: {
    members?: WorkspaceMember[];
    member?: WorkspaceMember;
    invitations?: Invitation[];
    invitation?: Invitation;
  };
}

/**
 * Get all members in a workspace
 */
export async function getMembersApi(
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  return apiRequest<WorkspaceMembersApiResponse>("/api/workspace-members", {
    query: { workspaceId },
    errorMessage: "Failed to fetch members",
  });
}

/**
 * Update member role
 */
export async function updateMemberRoleApi(
  memberId: string,
  role: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  return apiRequest<WorkspaceMembersApiResponse>(
    `/api/workspace-members/${memberId}/role`,
    {
      method: "PATCH",
      body: { role, workspaceId },
      errorMessage: "Failed to update member role",
    }
  );
}

/**
 * Remove member from workspace
 */
export async function removeMemberApi(
  memberId: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  return apiRequest<WorkspaceMembersApiResponse>(
    `/api/workspace-members/${memberId}`,
    {
      method: "DELETE",
      query: { workspaceId },
      errorMessage: "Failed to remove member",
    }
  );
}

/**
 * Invite member to workspace
 */
export async function inviteMemberApi(
  email: string,
  role: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  return apiRequest<WorkspaceMembersApiResponse>(
    "/api/workspace-members/invite",
    {
      method: "POST",
      body: { email, role, workspaceId },
      errorMessage: "Failed to invite member",
    }
  );
}

/**
 * Get pending invitations
 */
export async function getInvitationsApi(
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  return apiRequest<WorkspaceMembersApiResponse>(
    "/api/workspace-members/invitations",
    {
      query: { workspaceId },
      errorMessage: "Failed to fetch invitations",
    }
  );
}

/**
 * Cancel invitation
 */
export async function cancelInvitationApi(
  invitationId: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  return apiRequest<WorkspaceMembersApiResponse>(
    `/api/workspace-members/invitations/${invitationId}`,
    {
      method: "DELETE",
      query: { workspaceId },
      errorMessage: "Failed to cancel invitation",
    }
  );
}

/**
 * Resend invitation
 */
export async function resendInvitationApi(
  invitationId: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  return apiRequest<WorkspaceMembersApiResponse>(
    `/api/workspace-members/invitations/${invitationId}/resend`,
    {
      method: "POST",
      body: { workspaceId },
      errorMessage: "Failed to resend invitation",
    }
  );
}
