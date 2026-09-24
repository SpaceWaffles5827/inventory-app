// Public invitation endpoints. Invitations are looked up ONLY by their random
// `token` (never by row id), and the email must match the invitation.
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import prisma from "../utils/prisma";
import { HttpError, badRequest, notFound, sendError, sendSuccess } from "../utils/http";
import { parseBody, parseQuery, zEmail, zOptionalText } from "../utils/validate";
import { isUniqueViolation } from "../utils/stock";

const zToken = z.string().trim().min(1).max(128);

async function loadValidInvitation(token: string, email: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (!invitation) throw notFound("Invitation not found");
  if (invitation.email.toLowerCase() !== email.toLowerCase()) {
    throw badRequest("Email does not match invitation");
  }
  if (invitation.status === "PENDING" && invitation.expiresAt <= new Date()) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { status: "EXPIRED" } });
    throw badRequest("This invitation has expired");
  }
  if (invitation.status === "EXPIRED") throw badRequest("This invitation has expired");
  if (invitation.status !== "PENDING") throw badRequest("This invitation is no longer valid");
  return invitation;
}

const invitationsController = {
  // GET /api/invitations/verify?token=&email=
  verifyInvitation: async (req: Request, res: Response) => {
    const q = parseQuery(z.object({ token: zToken, email: zEmail }), req);
    const invitation = await loadValidInvitation(q.token, q.email);
    const existingUser = await prisma.user.findFirst({
      where: { email: q.email },
      select: { id: true },
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token, ...publicInvitation } = invitation;
    return sendSuccess(res, { invitation: publicInvitation, isExistingUser: !!existingUser });
  },

  // POST /api/invitations/accept  { token, email, password, name? }
  acceptInvitation: async (req: Request, res: Response) => {
    const body = parseBody(
      z.object({
        token: zToken,
        email: zEmail,
        name: zOptionalText(191),
        password: z.string({ required_error: "Password is required" }).min(1, "Password is required").max(1024),
      }),
      req
    );
    const invitation = await loadValidInvitation(body.token, body.email);

    const existingUser = await prisma.user.findFirst({ where: { email: body.email } });
    let newUserPasswordHash: string | null = null;

    if (existingUser) {
      if (!(await bcrypt.compare(body.password, existingUser.password))) {
        return sendError(res, 401, "Invalid password");
      }
      const alreadyMember = await prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: { userId: existingUser.id, workspaceId: invitation.workspaceId },
        },
        select: { id: true },
      });
      if (alreadyMember) throw badRequest("You are already a member of this workspace");
    } else {
      if (!body.name) throw badRequest("Name is required for new users");
      if (body.password.length < 8) throw badRequest("Password must be at least 8 characters long.");
      if (Buffer.byteLength(body.password, "utf8") > 72) {
        throw badRequest("Password must be at most 72 bytes long.");
      }
      newUserPasswordHash = await bcrypt.hash(body.password, 10);
    }

    let userId: string;
    try {
      userId = await prisma.$transaction(async (tx) => {
        // Claim the invitation atomically: a second concurrent accept gets 0 rows.
        const claimed = await tx.invitation.updateMany({
          where: { id: invitation.id, status: "PENDING" },
          data: { status: "ACCEPTED" },
        });
        if (claimed.count === 0) throw new HttpError(409, "This invitation has already been used");

        const user =
          existingUser ??
          (await tx.user.create({
            data: { email: body.email, name: body.name!, password: newUserPasswordHash! },
          }));

        await tx.workspaceMember.create({
          data: { userId: user.id, workspaceId: invitation.workspaceId, role: invitation.role },
        });
        return user.id;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw badRequest("An account or membership for this email already exists");
      }
      throw e;
    }

    return sendSuccess(res, { userId }, "Invitation accepted successfully");
  },
};

export default invitationsController;
