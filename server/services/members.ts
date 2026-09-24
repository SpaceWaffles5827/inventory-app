// Membership + invitation rules shared by /api/workspace-members and
// /api/workspaces/:id/... so both entry points behave identically.
//
// Role changes
//   - nobody changes their own role
//   - OWNER may set any role on anyone else, but the last owner can't be demoted
//   - ADMIN may set MEMBER/ADMIN on non-owners only
//   - MEMBER may not change roles
// Removal
//   - nobody removes themselves here
//   - ADMIN may remove MEMBERs and ADMINs; only an OWNER may remove an OWNER,
//     and never the last one
// Invitations
//   - ADMIN+ may invite as MEMBER/ADMIN; only an OWNER may invite an OWNER
//   - the link carries a random token (not the row id); only ADMIN+ can list
import crypto from "crypto";
import { Prisma, Role } from "@prisma/client";
import prisma from "../utils/prisma";
import { requireMembership } from "../utils/access";
import { HttpError, badRequest, forbidden, notFound } from "../utils/http";
import { appUrl, invitationEmail, sendEmail } from "../utils/email";
import logger from "../utils/logger";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const memberUserInclude = {
  user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.WorkspaceMemberInclude;

/** Invitation fields safe to return to clients (never the token). */
export const invitationPublicOmit = { token: true } as const;

export const newInvitationToken = () => crypto.randomBytes(32).toString("base64url");

/** Lock the workspace's owner rows so concurrent demotions can't remove the last owner. */
async function lockOwners(tx: Prisma.TransactionClient, workspaceId: string) {
  await tx.$queryRaw`SELECT id FROM workspace_members WHERE workspaceId = ${workspaceId} AND role = 'OWNER' FOR UPDATE`;
}

type TargetRef = { memberId: string } | { userId: string };

async function findTarget(tx: Prisma.TransactionClient, workspaceId: string, ref: TargetRef) {
  const target = await tx.workspaceMember.findFirst({
    where: { workspaceId, ...("memberId" in ref ? { id: ref.memberId } : { userId: ref.userId }) },
    include: memberUserInclude,
  });
  if (!target) throw notFound("Member not found");
  return target;
}

export async function changeMemberRole(args: {
  actorUserId: string;
  workspaceId: string;
  target: TargetRef;
  role: Role;
}) {
  return prisma.$transaction(async (tx) => {
    await lockOwners(tx, args.workspaceId);
    const actor = await requireMembership(args.actorUserId, args.workspaceId, "ADMIN", {
      db: tx,
      message: "You don't have permission to update member roles",
    });
    const target = await findTarget(tx, args.workspaceId, args.target);

    if (target.userId === args.actorUserId) throw forbidden("You can't change your own role");
    if (actor.role !== "OWNER") {
      if (target.role === "OWNER") throw forbidden("Only owners can change an owner's role");
      if (args.role === "OWNER") throw forbidden("Only owners can grant the owner role");
    }
    if (target.role === args.role) return target;

    if (target.role === "OWNER") {
      const owners = await tx.workspaceMember.count({
        where: { workspaceId: args.workspaceId, role: "OWNER" },
      });
      if (owners <= 1) throw badRequest("A workspace must keep at least one owner");
    }

    return tx.workspaceMember.update({
      where: { id: target.id },
      data: { role: args.role },
      include: memberUserInclude,
    });
  });
}

export async function removeMember(args: {
  actorUserId: string;
  workspaceId: string;
  target: TargetRef;
}) {
  await prisma.$transaction(async (tx) => {
    await lockOwners(tx, args.workspaceId);
    const actor = await requireMembership(args.actorUserId, args.workspaceId, "ADMIN", {
      db: tx,
      message: "You don't have permission to remove members",
    });
    const target = await findTarget(tx, args.workspaceId, args.target);

    if (target.userId === args.actorUserId) {
      throw badRequest("You cannot remove yourself from the workspace");
    }
    if (target.role === "OWNER") {
      if (actor.role !== "OWNER") throw forbidden("Only owners can remove other owners");
      const owners = await tx.workspaceMember.count({
        where: { workspaceId: args.workspaceId, role: "OWNER" },
      });
      if (owners <= 1) throw badRequest("Cannot remove the last owner of a workspace");
    }

    await tx.workspaceMember.delete({ where: { id: target.id } });
  });
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

const invitationLink = (token: string, email: string) =>
  `${appUrl()}/accept-invitation?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

async function deliverInvitation(args: {
  token: string;
  email: string;
  workspaceName: string;
  inviterName: string;
}): Promise<boolean> {
  return sendEmail(
    invitationEmail({
      toEmail: args.email,
      workspaceName: args.workspaceName,
      inviterName: args.inviterName,
      invitationLink: invitationLink(args.token, args.email),
    })
  );
}

async function inviterName(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return u?.name || u?.email || "A teammate";
}

export async function createInvitation(args: {
  actorUserId: string;
  workspaceId: string;
  email: string;
  role: Role;
}) {
  const actor = await requireMembership(args.actorUserId, args.workspaceId, "ADMIN", {
    message: "You don't have permission to invite members",
  });
  if (args.role === "OWNER" && actor.role !== "OWNER") {
    throw forbidden("Only owners can invite new owners");
  }
  const email = args.email.trim().toLowerCase();

  const existingMember = await prisma.workspaceMember.findFirst({
    where: { workspaceId: args.workspaceId, user: { email } },
    select: { id: true },
  });
  if (existingMember) throw badRequest("User is already a member of this workspace");

  // Pending invites past their expiry no longer block a new one.
  await prisma.invitation.updateMany({
    where: { workspaceId: args.workspaceId, email, status: "PENDING", expiresAt: { lte: new Date() } },
    data: { status: "EXPIRED" },
  });
  const pending = await prisma.invitation.findFirst({
    where: { workspaceId: args.workspaceId, email, status: "PENDING" },
    select: { id: true },
  });
  if (pending) throw badRequest("Invitation already sent to this email");

  const token = newInvitationToken();
  const invitation = await prisma.invitation.create({
    data: {
      email,
      role: args.role,
      workspaceId: args.workspaceId,
      token,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
    omit: invitationPublicOmit,
    include: { workspace: { select: { id: true, name: true } } },
  });

  let emailSent = false;
  try {
    emailSent = await deliverInvitation({
      token,
      email,
      workspaceName: invitation.workspace.name,
      inviterName: await inviterName(args.actorUserId),
    });
  } catch (err) {
    // The invitation exists; the admin can resend.
    logger.error("failed to send invitation email", { invitationId: invitation.id, error: String(err) });
  }

  return { invitation, emailSent };
}

export async function listPendingInvitations(actorUserId: string, workspaceId: string) {
  await requireMembership(actorUserId, workspaceId, "ADMIN", {
    message: "You don't have permission to view invitations",
  });
  return prisma.invitation.findMany({
    where: { workspaceId, status: "PENDING" },
    omit: invitationPublicOmit,
    orderBy: { createdAt: "desc" },
  });
}

export async function cancelInvitation(actorUserId: string, workspaceId: string, invitationId: string) {
  await requireMembership(actorUserId, workspaceId, "ADMIN", {
    message: "You don't have permission to cancel invitations",
  });
  const res = await prisma.invitation.updateMany({
    where: { id: invitationId, workspaceId },
    data: { status: "CANCELLED" },
  });
  if (res.count === 0) throw notFound("Invitation not found");
}

/** New token (old links stop working) + fresh 7-day expiry + email. */
export async function resendInvitation(actorUserId: string, workspaceId: string, invitationId: string) {
  await requireMembership(actorUserId, workspaceId, "ADMIN", {
    message: "You don't have permission to resend invitations",
  });
  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, workspaceId },
    include: { workspace: { select: { name: true } } },
  });
  if (!invitation) throw notFound("Invitation not found");
  if (invitation.status !== "PENDING" && invitation.status !== "EXPIRED") {
    throw badRequest("Only pending invitations can be resent");
  }

  const token = newInvitationToken();
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { token, status: "PENDING", expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
  });

  try {
    return await deliverInvitation({
      token,
      email: invitation.email,
      workspaceName: invitation.workspace.name,
      inviterName: await inviterName(actorUserId),
    });
  } catch (err) {
    logger.error("failed to resend invitation email", { invitationId, error: String(err) });
    throw new HttpError(500, "Failed to send invitation email. Please try again.");
  }
}
