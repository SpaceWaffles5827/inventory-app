import passport from "passport";
import bcrypt from "bcrypt";
import { Prisma } from "@prisma/client";
import prisma from "../utils/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";
import { authEvents } from "../utils/authLog";
import { User } from "@prisma/client";
import { transformUserForSession } from "../passportConfig";

declare module "express-session" {
  interface SessionData {
    companyId: string;
  }
}

const authController = {
  registerUser: async (req: Request, res: Response) => {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const currentDate = new Date();
    const trialEndDate = new Date(
      currentDate.setDate(currentDate.getDate() + 7)
    );
    const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
    const userId = nanoid();

    try {
      if (
        !req.body.password ||
        !req.body.email ||
        !req.body.firstName ||
        !req.body.lastName
      ) {
        return res.status(400).json({
          status: "error",
          message: "All fields are required.",
          data: {},
        });
      }

      if (!req.body.email.match(/^\S+@\S+\.\S+$/)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid email format.",
          data: {},
        });
      }

      if (req.body.password.length < 8) {
        return res.status(400).json({
          status: "error",
          message: "Password should be at least 8 characters long.",
          data: {},
        });
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({
          where: { email: req.body.email },
        });

        if (existing) {
          throw new Error("USER_EXISTS");
        }

        // Create the user
        const newUser = await tx.user.create({
          data: {
            id: userId,
            email: req.body.email,
            password: hashedPassword,
            name: `${req.body.firstName} ${req.body.lastName}`,
          },
        });

        // Create default workspace
        const workspace = await tx.workspace.create({
          data: {
            name: `${req.body.firstName}'s Workspace`,
            description: "Your personal workspace",
          },
        });

        // Add user as workspace owner
        await tx.workspaceMember.create({
          data: {
            userId: newUser.id,
            workspaceId: workspace.id,
            role: "OWNER",
          },
        });

        // Create trial subscription
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

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.GOOGLE_EMAIL_USER,
          pass: process.env.GOOGLE_APP_PASSWORD,
        },
      });

      const mailOptions = {
        from: process.env.DONOTREPLY_EMAIL,
        to: req.body.email,
        subject: "Your inventory-app Verification Code",
        text: `Hi ${req.body.firstName},\n\nYour verification code is: ${emailCode}\n\nIf you did not request this, please ignore this email.`,
        html: `
        <html>
          <body style="font-family: Arial, sans-serif; color: #333; background-color: #f9f9f9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 30px; text-align: center; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <h1 style="color: #1B87EA; margin-bottom: 20px;">Welcome to inventory-app!</h1>
              <p style="font-size: 16px;">Hi <strong>${req.body.firstName}</strong>,</p>
              <p style="font-size: 16px;">Use the verification code below to confirm your email address:</p>
              <p style="font-size: 28px; font-weight: bold; color: #1B87EA; margin: 20px 0;">${emailCode}</p>
              <p style="font-size: 14px; color: #555;">If you did not request this, please ignore this email.</p>
            </div>
          </body>
        </html>
      `,
      };

      transporter.sendMail(mailOptions, (error) => {
        if (error) {
          console.error("Failed to send email: ", error);
        }
      });

      const sessionUser = await transformUserForSession(result.user.id);
      if (!sessionUser) {
        return res.status(500).json({
          status: "error",
          message: "Error loading user data",
          data: {},
        });
      }

      req.login(sessionUser, (err) => {
        if (err) {
          console.error("Auto-login failed:", err);
          return res.status(201).json({
            status: "success",
            message: "User created (but auto-login failed). Please sign in.",
            data: { loggedIn: false },
          });
        }

        res.status(201).json({
          status: "success",
          message: "User created and logged in!",
          data: { loggedIn: true },
        });
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "USER_EXISTS") {
        return res.status(400).json({
          status: "error",
          message: "User with this email already exists",
          data: {},
        });
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return res.status(400).json({
          status: "error",
          message: "User with this email already exists",
          data: {},
        });
      }

      console.error("Server error: ", error);
      res.status(500).json({
        status: "error",
        message: "Server error",
        data: {},
      });
    }
  },

  loginUser: async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate(
      "local",
      async (err: Error, user: User | false, info: { message: string }) => {
        // await authEvents.loginAttempt(req, req.body.login ?? null);
        if (err) {
          await authEvents.loginFailure(
            req,
            req.body.login ?? null,
            "internal_error",
            { message: err.message }
          );
          return res.status(500).json({
            message: "An error occurred while processing your request.",
          });
        }

        if (!user) {
          await authEvents.loginFailure(
            req,
            req.body.login ?? null,
            "bad_credentials",
            { message: info?.message }
          );
          return res.status(401).json({ message: info.message });
        }

        // ----- 2FA flow -----
        const twoFAEnabled = !!user.two_factor_enabled;

        if (twoFAEnabled) {
          const providedCode = String(req.body.twoFactorCode ?? "");

          // No code provided: generate, store, email, and stop here
          if (!providedCode) {
            const twoFactorCode = String(
              Math.floor(100000 + Math.random() * 900000)
            );

            await prisma.user.update({
              where: { id: user.id },
              data: { two_factor_code: twoFactorCode },
            });

            const mailOptions = {
              from: process.env.DONOTREPLY_EMAIL,
              to: user.email,
              subject: "Two-Factor Code",
              text: `Hi ${user.name},\n\nYour two-factor authentication code is: ${twoFactorCode}\n\nIf you did not request this code, please ignore this message.\n`,
              html: `
                <html>
                  <body style="font-family: Arial, sans-serif; color: #333;">
                    <div style="max-width: 600px; margin: 20px auto; border: 1px solid #ddd; padding: 20px; text-align: center;">
                      <h1 style="color: #1B87EA;">Two-Factor Authentication</h1>
                      <p style="font-size: 16px;">Hi <strong>${user.name}</strong>,</p>
                      <p style="font-size: 16px;">Your two-factor authentication code is:</p>
                      <p style="font-size: 24px; font-weight: bold;">${twoFactorCode}</p>
                      <p style="font-size: 14px;">If you did not request this code, please ignore this message.</p>
                    </div>
                  </body>
                </html>`,
            };

            const transporter = nodemailer.createTransport({
              service: "gmail",
              auth: {
                user: process.env.GOOGLE_EMAIL_USER,
                pass: process.env.GOOGLE_APP_PASSWORD,
              },
            });

            transporter.sendMail(mailOptions, function (error) {
              if (error) {
                console.error("Failed to send email: ", error);
              }
            });

            await authEvents.twoFAChallenge(
              req,
              user.id,
              user.email,
              "email_code"
            );

            return res.status(401).json({
              message: "Two factor code required.",
              data: { twoFactorEnabled: true },
            });
          }

          // Code provided: validate against DB (not the passport user object)
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { two_factor_code: true },
          });

          if (
            !dbUser ||
            String(dbUser.two_factor_code ?? "") !== providedCode
          ) {
            await authEvents.twoFAFailure(
              req,
              user.id,
              user.email,
              "email_code"
            );
            return res.status(401).json({
              message: "Two factor code is incorrect.",
              data: { twoFactorEnabled: true },
            });
          }
        }

        const sessionUser = await transformUserForSession(user.id);
        if (!sessionUser) {
          await authEvents.loginFailure(
            req,
            user.email,
            "internal_error",
            { message: "Error loading user data" },
            user.id
          );
          return res.status(500).json({
            message: "An error occurred while processing your request.",
          });
        }

        req.login(sessionUser, async (loginErr: Error) => {
          if (loginErr) {
            await authEvents.loginFailure(
              req,
              user.email,
              "internal_error",
              { message: loginErr.message },
              user.id
            );
            return res.status(500).json({
              message: "An error occurred while processing your request.",
            });
          }

          await authEvents.loginSuccess(req, user.id, user.email, {
            two_factor_enabled: twoFAEnabled,
            two_factor_passed: twoFAEnabled ? !!req.body.twoFactorCode : false,
          });

          // Prevent 2FA code reuse
          if (twoFAEnabled) {
            await prisma.user.update({
              where: { id: user.id },
              data: { two_factor_code: null },
            });
          }

          return res.json({
            status: "success",
            message: "Login successful",
          });
        });
      }
    )(req, res, next);
  },

  getUserProfile: async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
        data: {},
      });
    }

    try {
      const userId = user.id;

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      if (!dbUser) {
        return res.status(404).json({
          status: "error",
          message: "User not found",
          data: {},
        });
      }

      return res.json({
        status: "success",
        message: "User profile retrieved successfully",
        data: {
          user: {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || "",
          },
        },
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return res.status(500).json({
        status: "error",
        message: "Server error",
        data: {},
      });
    }
  },

  updateUserProfile: async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
        data: {},
      });
    }

    const userId = user.id as string;
    const { name } = req.body as { name?: string };

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        status: "error",
        message: "Name is required",
        data: {},
      });
    }

    if (name.trim().length > 255) {
      return res.status(400).json({
        status: "error",
        message: "Name must be 255 characters or less",
        data: {},
      });
    }

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { name: name.trim() },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      return res.json({
        status: "success",
        message: "Profile updated successfully",
        data: {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name || "",
          },
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res.status(404).json({
            status: "error",
            message: "User not found",
            data: {},
          });
        }
      }
      console.error("Error updating user profile:", error);
      return res.status(500).json({
        status: "error",
        message: "Server error",
        data: {},
      });
    }
  },

  logoutUser: async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as User | undefined;

    req.logout(async (err: Error) => {
      if (err) return next(err);

      try {
        if (user?.id) {
          // log the logout event
          await authEvents.logout(req, user.id, "user_initiated", {
            path: req.originalUrl,
          });
        }
      } catch (e) {
        console.error("[auth] logout log failed:", e);
      }

      // OPTIONAL: fully destroy the server-side session to prevent reuse
      // (Passport clears auth info; this removes the session record too)
      if (req.session) {
        req.session.destroy((e) => {
          if (e) console.error("[auth] session destroy failed:", e);
        });
      }

      res.status(200).json({ message: "Logout successful" });
    });
  },

  updatePassword: async (req: Request, res: Response) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    };

    // basic validations
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      console.error("One or more required fields were missing.");
      return res.status(400).json({ message: "All fields are required." });
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long." });
    }
    if (newPassword !== confirmNewPassword) {
      console.error("New password and confirmation do not match.");
      return res
        .status(400)
        .json({ message: "New password and confirmation do not match." });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      // fetch the latest hashed password from DB (don’t rely on req.user)
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!dbUser) {
        return res.status(404).json({ message: "User not found." });
      }
      if (!dbUser.password) {
        return res.status(400).json({
          message: "No password set for this account. Please set a password.",
        });
      }

      // verify current password
      const match = await bcrypt.compare(currentPassword, dbUser.password);
      if (!match) {
        console.error("Current password is incorrect.");
        return res
          .status(401)
          .json({ message: "Current password is incorrect." });
      }

      // prevent reusing the same password
      const sameAsOld = await bcrypt.compare(newPassword, dbUser.password);
      if (sameAsOld) {
        return res.status(400).json({
          message: "New password must be different from the current password.",
        });
      }

      // hash and update
      const newHashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: newHashedPassword },
      });

      return res.json({ message: "Password has been updated successfully." });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2025") {
          return res
            .status(404)
            .json({ message: "User not found or no changes made." });
        }
      }
      console.error("An error occurred while updating the password: ", error);
      return res
        .status(500)
        .json({ message: "An error occurred while updating the password." });
    }
  },

  requestPasswordChange: async (req: Request, res: Response) => {
    const { email, inviteCompanyId } = req.body as {
      email?: string;
      inviteCompanyId?: string;
    };

    // Normalize but DO NOT reveal whether the email exists (same behavior as before)
    const normalizedEmail = (email ?? "").trim().toLowerCase();

    try {
      // Look up user by email (email is not unique in your schema, so use findFirst)
      const user = normalizedEmail
        ? await prisma.user.findFirst({
            where: { email: normalizedEmail },
            select: { id: true, email: true },
          })
        : null;

      if (user) {
        const passwordResetToken = crypto.randomBytes(20).toString("hex");
        const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // +1 hour

        // Update by unique id (safer than where: { email })
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordResetToken,
            passwordResetExpires,
          },
        });

        // Send the email
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GOOGLE_EMAIL_USER,
            pass: process.env.GOOGLE_APP_PASSWORD,
          },
        });

        let resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${passwordResetToken}`;
        resetUrl += `&pemail=${encodeURIComponent(normalizedEmail)}`;

        // Include inviteCompanyId if it exists
        if (inviteCompanyId) {
          resetUrl += `&pinvitecompany=${encodeURIComponent(inviteCompanyId)}`;
        }

        const mailOptions = {
          from: process.env.DONOTREPLY_EMAIL,
          to: normalizedEmail,
          subject: "Password Change Request",
          text:
            `You are receiving this because you (or someone else) have requested to change the password for your inventory-app account.\n\n` +
            `Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:\n\n${resetUrl}\n\n` +
            `If you did not request this, please ignore this email and your password will remain unchanged.\n`,
          html: `
            <html>
              <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 20px auto; border: 1px solid #ddd; padding: 20px; text-align: center;">
                  <h1 style="color: #1B87EA;">Password Change Request</h1>
                  <p style="font-size: 16px;">You are receiving this because you (or someone else) have requested to change the password for your account.</p>
                  <p style="font-size: 16px;">Please click on the following link, or paste this into your browser to complete the process within one hour of receiving it:</p>
                  <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; margin: 20px 0; background-color: #1B87EA; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                  <p style="font-size: 14px;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
                </div>
              </body>
            </html>`,
        };

        transporter.sendMail(mailOptions, (error) => {
          if (error) {
            console.error("Error while sending email: ", error);
            // Do not fail the request to avoid leaking whether the email exists
          }
        });
      }

      // Always return the same response (privacy-preserving)
      return res.json({
        message:
          "If an account with this email address exists, a password reset link has been sent.",
      });
    } catch (error) {
      console.error("Caught an error: ", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  updatePasswordWithToekn: async (req: Request, res: Response) => {
    const { token: rawToken } = req.params as { token?: string };
    const { newPassword, confirmPassword } = req.body as {
      newPassword?: string;
      confirmPassword?: string;
    };

    const token = (rawToken ?? "").trim();

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Both new password and confirmation fields are required.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirmation do not match.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long.",
      });
    }

    if (!token) {
      return res
        .status(400)
        .json({ message: "Password reset token is invalid or has expired" });
    }

    try {
      // find a user whose token matches and is not expired
      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!user) {
        return res
          .status(400)
          .json({ message: "Password reset token is invalid or has expired" });
      }

      // hash and update the password; clear token and expiry
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      return res.json({ message: "Your password was updated successfully!" });
    } catch (error) {
      console.error("Error encountered during password reset: ", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },

  changePassword: async (req: Request, res: Response) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    };

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      console.error("One or more required fields were missing.");
      return res.status(400).json({ message: "All fields are required." });
    }

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long." });
    }

    if (newPassword !== confirmNewPassword) {
      console.error("New password and confirmation do not match.");
      return res
        .status(400)
        .json({ message: "New password and confirmation do not match." });
    }

    const userId = req.user?.id;
    if (!userId) {
      console.error("User is not authenticated or user object is incomplete.");
      return res.status(401).json({ message: "User is not authenticated." });
    }

    try {
      // Fetch current hashed password from DB (don't rely on req.user)
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true },
      });

      if (!dbUser) {
        return res.status(404).json({ message: "User not found." });
      }
      if (!dbUser.password) {
        return res.status(400).json({
          message: "No password set for this account. Please set one.",
        });
      }

      // Check current password
      const match = await bcrypt.compare(currentPassword, dbUser.password);
      if (!match) {
        console.error("Current password is incorrect.");
        return res
          .status(401)
          .json({ message: "Current password is incorrect." });
      }

      // Optional: prevent reusing the same password
      const sameAsOld = await bcrypt.compare(newPassword, dbUser.password);
      if (sameAsOld) {
        return res.status(400).json({
          message: "New password must be different from the current password.",
        });
      }

      // Hash and update
      const newHashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: newHashedPassword },
      });

      return res.json({ message: "Password has been updated successfully." });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return res.status(404).json({ message: "No changes made." });
      }
      console.error("An error occurred while updating the password: ", error);
      return res
        .status(500)
        .json({ message: "An error occurred while updating the password." });
    }
  },
};

export default authController;
