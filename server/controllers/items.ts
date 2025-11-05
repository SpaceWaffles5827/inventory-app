import { Request, Response } from "express";
import prisma from "../utils/prisma";

const itemsController = {
  // Create a new item
  createItem: async (req: Request, res: Response) => {
    try {
      const {
        itemNumber,
        name,
        barcode,
        description,
        onHand,
        cost,
        categoryId,
        locationId,
        supplierId,
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

      // Check if item number already exists in this workspace
      const existingItem = await prisma.item.findFirst({
        where: {
          workspaceId: workspaceId,
          itemNumber: itemNumber,
        },
      });

      if (existingItem) {
        return res.status(400).json({
          status: "error",
          message: "Item number already exists in this workspace",
        });
      }

      // Create the item
      const item = await prisma.item.create({
        data: {
          itemNumber,
          name,
          barcode: barcode || null,
          description: description || null,
          onHand: onHand || 0,
          cost: cost || 0,
          categoryId: categoryId || null,
          locationId: locationId || null,
          supplierId: supplierId || null,
          workspaceId: workspaceId,
          status: onHand > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
        },
        include: {
          category: true,
          location: true,
          supplier: true,
        },
      });

      // Create initial stock transaction if onHand > 0
      if (onHand && onHand > 0) {
        await prisma.stockTransaction.create({
          data: {
            type: "INPUT",
            quantity: onHand,
            previousStock: 0,
            newStock: onHand,
            reason: "Initial stock",
            itemId: item.id,
            workspaceId: workspaceId,
            userId: userId,
          },
        });
      }

      return res.status(201).json({
        status: "success",
        message: "Item created successfully",
        data: { item },
      });
    } catch (error) {
      console.error("Create item error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create item",
      });
    }
  },

  // Get all items in a workspace
  getItems: async (req: Request, res: Response) => {
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

      // Get all items in the workspace
      const items = await prisma.item.findMany({
        where: {
          workspaceId: workspaceId as string,
        },
        include: {
          category: true,
          location: true,
          supplier: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.status(200).json({
        status: "success",
        data: { items },
      });
    } catch (error) {
      console.error("Get items error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve items",
      });
    }
  },

  // Get a single item by ID
  getItemById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const item = await prisma.item.findUnique({
        where: { id },
        include: {
          category: true,
          location: true,
          supplier: true,
          workspace: true,
          transactions: {
            orderBy: {
              createdAt: "desc",
            },
            take: 10, // Last 10 transactions
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
        },
      });

      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "Item not found",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: item.workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this item",
        });
      }

      return res.status(200).json({
        status: "success",
        data: { item },
      });
    } catch (error) {
      console.error("Get item error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve item",
      });
    }
  },

  // Update an item
  updateItem: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const item = await prisma.item.findUnique({
        where: { id },
      });

      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "Item not found",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: item.workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to update this item",
        });
      }

      const {
        itemNumber, // Add this
        name,
        barcode,
        description,
        cost,
        categoryId,
        locationId,
        supplierId,
      } = req.body;

      // Check if itemNumber is being changed and if it's unique
      if (itemNumber && itemNumber !== item.itemNumber) {
        const existingItem = await prisma.item.findFirst({
          where: {
            workspaceId: item.workspaceId,
            itemNumber: itemNumber,
            id: { not: id }, // Exclude current item
          },
        });

        if (existingItem) {
          return res.status(400).json({
            status: "error",
            message:
              "An item with this item number already exists in your workspace",
          });
        }
      }

      const updatedItem = await prisma.item.update({
        where: { id },
        data: {
          itemNumber: itemNumber !== undefined ? itemNumber : item.itemNumber, // Add this
          name: name || item.name,
          barcode: barcode !== undefined ? barcode : item.barcode,
          description:
            description !== undefined ? description : item.description,
          cost: cost !== undefined ? cost : item.cost,
          categoryId: categoryId !== undefined ? categoryId : item.categoryId,
          locationId: locationId !== undefined ? locationId : item.locationId,
          supplierId: supplierId !== undefined ? supplierId : item.supplierId,
        },
        include: {
          category: true,
          location: true,
          supplier: true,
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Item updated successfully",
        data: { item: updatedItem },
      });
    } catch (error) {
      console.error("Update item error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update item",
      });
    }
  },

  // Delete an item
  deleteItem: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const item = await prisma.item.findUnique({
        where: { id },
      });

      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "Item not found",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: item.workspaceId,
          role: { in: ["OWNER", "ADMIN"] }, // Only owners and admins can delete
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to delete this item",
        });
      }

      await prisma.item.delete({
        where: { id },
      });

      return res.status(200).json({
        status: "success",
        message: "Item deleted successfully",
      });
    } catch (error) {
      console.error("Delete item error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete item",
      });
    }
  },

  // Adjust stock (add or remove)
  adjustStock: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { quantity, type, reason } = req.body; // type: 'INPUT' or 'OUTPUT'
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!quantity || !type || !reason) {
        return res.status(400).json({
          status: "error",
          message: "Quantity, type, and reason are required",
        });
      }

      if (!["INPUT", "OUTPUT"].includes(type)) {
        return res.status(400).json({
          status: "error",
          message: "Type must be INPUT or OUTPUT",
        });
      }

      const item = await prisma.item.findUnique({
        where: { id },
      });

      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "Item not found",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: item.workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this item",
        });
      }

      const previousStock = item.onHand;
      const newStock =
        type === "INPUT" ? previousStock + quantity : previousStock - quantity;

      if (newStock < 0) {
        return res.status(400).json({
          status: "error",
          message: "Insufficient stock",
        });
      }

      // Update item stock
      const updatedItem = await prisma.item.update({
        where: { id },
        data: {
          onHand: newStock,
          status:
            newStock === 0
              ? "OUT_OF_STOCK"
              : newStock < 10
              ? "LOW_STOCK"
              : "IN_STOCK",
        },
      });

      // Create stock transaction
      await prisma.stockTransaction.create({
        data: {
          type,
          quantity,
          previousStock,
          newStock,
          reason,
          itemId: id,
          workspaceId: item.workspaceId,
          userId: userId,
        },
      });

      return res.status(200).json({
        status: "success",
        message: "Stock adjusted successfully",
        data: { item: updatedItem },
      });
    } catch (error) {
      console.error("Adjust stock error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to adjust stock",
      });
    }
  },
};

export default itemsController;
