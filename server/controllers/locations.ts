import { Request, Response } from "express";
import prisma from "../utils/prisma";

const locationsController = {
  // Get workspace default structure
  getWorkspaceStructure: async (req: Request, res: Response) => {
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

      // Get workspace with structure
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId as string },
        select: { defaultLocationStructure: true },
      });

      return res.status(200).json({
        status: "success",
        data: { structure: workspace?.defaultLocationStructure || null },
      });
    } catch (error) {
      console.error("Get workspace structure error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve workspace structure",
      });
    }
  },

  // Update workspace default structure
  updateWorkspaceStructure: async (req: Request, res: Response) => {
    try {
      const { workspaceId, structure } = req.body;
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

      // Verify user has admin/owner access
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to update workspace settings",
        });
      }

      // Validate structure format
      if (
        structure &&
        (!structure.levels || !Array.isArray(structure.levels))
      ) {
        return res.status(400).json({
          status: "error",
          message: "Invalid structure format",
        });
      }

      // Update workspace structure
      const workspace = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { defaultLocationStructure: structure },
        select: { defaultLocationStructure: true },
      });

      return res.status(200).json({
        status: "success",
        message: "Workspace structure updated successfully",
        data: { structure: workspace.defaultLocationStructure },
      });
    } catch (error) {
      console.error("Update workspace structure error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update workspace structure",
      });
    }
  },

  // Helper function to generate location barcode
  generateLocationBarcode: async (
    code: string,
    workspaceId: string,
  ): Promise<string> => {
    // Start with simple format: LOC-{location code}
    let baseBarcode = `LOC-${code}`;
    let finalBarcode = baseBarcode;
    let increment = 1;

    // Check if this barcode already exists in the workspace
    while (true) {
      const existing = await prisma.location.findFirst({
        where: {
          workspaceId: workspaceId,
          barcode: finalBarcode,
        },
      });

      if (!existing) {
        // Barcode is unique, we can use it
        break;
      }

      // Barcode exists, try with incrementing suffix using #N format
      finalBarcode = `${baseBarcode}#${increment}`;
      increment++;
    }

    return finalBarcode;
  },

  // Create a new location
  createLocation: async (req: Request, res: Response) => {
    try {
      const { code, barcode, structure, capacity, description, workspaceId } =
        req.body;
      const userId = req.user?.id;

      console.log("creating a location", req.body);

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

      // Validate structure
      if (!structure || !Array.isArray(structure) || structure.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Location structure is required",
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

      // Generate barcode if not provided
      const finalBarcode =
        barcode ||
        (await locationsController.generateLocationBarcode(code, workspaceId));

      // Check if barcode already exists in this workspace
      if (finalBarcode) {
        const existingBarcode = await prisma.location.findFirst({
          where: {
            workspaceId: workspaceId,
            barcode: finalBarcode,
          },
        });

        if (existingBarcode) {
          return res.status(400).json({
            status: "error",
            message: "Location barcode already exists in this workspace",
          });
        }
      }

      // Create the location
      const location = await prisma.location.create({
        data: {
          code,
          barcode: finalBarcode,
          structure,
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

      // Get all locations in the workspace with item counts through junction table
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

      // Get the location with items through junction table
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
            include: {
              item: {
                select: {
                  id: true,
                  itemNumber: true,
                  name: true,
                  status: true,
                  unit: true,
                },
              },
            },
            orderBy: {
              item: {
                name: "asc",
              },
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

      // Transform the response to flatten the item data and include quantity
      const transformedLocation = {
        ...location,
        items: location.items.map((itemLocation) => ({
          id: itemLocation.item.id,
          itemNumber: itemLocation.item.itemNumber,
          name: itemLocation.item.name,
          status: itemLocation.item.status,
          unit: itemLocation.item.unit,
          quantity: itemLocation.quantity,
          minStock: itemLocation.minStock,
          maxStock: itemLocation.maxStock,
          notes: itemLocation.notes,
        })),
      };

      return res.status(200).json({
        status: "success",
        data: { location: transformedLocation },
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
      const { code, barcode, structure, capacity, description, workspaceId } =
        req.body;
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

      // If barcode is being updated, check for duplicates
      if (barcode !== undefined && barcode !== existingLocation.barcode) {
        if (barcode) {
          const duplicateBarcode = await prisma.location.findFirst({
            where: {
              workspaceId: workspaceId,
              barcode: barcode,
              id: { not: id },
            },
          });

          if (duplicateBarcode) {
            return res.status(400).json({
              status: "error",
              message: "Location barcode already exists in this workspace",
            });
          }
        }
      }

      // Prepare update data
      const updateData: any = {};

      if (code) {
        updateData.code = code;
        // If code is updated but barcode is not provided, regenerate barcode
        if (barcode === undefined) {
          updateData.barcode =
            await locationsController.generateLocationBarcode(
              code,
              workspaceId,
            );
        }
      }

      if (barcode !== undefined) {
        updateData.barcode = barcode || null;
      }

      if (structure) {
        updateData.structure = structure;
      }

      if (capacity !== undefined) {
        updateData.capacity = capacity;
      }

      if (description !== undefined) {
        updateData.description = description || null;
      }

      // Update the location
      const location = await prisma.location.update({
        where: { id: id },
        data: updateData,
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

      // Check if location has items (through junction table)
      if (location._count.items > 0) {
        return res.status(400).json({
          status: "error",
          message: `Cannot delete location with ${location._count.items} item(s). Please reassign or remove the items first.`,
        });
      }

      // Delete the location (junction table entries will cascade delete)
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
