import { Request, Response } from "express";
import prisma from "../utils/prisma";

const workspaceController = {
  // Create a new workspace
  createWorkspace: async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Workspace name is required",
        });
      }

      // Create workspace and add creator as OWNER
      const workspace = await prisma.workspace.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          members: {
            create: {
              userId: userId,
              role: "OWNER",
            },
          },
          subscription: {
            create: {
              plan: "STARTER",
              status: "TRIALING",
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          subscription: true,
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Workspace created successfully",
        data: { workspace },
      });
    } catch (error) {
      console.error("Create workspace error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create workspace",
      });
    }
  },

  // Get all workspaces for the current user
  getUserWorkspaces: async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const workspaces = await prisma.workspace.findMany({
        where: {
          members: {
            some: {
              userId: userId,
            },
          },
        },
        include: {
          members: {
            where: {
              userId: userId,
            },
            select: {
              role: true,
              lastActive: true,
            },
          },
          subscription: true,
          _count: {
            select: {
              items: true,
              members: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      return res.status(200).json({
        status: "success",
        data: { workspaces },
      });
    } catch (error) {
      console.error("Get workspaces error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve workspaces",
      });
    }
  },

  // Get a single workspace by ID
  getWorkspaceById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const workspace = await prisma.workspace.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  createdAt: true,
                },
              },
            },
          },
          subscription: true,
          _count: {
            select: {
              items: true,
              categories: true,
              locations: true,
              suppliers: true,
            },
          },
        },
      });

      if (!workspace) {
        return res.status(404).json({
          status: "error",
          message: "Workspace not found",
        });
      }

      // Verify user has access to this workspace
      const member = workspace.members.find((m) => m.userId === userId);
      if (!member) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      return res.status(200).json({
        status: "success",
        data: { workspace },
      });
    } catch (error) {
      console.error("Get workspace error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve workspace",
      });
    }
  },

  // Update a workspace
  updateWorkspace: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      // Check if user is OWNER or ADMIN
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: id,
          userId: userId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!member) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to update this workspace",
        });
      }

      const workspace = await prisma.workspace.update({
        where: { id },
        data: {
          name: name?.trim() || undefined,
          description:
            description !== undefined ? description?.trim() || null : undefined,
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          subscription: true,
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Workspace updated successfully",
        data: { workspace },
      });
    } catch (error) {
      console.error("Update workspace error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update workspace",
      });
    }
  },

  // Delete a workspace (OWNER only)
  deleteWorkspace: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      // Check if user is OWNER
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: id,
          userId: userId,
          role: "OWNER",
        },
      });

      if (!member) {
        return res.status(403).json({
          status: "error",
          message: "Only workspace owners can delete workspaces",
        });
      }

      await prisma.workspace.delete({
        where: { id },
      });

      return res.status(200).json({
        status: "success",
        message: "Workspace deleted successfully",
      });
    } catch (error) {
      console.error("Delete workspace error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete workspace",
      });
    }
  },

  // Invite a user to workspace
  inviteUser: async (req: Request, res: Response) => {
    try {
      const { id } = req.params; // workspace id
      const { email, role = "MEMBER" } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!email || !email.trim()) {
        return res.status(400).json({
          status: "error",
          message: "Email is required",
        });
      }

      // Check if user is OWNER or ADMIN
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: id,
          userId: userId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!member) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to invite users",
        });
      }

      // Check if user is already a member
      const existingUser = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });

      if (existingUser) {
        const existingMember = await prisma.workspaceMember.findFirst({
          where: {
            workspaceId: id,
            userId: existingUser.id,
          },
        });

        if (existingMember) {
          return res.status(400).json({
            status: "error",
            message: "User is already a member of this workspace",
          });
        }
      }

      // Create invitation
      const invitation = await prisma.invitation.create({
        data: {
          email: email.trim().toLowerCase(),
          role: role as "OWNER" | "ADMIN" | "MEMBER",
          workspaceId: id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        include: {
          workspace: true,
        },
      });

      // TODO: Send invitation email here

      return res.status(201).json({
        status: "success",
        message: "Invitation sent successfully",
        data: { invitation },
      });
    } catch (error) {
      console.error("Invite user error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to invite user",
      });
    }
  },

  // Remove a member from workspace
  removeMember: async (req: Request, res: Response) => {
    try {
      const { id, memberId } = req.params; // workspace id, member id
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      // Check if user is OWNER or ADMIN
      const requesterMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: id,
          userId: userId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!requesterMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to remove members",
        });
      }

      // Can't remove yourself
      if (memberId === userId) {
        return res.status(400).json({
          status: "error",
          message: "You cannot remove yourself from the workspace",
        });
      }

      // Get the member to be removed
      const memberToRemove = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: id,
          userId: memberId,
        },
      });

      if (!memberToRemove) {
        return res.status(404).json({
          status: "error",
          message: "Member not found",
        });
      }

      // Can't remove OWNER if you're not OWNER
      if (memberToRemove.role === "OWNER" && requesterMember.role !== "OWNER") {
        return res.status(403).json({
          status: "error",
          message: "Only owners can remove other owners",
        });
      }

      await prisma.workspaceMember.delete({
        where: { id: memberToRemove.id },
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

  // Update member role
  updateMemberRole: async (req: Request, res: Response) => {
    try {
      const { id, memberId } = req.params; // workspace id, member id
      const { role } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!role || !["OWNER", "ADMIN", "MEMBER"].includes(role)) {
        return res.status(400).json({
          status: "error",
          message: "Invalid role",
        });
      }

      // Only OWNER can change roles
      const requesterMember = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: id,
          userId: userId,
          role: "OWNER",
        },
      });

      if (!requesterMember) {
        return res.status(403).json({
          status: "error",
          message: "Only workspace owners can change member roles",
        });
      }

      const memberToUpdate = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: id,
          userId: memberId,
        },
      });

      if (!memberToUpdate) {
        return res.status(404).json({
          status: "error",
          message: "Member not found",
        });
      }

      const updatedMember = await prisma.workspaceMember.update({
        where: { id: memberToUpdate.id },
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
};

export default workspaceController;
