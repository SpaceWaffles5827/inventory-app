// Client-side API helper functions for invitations
import type { Invitation, Workspace } from "@prisma/client";
import type { ApiResponse } from "./types";

// ============================================
// Use Prisma's generated types directly
// ============================================

// Invitation with workspace info
export type InvitationWithWorkspace = Invitation & {
  workspace: Pick<Workspace, "id" | "name">;
};

// ============================================
// Request types
// ============================================

export type VerifyInvitationRequest = {
  token: string;
  email: string;
};

export type AcceptInvitationRequest = {
  token: string;
  email: string;
  password: string;
  name?: string; // Required for new users
};

// ============================================
// API Response types
// ============================================

export type InvitationApiResponse = ApiResponse<{
  invitation?: InvitationWithWorkspace;
  isExistingUser?: boolean;
  userId?: string;
}>;

/**
 * Verify an invitation token
 */
export async function verifyInvitationApi(
  data: VerifyInvitationRequest
): Promise<InvitationApiResponse> {
  const params = new URLSearchParams({
    token: data.token,
    email: data.email,
  });

  const response = await fetch(`/api/invitations/verify?${params}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to verify invitation");
  }

  return result;
}

/**
 * Accept an invitation and join workspace
 */
export async function acceptInvitationApi(
  data: AcceptInvitationRequest
): Promise<InvitationApiResponse> {
  const response = await fetch("/api/invitations/accept", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to accept invitation");
  }

  return result;
}
