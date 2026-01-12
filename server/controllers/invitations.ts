import { Request, Response } from "express";
import prisma from "../utils/prisma";
import bcrypt from "bcryptjs";

const invitationsController = {
  // Verify invitation
  verifyInvitation: async (req: Request, res: Response) => {
    try {
      const { token, email } = req.query;

      if (!token || !email) {
        return res.status(400).json({
          status: "error",
          message: "Token and email are required",
        });
      }

      // Get the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { id: token as string },
        include: {
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!invitation) {
        return res.status(404).json({
          status: "error",
          message: "Invitation not found",
        });
      }

      if (invitation.email !== email) {
        return res.status(400).json({
          status: "error",
          message: "Email does not match invitation",
        });
      }

      // Check if invitation is expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({
          status: "error",
          message: "This invitation has expired",
        });
      }

      // Check if invitation is still pending
      if (invitation.status !== "PENDING") {
        return res.status(400).json({
          status: "error",
          message: "This invitation is no longer valid",
        });
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email as string },
      });

      return res.status(200).json({
        status: "success",
        data: {
          invitation,
          isExistingUser: !!existingUser,
        },
      });
    } catch (error) {
      console.error("Verify invitation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to verify invitation",
      });
    }
  },

  // Accept invitation
  acceptInvitation: async (req: Request, res: Response) => {
    try {
      const { token, email, name, password } = req.body;

      if (!token || !email || !password) {
        return res.status(400).json({
          status: "error",
          message: "Token, email, and password are required",
        });
      }

      // Get the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { id: token },
      });

      if (!invitation) {
        return res.status(404).json({
          status: "error",
          message: "Invitation not found",
        });
      }

      // Check if email matches
      if (invitation.email !== email) {
        return res.status(400).json({
          status: "error",
          message: "Email does not match invitation",
        });
      }

      // Check if invitation is expired
      if (new Date() > new Date(invitation.expiresAt)) {
        return res.status(400).json({
          status: "error",
          message: "This invitation has expired",
        });
      }

      // Check if invitation is still pending
      if (invitation.status !== "PENDING") {
        return res.status(400).json({
          status: "error",
          message: "This invitation has already been used",
        });
      }

      // Check if user exists
      let user = await prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Existing user - verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({
            status: "error",
            message: "Invalid password",
          });
        }

        // Check if already a member
        const existingMember = await prisma.workspaceMember.findFirst({
          where: {
            userId: user.id,
            workspaceId: invitation.workspaceId,
          },
        });

        if (existingMember) {
          return res.status(400).json({
            status: "error",
            message: "You are already a member of this workspace",
          });
        }
      } else {
        // New user - create account
        if (!name || !name.trim()) {
          return res.status(400).json({
            status: "error",
            message: "Name is required for new users",
          });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        user = await prisma.user.create({
          data: {
            email,
            name,
            password: hashedPassword,
          },
        });
      }

      // Add user to workspace
      await prisma.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      });

      // Mark invitation as accepted
      await prisma.invitation.update({
        where: { id: token },
        data: { status: "ACCEPTED" },
      });

      return res.status(200).json({
        status: "success",
        message: "Invitation accepted successfully",
        data: { userId: user.id },
      });
    } catch (error) {
      console.error("Accept invitation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to accept invitation",
      });
    }
  },
};

export default invitationsController;
