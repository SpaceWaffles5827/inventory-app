import { Request, Response } from "express";
import prisma from "../utils/prisma";

interface LocationAssignment {
  locationId: string;
  quantity: number;
}

const lotsController = {
  // Get all lots for an item
  getLotsByItem: async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      // Verify item exists and user has access
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: { workspace: true },
      });

      if (!item) {
        return res.status(404).json({
          status: "error",
          message: "Item not found",
        });
      }

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

      // Get all lots for this item
      // Filter out SYSTEM lots (lotNumber === "SYSTEM") but show EXISTING-STOCK lots
      const lots = await prisma.lot.findMany({
        where: {
          itemId: itemId,
          lotNumber: { not: "SYSTEM" }, // Hide SYSTEM lots, but show EXISTING-STOCK
        },
        include: {
          supplier: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
        },
        orderBy: [
          { expirationDate: "asc" }, // Expiring first
          { receivedDate: "desc" }, // Most recent first
        ],
      });

      // Transform the data to include locationCode at the LotLocation level
      const lotsWithLocationCodes = lots.map((lot) => ({
        ...lot,
        locations: lot.locations.map((lotLoc) => ({
          ...lotLoc,
          locationCode: lotLoc.location.code,
        })),
      }));

      return res.status(200).json({
        status: "success",
        data: { lots: lotsWithLocationCodes },
      });
    } catch (error) {
      console.error("Get lots error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve lots",
      });
    }
  },

  // Create a new lot
  createLot: async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      const {
        lotNumber,
        quantity,
        receivedDate,
        manufactureDate,
        expirationDate,
        supplierId,
        poNumber,
        notes,
        locationAssignments,
      } = req.body as {
        lotNumber: string;
        quantity: number;
        receivedDate?: string;
        manufactureDate?: string;
        expirationDate?: string;
        supplierId?: string;
        poNumber?: string;
        notes?: string;
        locationAssignments?: LocationAssignment[];
      };

      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!lotNumber || !quantity) {
        return res.status(400).json({
          status: "error",
          message: "Lot number and quantity are required",
        });
      }

      // Prevent creating lots with reserved names
      if (lotNumber === "SYSTEM" || lotNumber === "EXISTING-STOCK") {
        return res.status(400).json({
          status: "error",
          message:
            "This lot number is reserved by the system. Please choose a different lot number.",
        });
      }

      // Verify item exists and has lot tracking enabled
      const item = await prisma.item.findUnique({
        where: { id: itemId },
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

      if (!item.lotTracking) {
        return res.status(400).json({
          status: "error",
          message: "Lot tracking is not enabled for this item",
        });
      }

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

      // Check if lot number already exists for this item
      const existingLot = await prisma.lot.findUnique({
        where: {
          workspaceId_itemId_lotNumber: {
            workspaceId: item.workspaceId,
            itemId: itemId,
            lotNumber: lotNumber,
          },
        },
      });

      if (existingLot) {
        return res.status(400).json({
          status: "error",
          message: "A lot with this number already exists for this item",
        });
      }

      // If no location assignments provided, use the first item location as default
      let finalLocationAssignments: LocationAssignment[] =
        locationAssignments || [];

      if (!locationAssignments || locationAssignments.length === 0) {
        if (item.locations.length > 0) {
          finalLocationAssignments = [
            {
              locationId: item.locations[0].locationId,
              quantity: quantity,
            },
          ];
        } else {
          return res.status(400).json({
            status: "error",
            message:
              "Item has no locations assigned. Please assign a location to the item first, or provide location assignments for this lot.",
          });
        }
      }

      // Validate location assignments total matches quantity
      const totalAssigned = finalLocationAssignments.reduce(
        (sum, loc) => sum + loc.quantity,
        0,
      );
      if (totalAssigned !== quantity) {
        return res.status(400).json({
          status: "error",
          message: `Location quantities (${totalAssigned}) must total the lot quantity (${quantity})`,
        });
      }

      // Verify all locations are assigned to this item
      const assignedLocationIds = item.locations.map((loc) => loc.locationId);
      const requestedLocationIds = finalLocationAssignments.map(
        (loc) => loc.locationId,
      );
      const invalidLocations = requestedLocationIds.filter(
        (locId) => !assignedLocationIds.includes(locId),
      );

      if (invalidLocations.length > 0) {
        return res.status(400).json({
          status: "error",
          message:
            "One or more locations are not assigned to this item. Please assign the locations to the item first.",
        });
      }

      // Create the lot
      const lot = await prisma.lot.create({
        data: {
          lotNumber,
          quantity,
          initialQuantity: quantity,
          receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
          manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          status: "ACTIVE",
          poNumber: poNumber || null,
          notes: notes || null,
          isSystem: false, // User-created lots are not system lots
          itemId: itemId,
          workspaceId: item.workspaceId,
          supplierId: supplierId || null,
          createdBy: userId,
          locations: {
            create: finalLocationAssignments.map((loc) => ({
              locationId: loc.locationId,
              quantity: loc.quantity,
            })),
          },
        },
        include: {
          supplier: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
        },
      });

      // Create stock transaction for lot receipt
      await prisma.stockTransaction.create({
        data: {
          type: "INPUT",
          quantity: quantity,
          previousStock: 0,
          newStock: quantity,
          reason: `Lot ${lotNumber} received`,
          lotId: lot.id,
          itemId: itemId,
          workspaceId: item.workspaceId,
          userId: userId,
        },
      });

      // Update ItemLocation quantities for each location in the lot
      for (const locAssignment of finalLocationAssignments) {
        // Use upsert to create or update ItemLocation
        await prisma.itemLocation.upsert({
          where: {
            itemId_locationId: {
              itemId: itemId,
              locationId: locAssignment.locationId,
            },
          },
          update: {
            quantity: {
              increment: locAssignment.quantity,
            },
          },
          create: {
            itemId: itemId,
            locationId: locAssignment.locationId,
            quantity: locAssignment.quantity,
            minStock: 0,
            maxStock: 0,
          },
        });
      }

      // Update item status based on new total quantity
      const allItemLocations = await prisma.itemLocation.findMany({
        where: { itemId: itemId },
      });
      const totalQuantity = allItemLocations.reduce(
        (sum, loc) => sum + loc.quantity,
        0,
      );

      let newStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
      if (totalQuantity === 0) newStatus = "OUT_OF_STOCK";
      else if (totalQuantity < 10) newStatus = "LOW_STOCK";

      await prisma.item.update({
        where: { id: itemId },
        data: { status: newStatus },
      });

      // Transform response to include locationCode
      const lotWithLocationCodes = {
        ...lot,
        locations: lot.locations.map((lotLoc) => ({
          ...lotLoc,
          locationCode: lotLoc.location.code,
        })),
      };

      return res.status(201).json({
        status: "success",
        message: "Lot created successfully",
        data: { lot: lotWithLocationCodes },
      });
    } catch (error) {
      console.error("Create lot error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to create lot",
      });
    }
  },

  // Get single lot details
  getLotById: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const lot = await prisma.lot.findUnique({
        where: { id },
        include: {
          item: true,
          supplier: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
          transactions: {
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
              createdAt: "desc",
            },
          },
        },
      });

      if (!lot) {
        return res.status(404).json({
          status: "error",
          message: "Lot not found",
        });
      }

      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: lot.workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this lot",
        });
      }

      // Transform to include locationCode
      const lotWithLocationCodes = {
        ...lot,
        locations: lot.locations.map((lotLoc) => ({
          ...lotLoc,
          locationCode: lotLoc.location.code,
        })),
      };

      return res.status(200).json({
        status: "success",
        data: { lot: lotWithLocationCodes },
      });
    } catch (error) {
      console.error("Get lot error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve lot",
      });
    }
  },

  // Update lot status (e.g., mark as expired, quarantined)
  updateLotStatus: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const lot = await prisma.lot.findUnique({
        where: { id },
      });

      if (!lot) {
        return res.status(404).json({
          status: "error",
          message: "Lot not found",
        });
      }

      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: lot.workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to update this lot",
        });
      }

      const updatedLot = await prisma.lot.update({
        where: { id },
        data: {
          status: status || lot.status,
          notes: notes !== undefined ? notes : lot.notes,
        },
        include: {
          supplier: true,
          locations: {
            include: {
              location: true,
            },
          },
        },
      });

      // Transform to include locationCode
      const lotWithLocationCodes = {
        ...updatedLot,
        locations: updatedLot.locations.map((lotLoc) => ({
          ...lotLoc,
          locationCode: lotLoc.location.code,
        })),
      };

      return res.status(200).json({
        status: "success",
        message: "Lot updated successfully",
        data: { lot: lotWithLocationCodes },
      });
    } catch (error) {
      console.error("Update lot error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update lot",
      });
    }
  },

  // Adjust lot quantity (add or remove stock from a specific lot at a specific location)
  adjustLotQuantity: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { type, quantity, reason, locationId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!type || !quantity || !locationId) {
        return res.status(400).json({
          status: "error",
          message: "Type, quantity, and locationId are required",
        });
      }

      if (type !== "INPUT" && type !== "OUTPUT") {
        return res.status(400).json({
          status: "error",
          message: "Type must be INPUT or OUTPUT",
        });
      }

      // Get the lot with location details
      const lot = await prisma.lot.findUnique({
        where: { id },
        include: {
          locations: true,
          item: true,
        },
      });

      if (!lot) {
        return res.status(404).json({
          status: "error",
          message: "Lot not found",
        });
      }

      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: lot.workspaceId,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this lot",
        });
      }

      // Find or create the LotLocation record for this location
      let lotLocation = lot.locations.find(
        (loc) => loc.locationId === locationId,
      );

      if (!lotLocation) {
        // If lot is not assigned to this location yet, create the LotLocation record
        lotLocation = await prisma.lotLocation.create({
          data: {
            lotId: id,
            locationId: locationId,
            quantity: 0,
          },
        });
      }

      // Calculate new quantity
      const currentQty = lotLocation.quantity;
      const newQty =
        type === "INPUT" ? currentQty + quantity : currentQty - quantity;

      if (newQty < 0) {
        return res.status(400).json({
          status: "error",
          message: `Cannot remove ${quantity} units. Only ${currentQty} available at this location.`,
        });
      }

      // Update LotLocation quantity (SOURCE OF TRUTH)
      await prisma.lotLocation.update({
        where: { id: lotLocation.id },
        data: { quantity: newQty },
      });

      // Recalculate Lot.quantity from all LotLocations
      const allLotLocations = await prisma.lotLocation.findMany({
        where: { lotId: id },
      });
      const totalLotQuantity = allLotLocations.reduce(
        (sum, loc) => sum + loc.quantity,
        0,
      );

      // Update Lot.quantity and status (cached value)
      // Determine new status based on quantity
      let newStatus = lot.status;
      if (totalLotQuantity === 0) {
        newStatus = "DEPLETED";
      } else if (lot.status === "DEPLETED" && totalLotQuantity > 0) {
        // Re-activate lot if it was depleted and now has stock
        newStatus = "ACTIVE";
      } else if (
        lot.expirationDate &&
        new Date(lot.expirationDate) < new Date() &&
        totalLotQuantity > 0
      ) {
        // Keep EXPIRED status if still expired
        newStatus = "EXPIRED";
      } else if (lot.status === "QUARANTINED" || lot.status === "RECALLED") {
        // Keep QUARANTINED or RECALLED status (manual status)
        newStatus = lot.status;
      }

      await prisma.lot.update({
        where: { id },
        data: {
          quantity: totalLotQuantity,
          status: newStatus,
        },
      });

      // Recalculate ItemLocation quantity - FIXED TO USE UPSERT
      // Get all lot quantities at this location for this item
      const allLotsAtLocation = await prisma.lotLocation.findMany({
        where: {
          locationId: locationId,
          lot: {
            itemId: lot.itemId,
          },
        },
      });

      const totalAtLocation = allLotsAtLocation.reduce(
        (sum, loc) => sum + loc.quantity,
        0,
      );

      // Use upsert to create or update ItemLocation
      await prisma.itemLocation.upsert({
        where: {
          itemId_locationId: {
            itemId: lot.itemId,
            locationId: locationId,
          },
        },
        update: {
          quantity: totalAtLocation,
        },
        create: {
          itemId: lot.itemId,
          locationId: locationId,
          quantity: totalAtLocation,
          minStock: 0,
          maxStock: 0,
        },
      });

      // Create stock transaction
      await prisma.stockTransaction.create({
        data: {
          type: type,
          quantity: quantity,
          previousStock: currentQty,
          newStock: newQty,
          reason: reason || `Lot ${lot.lotNumber} adjustment`,
          lotId: lot.id,
          itemId: lot.itemId,
          workspaceId: lot.workspaceId,
          userId: userId,
        },
      });

      // Update item status based on total quantity across all locations
      const allItemLocations = await prisma.itemLocation.findMany({
        where: { itemId: lot.itemId },
      });
      const totalItemQuantity = allItemLocations.reduce(
        (sum, loc) => sum + loc.quantity,
        0,
      );

      let newItemStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" = "IN_STOCK";
      if (totalItemQuantity === 0) newItemStatus = "OUT_OF_STOCK";
      else if (totalItemQuantity < 10) newItemStatus = "LOW_STOCK";

      await prisma.item.update({
        where: { id: lot.itemId },
        data: { status: newItemStatus },
      });

      // Fetch updated lot with relations
      const updatedLot = await prisma.lot.findUnique({
        where: { id },
        include: {
          supplier: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
        },
      });

      // Transform to include locationCode
      const lotWithLocationCodes = {
        ...updatedLot,
        locations: updatedLot!.locations.map((lotLoc) => ({
          ...lotLoc,
          locationCode: lotLoc.location.code,
        })),
      };

      return res.status(200).json({
        status: "success",
        message: "Lot quantity adjusted successfully",
        data: { lot: lotWithLocationCodes },
      });
    } catch (error) {
      console.error("Adjust lot quantity error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to adjust lot quantity",
      });
    }
  },

  // Update lot details
  updateLot: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const {
        lotNumber,
        status,
        receivedDate,
        manufactureDate,
        expirationDate,
        supplierId,
        poNumber,
        notes,
      } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const lot = await prisma.lot.findUnique({
        where: { id },
        include: { item: true },
      });

      if (!lot) {
        return res.status(404).json({
          status: "error",
          message: "Lot not found",
        });
      }

      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: lot.workspaceId,
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to update this lot",
        });
      }

      // Prevent changing SYSTEM or EXISTING-STOCK lot numbers
      if (lot.lotNumber === "SYSTEM" || lot.lotNumber === "EXISTING-STOCK") {
        if (lotNumber && lotNumber !== lot.lotNumber) {
          return res.status(400).json({
            status: "error",
            message: "Cannot change the lot number of system-managed lots",
          });
        }
      }

      // If changing lot number, check for uniqueness
      if (lotNumber && lotNumber !== lot.lotNumber) {
        // Prevent using reserved names
        if (lotNumber === "SYSTEM" || lotNumber === "EXISTING-STOCK") {
          return res.status(400).json({
            status: "error",
            message: "This lot number is reserved by the system",
          });
        }

        const existingLot = await prisma.lot.findUnique({
          where: {
            workspaceId_itemId_lotNumber: {
              workspaceId: lot.workspaceId,
              itemId: lot.itemId,
              lotNumber: lotNumber,
            },
          },
        });

        if (existingLot) {
          return res.status(400).json({
            status: "error",
            message: "A lot with this number already exists for this item",
          });
        }
      }

      const updatedLot = await prisma.lot.update({
        where: { id },
        data: {
          lotNumber: lotNumber !== undefined ? lotNumber : lot.lotNumber,
          status: status !== undefined ? status : lot.status,
          receivedDate: receivedDate
            ? new Date(receivedDate)
            : lot.receivedDate,
          manufactureDate: manufactureDate
            ? new Date(manufactureDate)
            : lot.manufactureDate,
          expirationDate: expirationDate
            ? new Date(expirationDate)
            : lot.expirationDate,
          supplierId: supplierId !== undefined ? supplierId : lot.supplierId,
          poNumber: poNumber !== undefined ? poNumber : lot.poNumber,
          notes: notes !== undefined ? notes : lot.notes,
        },
        include: {
          supplier: true,
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          locations: {
            include: {
              location: true,
            },
          },
        },
      });

      // Transform to include locationCode
      const lotWithLocationCodes = {
        ...updatedLot,
        locations: updatedLot.locations.map((lotLoc) => ({
          ...lotLoc,
          locationCode: lotLoc.location.code,
        })),
      };

      return res.status(200).json({
        status: "success",
        message: "Lot updated successfully",
        data: { lot: lotWithLocationCodes },
      });
    } catch (error) {
      console.error("Update lot error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to update lot",
      });
    }
  },
};

export default lotsController;
