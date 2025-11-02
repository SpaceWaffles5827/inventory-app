import { Request, Response } from "express";
import prisma from "../utils/prisma";

const locationsController = {
  // Create a new location
  createLocation: async (req: Request, res: Response) => {
    try {
      const {
        code,
        zone,
        aisle,
        shelf,
        bin,
        capacity,
        description,
        workspaceId,
      } = req.body;
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
          workspaceId: workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Check if location code already exists in this workspace
      const existingLocation = await prisma.location.findFirst({
        where: {
          workspaceId: workspaceId,
          code: code,
        },
      });

      if (existingLocation) {
        return res.status(400).json({
          status: "error",
          message: "Location code already exists in this workspace",
        });
      }

      // Create the location
      const location = await prisma.location.create({
        data: {
          code,
          zone,
          aisle,
          shelf,
          bin,
          capacity: capacity || 100,
          description: description || null,
          workspaceId: workspaceId,
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Location created successfully",
        data: { location },
      });
    } catch (error) {
      console.error("Create location error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create location",
      });
    }
  },

  // Get all locations in a workspace
  getLocations: async (req: Request, res: Response) => {
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

      // Get all locations in the workspace
      const locations = await prisma.location.findMany({
        where: {
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: {
          code: "asc",
        },
      });

      return res.status(200).json({
        status: "success",
        data: { locations },
      });
    } catch (error) {
      console.error("Get locations error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve locations",
      });
    }
  },

  // Get a single location by ID
  getLocationById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
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

      // Get the location
      const location = await prisma.location.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
          items: {
            select: {
              id: true,
              itemNumber: true,
              name: true,
              onHand: true,
              status: true,
            },
            orderBy: {
              name: "asc",
            },
          },
        },
      });

      if (!location) {
        return res.status(404).json({
          status: "error",
          message: "Location not found",
        });
      }

      return res.status(200).json({
        status: "success",
        data: { location },
      });
    } catch (error) {
      console.error("Get location by ID error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve location",
      });
    }
  },

  // Update a location
  updateLocation: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        code,
        zone,
        aisle,
        shelf,
        bin,
        capacity,
        description,
        workspaceId,
      } = req.body;
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
          workspaceId: workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Check if location exists in this workspace
      const existingLocation = await prisma.location.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId,
        },
      });

      if (!existingLocation) {
        return res.status(404).json({
          status: "error",
          message: "Location not found",
        });
      }

      // If code is being updated, check for duplicates
      if (code && code !== existingLocation.code) {
        const duplicateLocation = await prisma.location.findFirst({
          where: {
            workspaceId: workspaceId,
            code: code,
            id: { not: id },
          },
        });

        if (duplicateLocation) {
          return res.status(400).json({
            status: "error",
            message: "Location code already exists in this workspace",
          });
        }
      }

      // Update the location
      const location = await prisma.location.update({
        where: { id: id },
        data: {
          ...(code && { code }),
          ...(zone && { zone }),
          ...(aisle && { aisle }),
          ...(shelf && { shelf }),
          ...(bin && { bin }),
          ...(capacity !== undefined && { capacity }),
          ...(description !== undefined && {
            description: description || null,
          }),
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Location updated successfully",
        data: { location },
      });
    } catch (error) {
      console.error("Update location error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update location",
      });
    }
  },

  // Delete a location
  deleteLocation: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
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

      // Check if location exists in this workspace
      const location = await prisma.location.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      if (!location) {
        return res.status(404).json({
          status: "error",
          message: "Location not found",
        });
      }

      // Check if location has items
      if (location._count.items > 0) {
        return res.status(400).json({
          status: "error",
          message: `Cannot delete location with ${location._count.items} item(s). Please reassign or delete the items first.`,
        });
      }

      // Delete the location
      await prisma.location.delete({
        where: { id: id },
      });

      return res.status(200).json({
        status: "success",
        message: "Location deleted successfully",
      });
    } catch (error) {
      console.error("Delete location error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete location",
      });
    }
  },
};

export default locationsController;
