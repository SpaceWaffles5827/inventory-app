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
  const response = await fetch(
    `/api/workspace-members?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch members");
  }

  return result;
}

/**
 * Update member role
 */
export async function updateMemberRoleApi(
  memberId: string,
  role: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  const response = await fetch(`/api/workspace-members/${memberId}/role`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ role, workspaceId }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to update member role");
  }

  return result;
}

/**
 * Remove member from workspace
 */
export async function removeMemberApi(
  memberId: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  const response = await fetch(
    `/api/workspace-members/${memberId}?workspaceId=${encodeURIComponent(
      workspaceId
    )}`,
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
 * Invite member to workspace
 */
export async function inviteMemberApi(
  email: string,
  role: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  const response = await fetch("/api/workspace-members/invite", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, role, workspaceId }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to invite member");
  }

  return result;
}

/**
 * Get pending invitations
 */
export async function getInvitationsApi(
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  const response = await fetch(
    `/api/workspace-members/invitations?workspaceId=${encodeURIComponent(
      workspaceId
    )}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch invitations");
  }

  return result;
}

/**
 * Cancel invitation
 */
export async function cancelInvitationApi(
  invitationId: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  const response = await fetch(
    `/api/workspace-members/invitations/${invitationId}?workspaceId=${encodeURIComponent(
      workspaceId
    )}`,
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
    throw new Error(result.message || "Failed to cancel invitation");
  }

  return result;
}

/**
 * Resend invitation
 */
export async function resendInvitationApi(
  invitationId: string,
  workspaceId: string
): Promise<WorkspaceMembersApiResponse> {
  const response = await fetch(
    `/api/workspace-members/invitations/${invitationId}/resend`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ workspaceId }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to resend invitation");
  }

  return result;
}
