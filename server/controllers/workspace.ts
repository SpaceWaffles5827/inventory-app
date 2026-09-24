import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../utils/prisma";
import { PERMISSIONS, requireMembership, requireUserId } from "../utils/access";
import { forbidden, notFound, sendSuccess } from "../utils/http";
import { parseBody, zEmail, zOptionalText, zRole, zText } from "../utils/validate";
import { changeMemberRole, createInvitation, removeMember } from "../services/members";

const memberUserSelect = { select: { id: true, name: true, email: true } } as const;

const workspaceController = {
  // POST /api/workspaces — creator becomes OWNER
  createWorkspace: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(
      z.object({ name: zText(191), description: zOptionalText(191) }),
      req
    );

    const workspace = await prisma.workspace.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        members: { create: { userId, role: "OWNER" } },
        subscription: {
          create: {
            plan: "STARTER",
            status: "TRIALING",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        },
      },
      include: { members: { include: { user: memberUserSelect } }, subscription: true },
    });
    return sendSuccess(res, { workspace }, "Workspace created successfully", 201);
  },

  // GET /api/workspaces
  getUserWorkspaces: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const workspaces = await prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { where: { userId }, select: { role: true, lastActive: true } },
        subscription: true,
        _count: { select: { items: true, members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return sendSuccess(res, { workspaces });
  },

  // GET /api/workspaces/:id
  getWorkspaceById: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
        },
        subscription: true,
        _count: { select: { items: true, categories: true, locations: true, suppliers: true } },
      },
    });
    if (!workspace) throw notFound("Workspace not found");
    if (!workspace.members.some((m) => m.userId === userId)) {
      throw forbidden("You don't have access to this workspace");
    }
    return sendSuccess(res, { workspace });
  },

  // PATCH /api/workspaces/:id (ADMIN+)
  updateWorkspace: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const body = parseBody(
      z.object({ name: zText(191).optional(), description: zOptionalText(191) }),
      req
    );
    await requireMembership(userId, id, PERMISSIONS.workspaceSettings, {
      message: "You don't have permission to update this workspace",
    });

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      },
      include: { members: { include: { user: memberUserSelect } }, subscription: true },
    });
    return sendSuccess(res, { workspace }, "Workspace updated successfully");
  },

  // DELETE /api/workspaces/:id (OWNER only)
  deleteWorkspace: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    await requireMembership(userId, id, PERMISSIONS.deleteWorkspace, {
      message: "Only workspace owners can delete workspaces",
    });
    await prisma.workspace.delete({ where: { id } });
    return sendSuccess(res, {}, "Workspace deleted successfully");
  },

  // POST /api/workspaces/:id/invite  { email, role? } — same rules + email as /workspace-members/invite
  inviteUser: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(
      z.object({ email: zEmail, role: zRole.optional().default("MEMBER") }),
      req
    );
    const { invitation, emailSent } = await createInvitation({
      actorUserId: userId,
      workspaceId: req.params.id,
      email: body.email,
      role: body.role,
    });
    return sendSuccess(res, { invitation, emailSent }, "Invitation sent successfully", 201);
  },

  // DELETE /api/workspaces/:id/members/:memberId  (memberId = the member's USER id here)
  removeMember: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    await removeMember({
      actorUserId: userId,
      workspaceId: req.params.id,
      target: { userId: req.params.memberId },
    });
    return sendSuccess(res, {}, "Member removed successfully");
  },

  // PATCH /api/workspaces/:id/members/:memberId/role  { role }  (memberId = USER id)
  updateMemberRole: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { role } = parseBody(z.object({ role: zRole }), req);
    const member = await changeMemberRole({
      actorUserId: userId,
      workspaceId: req.params.id,
      target: { userId: req.params.memberId },
      role,
    });
    return sendSuccess(res, { member }, "Member role updated successfully");
  },
};

export default workspaceController;
