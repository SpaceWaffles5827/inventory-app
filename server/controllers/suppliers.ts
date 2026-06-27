import { Request, Response } from "express";
import prisma from "../utils/prisma";
import { sumLotsOnHand } from "../utils/onHand";

const suppliersController = {
  // Create a new supplier
  createSupplier: async (req: Request, res: Response) => {
    try {
      const {
        name,
        contactPerson,
        email,
        phone,
        address,
        isActive,
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

      if (!name || name.trim() === "") {
        return res.status(400).json({
          status: "error",
          message: "Supplier name is required",
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

      // Check if supplier name already exists in this workspace
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          workspaceId: workspaceId,
          name: name.trim(),
        },
      });

      if (existingSupplier) {
        return res.status(400).json({
          status: "error",
          message: "Supplier name already exists in this workspace",
        });
      }

      // Create the supplier
      const supplier = await prisma.supplier.create({
        data: {
          name: name.trim(),
          contactPerson: contactPerson?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          isActive: isActive !== undefined ? isActive : true,
          workspaceId: workspaceId,
        },
      });

      return res.status(201).json({
        status: "success",
        message: "Supplier created successfully",
        data: { supplier },
      });
    } catch (error) {
      console.error("Create supplier error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create supplier",
      });
    }
  },

  // Get all suppliers in a workspace
  getSuppliers: async (req: Request, res: Response) => {
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

      // Get all suppliers in the workspace
      const suppliers = await prisma.supplier.findMany({
        where: {
          workspaceId: workspaceId as string,
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: {
          name: "asc",
        },
      });

      return res.status(200).json({
        status: "success",
        data: { suppliers },
      });
    } catch (error) {
      console.error("Get suppliers error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve suppliers",
      });
    }
  },

  // Get a single supplier by ID
  getSupplierById: async (req: Request, res: Response) => {
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

      // Get the supplier
      const supplier = await prisma.supplier.findFirst({
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
              status: true,
              lots: {
                select: {
                  locations: {
                    select: { quantity: true },
                  },
                },
              },
            },
            orderBy: {
              name: "asc",
            },
          },
        },
      });

      if (!supplier) {
        return res.status(404).json({
          status: "error",
          message: "Supplier not found",
        });
      }

      // onHand is derived from lot locations, not a stored column
      const supplierWithOnHand = {
        ...supplier,
        items: supplier.items.map(({ lots, ...item }) => ({
          ...item,
          onHand: sumLotsOnHand(lots),
        })),
      };

      return res.status(200).json({
        status: "success",
        data: { supplier: supplierWithOnHand },
      });
    } catch (error) {
      console.error("Get supplier by ID error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve supplier",
      });
    }
  },

  // Update a supplier
  updateSupplier: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        name,
        contactPerson,
        email,
        phone,
        address,
        isActive,
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

      // Check if supplier exists in this workspace
      const existingSupplier = await prisma.supplier.findFirst({
        where: {
          id: id,
          workspaceId: workspaceId,
        },
      });

      if (!existingSupplier) {
        return res.status(404).json({
          status: "error",
          message: "Supplier not found",
        });
      }

      // If name is being updated, check for duplicates
      if (name && name.trim() !== existingSupplier.name) {
        const duplicateSupplier = await prisma.supplier.findFirst({
          where: {
            workspaceId: workspaceId,
            name: name.trim(),
            id: { not: id },
          },
        });

        if (duplicateSupplier) {
          return res.status(400).json({
            status: "error",
            message: "Supplier name already exists in this workspace",
          });
        }
      }

      // Update the supplier
      const supplier = await prisma.supplier.update({
        where: { id: id },
        data: {
          ...(name && { name: name.trim() }),
          ...(contactPerson !== undefined && {
            contactPerson: contactPerson?.trim() || null,
          }),
          ...(email !== undefined && { email: email?.trim() || null }),
          ...(phone !== undefined && { phone: phone?.trim() || null }),
          ...(address !== undefined && { address: address?.trim() || null }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          _count: {
            select: { items: true },
          },
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Supplier updated successfully",
        data: { supplier },
      });
    } catch (error) {
      console.error("Update supplier error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update supplier",
      });
    }
  },

  // Delete a supplier
  deleteSupplier: async (req: Request, res: Response) => {
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

      // Check if supplier exists in this workspace
      const supplier = await prisma.supplier.findFirst({
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

      if (!supplier) {
        return res.status(404).json({
          status: "error",
          message: "Supplier not found",
        });
      }

      // Check if supplier has items
      if (supplier._count.items > 0) {
        return res.status(400).json({
          status: "error",
          message: `Cannot delete supplier with ${supplier._count.items} item(s). Please reassign or delete the items first.`,
        });
      }

      // Delete the supplier
      await prisma.supplier.delete({
        where: { id: id },
      });

      return res.status(200).json({
        status: "success",
        message: "Supplier deleted successfully",
      });
    } catch (error) {
      console.error("Delete supplier error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete supplier",
      });
    }
  },
};

export default suppliersController;
