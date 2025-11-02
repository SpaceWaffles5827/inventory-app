import { Request, Response } from "express";
import prisma from "../utils/prisma";
import nodemailer from "nodemailer";

// Create reusable transporter
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GOOGLE_EMAIL_USER,
      pass: process.env.GOOGLE_APP_PASSWORD,
    },
  });
};

// Email template for invitation
const getInvitationEmailHTML = (
  workspaceName: string,
  inviterName: string,
  invitationLink: string
) => {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Workspace Invitation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">You've Been Invited!</h1>
                  </td>
                </tr>
                
                <!-- Body -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 24px;">
                      Hello,
                    </p>
                    <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 24px;">
                      <strong>${inviterName}</strong> has invited you to join the <strong>${workspaceName}</strong> workspace on our inventory management platform.
                    </p>
                    <p style="margin: 0 0 30px 0; color: #666666; font-size: 14px; line-height: 22px;">
                      Click the button below to accept the invitation and get started. This invitation will expire in 7 days.
                    </p>
                    
                    <!-- CTA Button -->
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td align="center" style="padding: 0;">
                          <a href="${invitationLink}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 30px 0 0 0; color: #999999; font-size: 13px; line-height: 20px;">
                      If the button doesn't work, copy and paste this link into your browser:<br>
                      <a href="${invitationLink}" style="color: #667eea; text-decoration: none; word-break: break-all;">${invitationLink}</a>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
                    <p style="margin: 0 0 10px 0; color: #999999; font-size: 12px; line-height: 18px;">
                      This invitation was sent to ${
                        invitationLink.includes("email=")
                          ? invitationLink.split("email=")[1].split("&")[0]
                          : "you"
                      }.
                    </p>
                    <p style="margin: 0; color: #999999; font-size: 12px; line-height: 18px;">
                      If you didn't expect this invitation, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

// Helper function to send invitation email
const sendInvitationEmail = async (
  toEmail: string,
  workspaceName: string,
  inviterName: string,
  invitationToken: string
) => {
  try {
    const transporter = createEmailTransporter();

    // Construct invitation link
    const invitationLink = `${
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    }/accept-invitation?token=${invitationToken}&email=${encodeURIComponent(
      toEmail
    )}`;

    const mailOptions = {
      from: {
        name: "Inventory Management System",
        address: process.env.DONOTREPLY_EMAIL || process.env.GOOGLE_EMAIL_USER!,
      },
      to: toEmail,
      subject: `You've been invited to join ${workspaceName}`,
      html: getInvitationEmailHTML(workspaceName, inviterName, invitationLink),
      text: `You've been invited to join ${workspaceName} by ${inviterName}. 
      
Click the link below to accept the invitation:
${invitationLink}

This invitation will expire in 7 days.

If you didn't expect this invitation, you can safely ignore this email.`,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Error sending invitation email:", error);
    throw error;
  }
};

const workspaceMembersController = {
  // Get all members in a workspace
  getMembers: async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Get all members in the workspace
      const members = await prisma.workspaceMember.findMany({
        where: {
          workspaceId: workspaceId as string,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          joinedAt: "asc",
        },
      });

      return res.status(200).json({
        status: "success",
        data: { members },
      });
    } catch (error) {
      console.error("Get members error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve members",
      });
    }
  },

  // Update member role
  updateMemberRole: async (req: Request, res: Response) => {
    try {
      const { memberId } = req.params;
      const { role, workspaceId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId || !role) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID and role are required",
        });
      }

      // Verify user has admin access
      const currentMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId,
        },
      });

      if (
        !currentMember ||
        (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN")
      ) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to update member roles",
        });
      }

      // Get the member to update
      const memberToUpdate = await prisma.workspaceMember.findUnique({
        where: { id: memberId },
      });

      if (!memberToUpdate || memberToUpdate.workspaceId !== workspaceId) {
        return res.status(404).json({
          status: "error",
          message: "Member not found",
        });
      }

      // Don't allow changing owner role
      if (memberToUpdate.role === "OWNER") {
        return res.status(400).json({
          status: "error",
          message: "Cannot change owner role",
        });
      }

      // Update the member role
      const updatedMember = await prisma.workspaceMember.update({
        where: { id: memberId },
        data: { role },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Member role updated successfully",
        data: { member: updatedMember },
      });
    } catch (error) {
      console.error("Update member role error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update member role",
      });
    }
  },

  // Remove member from workspace
  removeMember: async (req: Request, res: Response) => {
    try {
      const { memberId } = req.params;
      const { workspaceId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has admin access
      const currentMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (
        !currentMember ||
        (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN")
      ) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to remove members",
        });
      }

      // Get the member to remove
      const memberToRemove = await prisma.workspaceMember.findUnique({
        where: { id: memberId },
      });

      if (!memberToRemove || memberToRemove.workspaceId !== workspaceId) {
        return res.status(404).json({
          status: "error",
          message: "Member not found",
        });
      }

      // Don't allow removing owner
      if (memberToRemove.role === "OWNER") {
        return res.status(400).json({
          status: "error",
          message: "Cannot remove workspace owner",
        });
      }

      // Remove the member
      await prisma.workspaceMember.delete({
        where: { id: memberId },
      });

      return res.status(200).json({
        status: "success",
        message: "Member removed successfully",
      });
    } catch (error) {
      console.error("Remove member error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to remove member",
      });
    }
  },

  // Invite member to workspace
  inviteMember: async (req: Request, res: Response) => {
    try {
      const { email, role, workspaceId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId || !email || !role) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID, email, and role are required",
        });
      }

      // Verify user has admin access
      const currentMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (
        !currentMember ||
        (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN")
      ) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to invite members",
        });
      }

      // Check if user already exists in workspace
      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: {
          workspaceMembers: {
            where: { workspaceId },
          },
        },
      });

      if (existingUser && existingUser.workspaceMembers.length > 0) {
        return res.status(400).json({
          status: "error",
          message: "User is already a member of this workspace",
        });
      }

      // Check if invitation already exists
      const existingInvitation = await prisma.invitation.findFirst({
        where: {
          email,
          workspaceId,
          status: "PENDING",
        },
      });

      if (existingInvitation) {
        return res.status(400).json({
          status: "error",
          message: "Invitation already sent to this email",
        });
      }

      // Create invitation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days

      const invitation = await prisma.invitation.create({
        data: {
          email,
          role: role === "admin" ? "ADMIN" : "MEMBER",
          workspaceId,
          expiresAt,
        },
        include: {
          workspace: {
            select: {
              name: true,
            },
          },
        },
      });

      // Send invitation email
      try {
        const inviterName = currentMember.user.name || currentMember.user.email;
        await sendInvitationEmail(
          email,
          invitation.workspace.name,
          inviterName,
          invitation.id
        );
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
        // Don't fail the request if email fails, but log it
        // The invitation is still created in the database
      }

      return res.status(201).json({
        status: "success",
        message: "Invitation sent successfully",
        data: { invitation },
      });
    } catch (error) {
      console.error("Invite member error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to send invitation",
      });
    }
  },

  // Get pending invitations
  getInvitations: async (req: Request, res: Response) => {
    try {
      const { workspaceId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Get pending invitations
      const invitations = await prisma.invitation.findMany({
        where: {
          workspaceId: workspaceId as string,
          status: "PENDING",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.status(200).json({
        status: "success",
        data: { invitations },
      });
    } catch (error) {
      console.error("Get invitations error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve invitations",
      });
    }
  },

  // Cancel invitation
  cancelInvitation: async (req: Request, res: Response) => {
    try {
      const { invitationId } = req.params;
      const { workspaceId } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has admin access
      const currentMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (
        !currentMember ||
        (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN")
      ) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to cancel invitations",
        });
      }

      // Get the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
      });

      if (!invitation || invitation.workspaceId !== workspaceId) {
        return res.status(404).json({
          status: "error",
          message: "Invitation not found",
        });
      }

      // Update invitation status
      await prisma.invitation.update({
        where: { id: invitationId },
        data: { status: "CANCELLED" },
      });

      return res.status(200).json({
        status: "success",
        message: "Invitation cancelled successfully",
      });
    } catch (error) {
      console.error("Cancel invitation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to cancel invitation",
      });
    }
  },

  // Resend invitation
  resendInvitation: async (req: Request, res: Response) => {
    try {
      const { invitationId } = req.params;
      const { workspaceId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has admin access
      const currentMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId,
        },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      if (
        !currentMember ||
        (currentMember.role !== "OWNER" && currentMember.role !== "ADMIN")
      ) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to resend invitations",
        });
      }

      // Get the invitation
      const invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        include: {
          workspace: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!invitation || invitation.workspaceId !== workspaceId) {
        return res.status(404).json({
          status: "error",
          message: "Invitation not found",
        });
      }

      // Extend expiration
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await prisma.invitation.update({
        where: { id: invitationId },
        data: { expiresAt },
      });

      // Resend invitation email
      try {
        const inviterName = currentMember.user.name || currentMember.user.email;
        await sendInvitationEmail(
          invitation.email,
          invitation.workspace.name,
          inviterName,
          invitation.id
        );
      } catch (emailError) {
        console.error("Failed to resend invitation email:", emailError);
        // Return error if resend fails since that's the primary purpose
        return res.status(500).json({
          status: "error",
          message: "Failed to send invitation email. Please try again.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "Invitation resent successfully",
      });
    } catch (error) {
      console.error("Resend invitation error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to resend invitation",
      });
    }
  },
};

export default workspaceMembersController;
