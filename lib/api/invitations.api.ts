// Client-side API helper functions for invitations
import type { Invitation, Workspace } from "@prisma/client";
import type { ApiResponse } from "./types";
import { apiRequest } from "./client";

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
  return apiRequest<InvitationApiResponse>("/api/invitations/verify", {
    query: { token: data.token, email: data.email },
    errorMessage: "Failed to verify invitation",
    redirectOnUnauthorized: false,
  });
}

/**
 * Accept an invitation and join workspace
 */
export async function acceptInvitationApi(
  data: AcceptInvitationRequest
): Promise<InvitationApiResponse> {
  return apiRequest<InvitationApiResponse>("/api/invitations/accept", {
    method: "POST",
    body: data,
    errorMessage: "Failed to accept invitation",
    redirectOnUnauthorized: false,
  });
}
