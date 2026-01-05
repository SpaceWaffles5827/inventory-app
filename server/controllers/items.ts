import { Request, Response } from "express";
import prisma from "../utils/prisma";

// Helper function to calculate total onHand from locations
const calculateOnHand = (locations: { quantity: number }[]): number => {
  return locations.reduce((total, loc) => total + loc.quantity, 0);
};

// Helper function to determine item status based on total quantity
const determineStatus = (
  onHand: number
): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" => {
  if (onHand === 0) return "OUT_OF_STOCK";
  if (onHand < 10) return "LOW_STOCK";
  return "IN_STOCK";
};

// Helper function to add onHand to item
const addOnHandToItem = <T extends { locations: { quantity: number }[] }>(
  item: T
) => {
  const onHand = calculateOnHand(item.locations);
  return {
    ...item,
    onHand,
  };
};

const itemsController = {
  // Create a new item
  createItem: async (req: Request, res: Response) => {
    try {
      const {
        name,
        barcode,
        unit,
        description,
        onHand,
        cost,
        categoryId,
        locationId,
        locationIds,
        supplierId,
        workspaceId,
        customerIds,
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

      // Generate next item number for this workspace
      const lastItem = await prisma.item.findFirst({
        where: {
          workspaceId: workspaceId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: {
          itemNumber: true,
        },
      });

      let nextNumber = 1;
      if (lastItem) {
        // Extract number from format ITM-001, ITM-002, etc.
        const match = lastItem.itemNumber.match(/ITM-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const itemNumber = `ITM-${String(nextNumber).padStart(3, "0")}`;

      // Verify all customers belong to the workspace (if customerIds provided)
      if (customerIds && customerIds.length > 0) {
        const customers = await prisma.customer.findMany({
          where: {
            id: { in: customerIds },
            workspaceId: workspaceId,
          },
        });

        if (customers.length !== customerIds.length) {
          return res.status(400).json({
            status: "error",
            message: "One or more customers not found in this workspace",
          });
        }
      }

      // Determine which locations to use (support both single locationId and multiple locationIds)
      const locationsToCreate =
        locationIds && locationIds.length > 0
          ? locationIds
          : locationId
          ? [locationId]
          : [];

      // Verify all locations belong to the workspace (if locations provided)
      if (locationsToCreate.length > 0) {
        const locations = await prisma.location.findMany({
          where: {
            id: { in: locationsToCreate },
            workspaceId: workspaceId,
          },
        });

        if (locations.length !== locationsToCreate.length) {
          return res.status(400).json({
            status: "error",
            message: "One or more locations not found in this workspace",
          });
        }
      }

      const initialQuantity = onHand || 0;
      const status = determineStatus(initialQuantity);

      // Create the item
      const item = await prisma.item.create({
        data: {
          itemNumber,
          name,
          barcode: barcode || null,
          unit: unit || null,
          description: description || null,
          cost: cost || 0,
          categoryId: categoryId || null,
          supplierId: supplierId || null,
          workspaceId: workspaceId,
          status: status,
          ...(customerIds &&
            customerIds.length > 0 && {
              customers: {
                create: customerIds.map((customerId: string) => ({
                  customerId: customerId,
                  quantity: 0,
                })),
              },
            }),
          ...(locationsToCreate.length > 0 && {
            locations: {
              create: locationsToCreate.map((locId: string) => ({
                locationId: locId,
                quantity: initialQuantity || 0,
                minStock: 0,
                maxStock: 0,
              })),
            },
          }),
        },
        include: {
          category: true,
          supplier: true,
          customers: {
            include: {
              customer: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
        },
      });

      // Create initial stock transaction if initialQuantity > 0
      if (initialQuantity && initialQuantity > 0) {
        await prisma.stockTransaction.create({
          data: {
            type: "INPUT",
            quantity: initialQuantity,
            previousStock: 0,
            newStock: initialQuantity,
            reason: "Initial stock",
            itemId: item.id,
            workspaceId: workspaceId,
            userId: userId,
          },
        });
      }

      // Add calculated onHand to response
      const itemWithOnHand = addOnHandToItem(item);

      return res.status(201).json({
        status: "success",
        message: "Item created successfully",
        data: { item: itemWithOnHand },
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
          supplier: true,
          customers: {
            include: {
              customer: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Add calculated onHand to each item
      const itemsWithOnHand = items.map(addOnHandToItem);

      return res.status(200).json({
        status: "success",
        data: { items: itemsWithOnHand },
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
          supplier: true,
          workspace: true,
          customers: {
            include: {
              customer: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
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

      // Add calculated onHand to response
      const itemWithOnHand = addOnHandToItem(item);

      return res.status(200).json({
        status: "success",
        data: { item: itemWithOnHand },
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
        include: {
          locations: true,
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
        itemNumber,
        name,
        barcode,
        unit,
        description,
        cost,
        categoryId,
        locationId,
        locationIds,
        supplierId,
        customerIds,
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

      // Verify all customers belong to the workspace (if customerIds provided)
      if (customerIds !== undefined && customerIds.length > 0) {
        const customers = await prisma.customer.findMany({
          where: {
            id: { in: customerIds },
            workspaceId: item.workspaceId,
          },
        });

        if (customers.length !== customerIds.length) {
          return res.status(400).json({
            status: "error",
            message: "One or more customers not found in this workspace",
          });
        }
      }

      // Determine which locations to use (support both single locationId and multiple locationIds)
      const locationsToUpdate =
        locationIds !== undefined && locationIds.length > 0
          ? locationIds
          : locationId !== undefined
          ? [locationId]
          : undefined;

      // Verify all locations belong to the workspace (if locations provided)
      if (locationsToUpdate !== undefined && locationsToUpdate.length > 0) {
        const locations = await prisma.location.findMany({
          where: {
            id: { in: locationsToUpdate },
            workspaceId: item.workspaceId,
          },
        });

        if (locations.length !== locationsToUpdate.length) {
          return res.status(400).json({
            status: "error",
            message: "One or more locations not found in this workspace",
          });
        }
      }

      // Calculate current onHand from existing locations
      const currentOnHand = calculateOnHand(item.locations);

      const updatedItem = await prisma.item.update({
        where: { id },
        data: {
          itemNumber: itemNumber !== undefined ? itemNumber : item.itemNumber,
          name: name || item.name,
          barcode: barcode !== undefined ? barcode : item.barcode,
          unit: unit !== undefined ? unit : item.unit,
          description:
            description !== undefined ? description : item.description,
          cost: cost !== undefined ? cost : item.cost,
          categoryId: categoryId !== undefined ? categoryId : item.categoryId,
          supplierId: supplierId !== undefined ? supplierId : item.supplierId,
          ...(customerIds !== undefined && {
            customers: {
              deleteMany: {},
              create: customerIds.map((customerId: string) => ({
                customerId: customerId,
                quantity: 0,
              })),
            },
          }),
          ...(locationsToUpdate !== undefined && {
            locations: {
              deleteMany: {},
              create: locationsToUpdate.map((locId: string) => ({
                locationId: locId,
                quantity: currentOnHand, // Preserve current total quantity
                minStock: 0,
                maxStock: 0,
              })),
            },
          }),
        },
        include: {
          category: true,
          supplier: true,
          customers: {
            include: {
              customer: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
        },
      });

      // Recalculate status based on new location quantities
      const newOnHand = calculateOnHand(updatedItem.locations);
      const newStatus = determineStatus(newOnHand);

      // Update status if it changed
      if (newStatus !== updatedItem.status) {
        await prisma.item.update({
          where: { id },
          data: { status: newStatus },
        });
        updatedItem.status = newStatus;
      }

      // Add calculated onHand to response
      const itemWithOnHand = addOnHandToItem(updatedItem);

      return res.status(200).json({
        status: "success",
        message: "Item updated successfully",
        data: { item: itemWithOnHand },
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
      const { quantity, type, reason, locationId } = req.body; // type: 'INPUT' or 'OUTPUT'
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
        include: {
          locations: true,
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

      // Calculate previous total stock
      const previousStock = calculateOnHand(item.locations);

      // If locationId is provided, verify it exists for this item
      if (locationId) {
        const itemLocation = await prisma.itemLocation.findUnique({
          where: {
            itemId_locationId: {
              itemId: id,
              locationId: locationId,
            },
          },
        });

        if (!itemLocation) {
          return res.status(400).json({
            status: "error",
            message: "Location not found for this item",
          });
        }

        // Update location-specific quantity
        const previousLocationStock = itemLocation.quantity;
        const newLocationStock =
          type === "INPUT"
            ? previousLocationStock + quantity
            : previousLocationStock - quantity;

        if (newLocationStock < 0) {
          return res.status(400).json({
            status: "error",
            message: "Insufficient stock at this location",
          });
        }

        await prisma.itemLocation.update({
          where: {
            itemId_locationId: {
              itemId: id,
              locationId: locationId,
            },
          },
          data: {
            quantity: newLocationStock,
          },
        });
      }

      // Calculate new total stock
      const newStock =
        type === "INPUT" ? previousStock + quantity : previousStock - quantity;

      if (newStock < 0) {
        return res.status(400).json({
          status: "error",
          message: "Insufficient stock",
        });
      }

      // Determine new status based on total quantity
      const newStatus = determineStatus(newStock);

      // Update item status
      const updatedItem = await prisma.item.update({
        where: { id },
        data: {
          status: newStatus,
        },
        include: {
          locations: {
            include: {
              location: true,
            },
          },
          category: true,
          supplier: true,
          customers: {
            include: {
              customer: true,
            },
          },
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

      // Add calculated onHand to response
      const itemWithOnHand = addOnHandToItem(updatedItem);

      return res.status(200).json({
        status: "success",
        message: "Stock adjusted successfully",
        data: { item: itemWithOnHand },
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
