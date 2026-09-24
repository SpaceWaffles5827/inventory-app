import passport from "passport";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import prisma from "../utils/prisma";
import { authEvents, logAuthEvent } from "../utils/authLog";
import { transformUserForSession } from "../passportConfig";
import { HttpError, sendError, sendSuccess } from "../utils/http";
import { parseBody, zEmail, zText } from "../utils/validate";
import { requireUserId } from "../utils/access";
import {
  appUrl,
  passwordResetEmail,
  sendEmailInBackground,
  welcomeEmail,
} from "../utils/email";
import {
  destroySession,
  destroyUserSessions,
  loginSession,
  logoutSession,
  regenerateSession,
} from "../utils/sessions";
import { isUniqueViolation } from "../utils/stock";
import logger from "../utils/logger";

declare module "express-session" {
  interface SessionData {
    companyId: string;
  }
}

const BCRYPT_ROUNDS = 10;

// bcrypt only looks at the first 72 bytes, so reject longer passwords instead
// of silently truncating them.
const zPassword = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long.")
  .refine((p) => Buffer.byteLength(p, "utf8") <= 72, "Password must be at most 72 bytes long.");

/** SHA-256 of a password reset token; only the hash is stored. */
const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token, "utf8").digest("hex");

const registerSchema = z.object({
  email: zEmail,
  password: zPassword,
  firstName: zText(100),
  lastName: zText(100),
});

const loginSchema = z.object({
  email: z.string({ required_error: "Email is required" }).trim().min(1, "Email is required").max(191),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required").max(1024),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string({ required_error: "All fields are required." }).min(1, "All fields are required."),
    newPassword: zPassword,
    confirmNewPassword: z.string({ required_error: "All fields are required." }),
  })
  .refine((b) => b.newPassword === b.confirmNewPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmNewPassword"],
  });

const resetSchema = z
  .object({
    newPassword: zPassword,
    confirmPassword: z.string({ required_error: "Both new password and confirmation fields are required." }),
  })
  .refine((b) => b.newPassword === b.confirmPassword, {
    message: "New password and confirmation do not match.",
    path: ["confirmPassword"],
  });

/** passport.authenticate as a promise so errors reach the error handler. */
function authenticateLocal(req: Request, res: Response, next: NextFunction) {
  return new Promise<{ user: Express.User | false; info?: { message?: string } }>(
    (resolve, reject) => {
      passport.authenticate(
        "local",
        (err: unknown, user: Express.User | false, info?: { message?: string }) => {
          if (err) return reject(err);
          resolve({ user, info });
        }
      )(req, res, next);
    }
  );
}

