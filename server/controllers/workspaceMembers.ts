import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../utils/prisma";
import { requireMembership, requireUserId } from "../utils/access";
import { sendSuccess } from "../utils/http";
import { parseBody, parseQuery, zEmail, zId, zRole } from "../utils/validate";
import {
  cancelInvitation,
  changeMemberRole,
  createInvitation,
  listPendingInvitations,
  removeMember,
  resendInvitation,
} from "../services/members";

const workspaceQuery = z.object({ workspaceId: zId });

const workspaceMembersController = {
  // GET /api/workspace-members?workspaceId=  (any member)
  getMembers: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await requireMembership(userId, workspaceId);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    });
    return sendSuccess(res, { members });
  },

  // PATCH /api/workspace-members/:memberId/role  { role, workspaceId }  (memberId = WorkspaceMember.id)
  updateMemberRole: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { role, workspaceId } = parseBody(z.object({ workspaceId: zId, role: zRole }), req);
    const member = await changeMemberRole({
      actorUserId: userId,
      workspaceId,
      target: { memberId: req.params.memberId },
      role,
    });
    return sendSuccess(res, { member }, "Member role updated successfully");
  },

  // DELETE /api/workspace-members/:memberId?workspaceId=
  removeMember: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await removeMember({ actorUserId: userId, workspaceId, target: { memberId: req.params.memberId } });
    return sendSuccess(res, {}, "Member removed successfully");
  },

  // POST /api/workspace-members/invite  { email, role, workspaceId }  (ADMIN+)
  inviteMember: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(z.object({ workspaceId: zId, email: zEmail, role: zRole }), req);
    const { invitation, emailSent } = await createInvitation({
      actorUserId: userId,
      workspaceId: body.workspaceId,
      email: body.email,
      role: body.role,
    });
    return sendSuccess(res, { invitation, emailSent }, "Invitation sent successfully", 201);
  },

  // GET /api/workspace-members/invitations?workspaceId=  (ADMIN+; tokens never returned)
  getInvitations: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    const invitations = await listPendingInvitations(userId, workspaceId);
    return sendSuccess(res, { invitations });
  },

  // DELETE /api/workspace-members/invitations/:invitationId?workspaceId=  (ADMIN+)
  cancelInvitation: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(workspaceQuery, req);
    await cancelInvitation(userId, workspaceId, req.params.invitationId);
    return sendSuccess(res, {}, "Invitation cancelled successfully");
  },

  // POST /api/workspace-members/invitations/:invitationId/resend  { workspaceId }  (ADMIN+)
  resendInvitation: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseBody(workspaceQuery, req);
    const emailSent = await resendInvitation(userId, workspaceId, req.params.invitationId);
    return sendSuccess(res, { emailSent }, "Invitation resent successfully");
  },
};

export default workspaceMembersController;