const authController = {
  registerUser: async (req: Request, res: Response) => {
    const body = parseBody(registerSchema, req);
    const hashedPassword = await bcrypt.hash(body.password, BCRYPT_ROUNDS);
    const trialEndDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({ where: { email: body.email } });
        if (existing) throw new HttpError(400, "User with this email already exists");

        const newUser = await tx.user.create({
          data: {
            id: nanoid(),
            email: body.email,
            password: hashedPassword,
            name: `${body.firstName} ${body.lastName}`,
          },
        });
        const workspace = await tx.workspace.create({
          data: {
            name: `${body.firstName}'s Workspace`,
            description: "Your personal workspace",
          },
        });
        await tx.workspaceMember.create({
          data: { userId: newUser.id, workspaceId: workspace.id, role: "OWNER" },
        });
        await tx.subscription.create({
          data: {
            workspaceId: workspace.id,
            plan: "STARTER",
            status: "TRIALING",
            currentPeriodStart: new Date(),
            currentPeriodEnd: trialEndDate,
            cancelAtPeriodEnd: false,
          },
        });
        return { user: newUser, workspace };
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(400, "User with this email already exists");
      throw e;
    }

    // Plain welcome email (there is no email-verification step).
    sendEmailInBackground(welcomeEmail({ toEmail: body.email, firstName: body.firstName }));
    void logAuthEvent({ req, eventType: "signup", outcome: "success", userId: result.user.id, emailAttempted: body.email });

    const sessionUser = await transformUserForSession(result.user.id);
    if (!sessionUser) {
      return sendError(res, 500, "Error loading user data", { data: {} });
    }

    try {
      await regenerateSession(req);
      await loginSession(req, sessionUser);
    } catch (err) {
      logger.error("auto-login after registration failed", { error: String(err) });
      return res.status(201).json({
        status: "success",
        message: "User created (but auto-login failed). Please sign in.",
        data: { loggedIn: false },
      });
    }

    return res.status(201).json({
      status: "success",
      message: "User created and logged in!",
      data: { loggedIn: true },
    });
  },

  loginUser: async (req: Request, res: Response, next: NextFunction) => {
    const { email } = parseBody(loginSchema, req);
    const { user, info } = await authenticateLocal(req, res, next);

    if (!user) {
      await authEvents.loginFailure(req, email, "bad_credentials", {
        message: info?.message ?? null,
      });
      return sendError(res, 401, info?.message || "Incorrect username or password.");
    }

    // Second factor: not implemented. `two_factor_enabled` is never set by any
    // code path, so there is deliberately no challenge step here (the old
    // half-built branch could only ever lock users out). When 2FA is built,
    // the challenge belongs here, before a session is created.

    // New session id on every login (prevents session fixation). passport also
    // regenerates inside req.login(); doing it explicitly keeps us safe if that
    // default ever changes.
    await regenerateSession(req);
    await loginSession(req, user);
    await authEvents.loginSuccess(req, user.id, user.email, {});

    return res.json({ status: "success", message: "Login successful" });
  },

  getUserProfile: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!dbUser) return sendError(res, 404, "User not found", { data: {} });

    return sendSuccess(
      res,
      { user: { id: dbUser.id, email: dbUser.email, name: dbUser.name || "" } },
      "User profile retrieved successfully"
    );
  },

  updateUserProfile: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { name } = parseBody(z.object({ name: zText(255) }), req);

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, email: true, name: true },
    });

    return sendSuccess(
      res,
      { user: { id: updatedUser.id, email: updatedUser.email, name: updatedUser.name || "" } },
      "Profile updated successfully"
    );
  },

  logoutUser: async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (req.isAuthenticated()) await logoutSession(req);
    if (userId) {
      await authEvents.logout(req, userId, "user_initiated", { path: req.originalUrl });
    }
    await destroySession(req);
    res.clearCookie("inventory.sid");
    return res.status(200).json({ status: "success", message: "Logout successful" });
  },

  /** PUT /password and POST /change-password (signed-in user). */
  changePassword: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { currentPassword, newPassword } = parseBody(changePasswordSchema, req);

    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });
    if (!dbUser) return sendError(res, 404, "User not found.");
    if (!dbUser.password) {
      return sendError(res, 400, "No password set for this account. Please set a password.");
    }

    // 400 (not 401) so the client doesn't treat a typo as an expired session.
    if (!(await bcrypt.compare(currentPassword, dbUser.password))) {
      return sendError(res, 400, "Current password is incorrect.");
    }
    if (await bcrypt.compare(newPassword, dbUser.password)) {
      return sendError(res, 400, "New password must be different from the current password.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Sign out every other device; keep the session that made the change.
    const revoked = await destroyUserSessions(userId, req.sessionID);

    return res.json({
      status: "success",
      message: "Password has been updated successfully.",
      data: { otherSessionsRevoked: revoked },
    });
  },

  requestPasswordChange: async (req: Request, res: Response) => {
    const { email, inviteCompanyId } = parseBody(
      z.object({
        email: z.string().max(191).optional(),
        inviteCompanyId: z.string().max(191).optional(),
      }),
      req
    );
    const normalizedEmail = (email ?? "").trim().toLowerCase();

    const user = normalizedEmail
      ? await prisma.user.findFirst({
          where: { email: normalizedEmail },
          select: { id: true, email: true },
        })
      : null;

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: hashToken(rawToken),
          passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      let resetUrl = `${appUrl()}/reset-password?token=${rawToken}&pemail=${encodeURIComponent(normalizedEmail)}`;
      if (inviteCompanyId) resetUrl += `&pinvitecompany=${encodeURIComponent(inviteCompanyId)}`;

      sendEmailInBackground(passwordResetEmail({ toEmail: user.email, resetUrl }));
      void logAuthEvent({ req, eventType: "password_reset_request", outcome: "pending", userId: user.id, emailAttempted: normalizedEmail });
    }

    // Same response whether or not the account exists.
    return res.json({
      status: "success",
      message: "If an account with this email address exists, a password reset link has been sent.",
    });
  },

  resetPasswordWithToken: async (req: Request, res: Response) => {
    const token = String(req.params.token ?? "").trim();
    const { newPassword } = parseBody(resetSchema, req);

    const invalid = () => sendError(res, 400, "Password reset token is invalid or has expired");
    if (!token || token.length > 256) return invalid();

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashToken(token),
        passwordResetExpires: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!user) return invalid();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    // Whoever had the old password is signed out everywhere.
    await destroyUserSessions(user.id);
    void logAuthEvent({ req, eventType: "password_reset_success", outcome: "success", userId: user.id });

    return res.json({ status: "success", message: "Your password was updated successfully!" });
  },
};

export default authController;
