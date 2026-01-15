import { Request, Response } from "express";
import prisma from "../utils/prisma";

// CONSTANTS
const SYSTEM_LOT_NUMBER = "SYSTEM";
const EXISTING_STOCK_LOT_NUMBER = "EXISTING-STOCK";

// Helper function to get or create SYSTEM lot for non-lotted items
const getOrCreateSystemLot = async (
  itemId: string,
  workspaceId: string,
  userId: string
) => {
  let systemLot = await prisma.lot.findUnique({
    where: {
      workspaceId_itemId_lotNumber: {
        workspaceId,
        itemId,
        lotNumber: SYSTEM_LOT_NUMBER,
      },
    },
  });

  if (!systemLot) {
    systemLot = await prisma.lot.create({
      data: {
        lotNumber: SYSTEM_LOT_NUMBER,
        quantity: 0,
        initialQuantity: 0,
        isSystem: true,
        status: "ACTIVE",
        itemId,
        workspaceId,
        createdBy: userId,
      },
    });
  }

  return systemLot;
};

// Helper function to recalculate and update Lot.quantity from LotLocation
const recalculateLotQuantity = async (lotId: string) => {
  const lotLocations = await prisma.lotLocation.findMany({
    where: { lotId },
  });

  const totalQuantity = lotLocations.reduce(
    (sum, loc) => sum + loc.quantity,
    0
  );

  await prisma.lot.update({
    where: { id: lotId },
    data: { quantity: totalQuantity },
  });

  return totalQuantity;
};

// Helper function to recalculate and update ItemLocation.quantity from LotLocation
const recalculateItemLocationQuantity = async (
  itemId: string,
  locationId: string
) => {
  // Get all lots for this item
  const lots = await prisma.lot.findMany({
    where: { itemId },
    include: {
      locations: {
        where: { locationId },
      },
    },
  });

  const totalQuantity = lots.reduce((sum, lot) => {
    return (
      sum +
      lot.locations.reduce((lotSum, lotLoc) => lotSum + lotLoc.quantity, 0)
    );
  }, 0);

  // Update or create ItemLocation
  await prisma.itemLocation.upsert({
    where: {
      itemId_locationId: {
        itemId,
        locationId,
      },
    },
    update: {
      quantity: totalQuantity,
    },
    create: {
      itemId,
      locationId,
      quantity: totalQuantity,
      minStock: 0,
      maxStock: 0,
    },
  });

  return totalQuantity;
};

// Helper function to calculate total onHand from LotLocation (SOURCE OF TRUTH)
const calculateOnHandFromLots = async (itemId: string): Promise<number> => {
  const lots = await prisma.lot.findMany({
    where: { itemId },
    include: {
      locations: true,
    },
  });

  return lots.reduce((total, lot) => {
    return (
      total +
      lot.locations.reduce((lotTotal, lotLoc) => lotTotal + lotLoc.quantity, 0)
    );
  }, 0);
};

// Helper function to determine item status based on total quantity
const determineStatus = (
  onHand: number
): "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" => {
  if (onHand === 0) return "OUT_OF_STOCK";
  if (onHand < 10) return "LOW_STOCK";
  return "IN_STOCK";
};

// Helper function to add onHand to item (calculated from lots)
const addOnHandToItem = async <T extends { id: string }>(item: T) => {
  const onHand = await calculateOnHandFromLots(item.id);
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
        const match = lastItem.itemNumber.match(/ITM-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const itemNumber = `ITM-${String(nextNumber).padStart(3, "0")}`;

      // Verify all customers belong to the workspace
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

      // Determine which locations to use
      const locationsToCreate =
        locationIds && locationIds.length > 0
          ? locationIds
          : locationId
          ? [locationId]
          : [];

      // Verify all locations belong to the workspace
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
          lotTracking: false, // Default to non-lotted
          ...(customerIds &&
            customerIds.length > 0 && {
              customers: {
                create: customerIds.map((customerId: string) => ({
                  customerId: customerId,
                  quantity: 0,
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

      // Create SYSTEM lot for this item
      const systemLot = await getOrCreateSystemLot(
        item.id,
        workspaceId,
        userId
      );

      // If initial quantity > 0 and locations specified, add to LotLocation
      if (initialQuantity > 0 && locationsToCreate.length > 0) {
        // Distribute quantity evenly across locations (or to first location)
        const quantityPerLocation =
          locationsToCreate.length === 1
            ? initialQuantity
            : Math.floor(initialQuantity / locationsToCreate.length);

        for (let i = 0; i < locationsToCreate.length; i++) {
          const locId = locationsToCreate[i];
          const qty =
            i === 0
              ? initialQuantity -
                quantityPerLocation * (locationsToCreate.length - 1)
              : quantityPerLocation;

          if (qty > 0) {
            await prisma.lotLocation.create({
              data: {
                lotId: systemLot.id,
                locationId: locId,
                quantity: qty,
              },
            });

            // Update ItemLocation cache
            await recalculateItemLocationQuantity(item.id, locId);
          }
        }

        // Update Lot.quantity cache
        await recalculateLotQuantity(systemLot.id);

        // Create stock transaction
        await prisma.stockTransaction.create({
          data: {
            type: "INPUT",
            quantity: initialQuantity,
            previousStock: 0,
            newStock: initialQuantity,
            reason: "Initial stock",
            lotId: systemLot.id,
            itemId: item.id,
            workspaceId: workspaceId,
            userId: userId,
          },
        });
      }

      // Add calculated onHand to response
      const itemWithOnHand = await addOnHandToItem(item);

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
      const itemsWithOnHand = await Promise.all(
        items.map((item) => addOnHandToItem(item))
      );

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
            take: 10,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              fromLocation: {
                select: {
                  code: true,
                },
              },
              toLocation: {
                select: {
                  code: true,
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
      const itemWithOnHand = await addOnHandToItem(item);

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
        lotTracking,
      } = req.body;

      // Check if itemNumber is being changed and if it's unique
      if (itemNumber && itemNumber !== item.itemNumber) {
        const existingItem = await prisma.item.findFirst({
          where: {
            workspaceId: item.workspaceId,
            itemNumber: itemNumber,
            id: { not: id },
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

      // Verify all customers belong to the workspace
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

      // Determine which locations to use
      const locationsToUpdate =
        locationIds !== undefined && locationIds.length > 0
          ? locationIds
          : locationId !== undefined
          ? [locationId]
          : undefined;

      // Verify all locations belong to the workspace
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

      // Handle lot tracking toggle BEFORE updating the item
      if (lotTracking !== undefined && lotTracking !== item.lotTracking) {
        if (lotTracking) {
          // ENABLING lot tracking - Convert SYSTEM lot to EXISTING-STOCK

          let systemLot = await prisma.lot.findUnique({
            where: {
              workspaceId_itemId_lotNumber: {
                workspaceId: item.workspaceId,
                itemId: id,
                lotNumber: SYSTEM_LOT_NUMBER,
              },
            },
            include: {
              locations: true,
            },
          });

          // Get current ItemLocation quantities
          const itemLocations = await prisma.itemLocation.findMany({
            where: { itemId: id },
          });

          if (systemLot) {
            // SYSTEM lot exists - rename it to EXISTING-STOCK and sync quantities

            // First, sync the quantities from ItemLocations
            await prisma.lotLocation.deleteMany({
              where: { lotId: systemLot.id },
            });

            for (const itemLoc of itemLocations) {
              if (itemLoc.quantity > 0) {
                await prisma.lotLocation.create({
                  data: {
                    lotId: systemLot.id,
                    locationId: itemLoc.locationId,
                    quantity: itemLoc.quantity,
                  },
                });
              }
            }

            const totalQty = itemLocations.reduce(
              (sum, loc) => sum + loc.quantity,
              0
            );

            // Rename SYSTEM to EXISTING-STOCK and make it user-visible
            await prisma.lot.update({
              where: { id: systemLot.id },
              data: {
                lotNumber: EXISTING_STOCK_LOT_NUMBER,
                quantity: totalQty,
                initialQuantity:
                  totalQty > systemLot.initialQuantity
                    ? totalQty
                    : systemLot.initialQuantity,
                status: totalQty > 0 ? "ACTIVE" : "DEPLETED",
                isSystem: true, // Keep isSystem flag for tracking
                notes: "Pre-existing inventory before lot tracking was enabled",
              },
            });
          } else {
            // No SYSTEM lot exists - create EXISTING-STOCK lot
            const totalQty = itemLocations.reduce(
              (sum, loc) => sum + loc.quantity,
              0
            );

            await prisma.lot.create({
              data: {
                lotNumber: EXISTING_STOCK_LOT_NUMBER,
                quantity: totalQty,
                initialQuantity: totalQty,
                receivedDate: new Date(),
                status: totalQty > 0 ? "ACTIVE" : "DEPLETED",
                isSystem: true,
                notes: "Pre-existing inventory before lot tracking was enabled",
                itemId: id,
                workspaceId: item.workspaceId,
                createdBy: userId,
                locations: {
                  create: itemLocations
                    .filter((loc) => loc.quantity > 0)
                    .map((loc) => ({
                      locationId: loc.locationId,
                      quantity: loc.quantity,
                    })),
                },
              },
            });
          }
        } else {
          // DISABLING lot tracking - Consolidate ALL lots back to SYSTEM

          const lots = await prisma.lot.findMany({
            where: { itemId: id },
            include: { locations: true },
          });

          // Calculate total quantities per location from all lots
          const locationTotals = new Map<string, number>();
          lots.forEach((lot) => {
            lot.locations.forEach((lotLoc) => {
              const current = locationTotals.get(lotLoc.locationId) || 0;
              locationTotals.set(lotLoc.locationId, current + lotLoc.quantity);
            });
          });

          // Update ItemLocation quantities
          for (const [locationId, quantity] of locationTotals.entries()) {
            await prisma.itemLocation.upsert({
              where: {
                itemId_locationId: {
                  itemId: id,
                  locationId: locationId,
                },
              },
              update: {
                quantity: quantity,
              },
              create: {
                itemId: id,
                locationId: locationId,
                quantity: quantity,
                minStock: 0,
                maxStock: 0,
              },
            });
          }

          // Check if EXISTING-STOCK lot exists
          const existingStockLot = await prisma.lot.findUnique({
            where: {
              workspaceId_itemId_lotNumber: {
                workspaceId: item.workspaceId,
                itemId: id,
                lotNumber: EXISTING_STOCK_LOT_NUMBER,
              },
            },
          });

          if (existingStockLot) {
            // Rename EXISTING-STOCK back to SYSTEM
            await prisma.lot.update({
              where: { id: existingStockLot.id },
              data: {
                lotNumber: SYSTEM_LOT_NUMBER,
                notes: null, // Clear the note
              },
            });

            // Update its locations to match consolidated totals
            await prisma.lotLocation.deleteMany({
              where: { lotId: existingStockLot.id },
            });

            for (const [locationId, quantity] of locationTotals.entries()) {
              if (quantity > 0) {
                await prisma.lotLocation.create({
                  data: {
                    lotId: existingStockLot.id,
                    locationId: locationId,
                    quantity: quantity,
                  },
                });
              }
            }

            // Update lot quantity
            const totalQty = Array.from(locationTotals.values()).reduce(
              (a, b) => a + b,
              0
            );
            await prisma.lot.update({
              where: { id: existingStockLot.id },
              data: {
                quantity: totalQty,
                status: totalQty > 0 ? "ACTIVE" : "DEPLETED",
              },
            });

            // Delete all OTHER lots (keep the renamed SYSTEM lot)
            await prisma.lot.deleteMany({
              where: {
                itemId: id,
                id: { not: existingStockLot.id },
              },
            });
          } else {
            // No EXISTING-STOCK lot - delete all lots and create new SYSTEM lot
            await prisma.lot.deleteMany({
              where: { itemId: id },
            });

            const totalQty = Array.from(locationTotals.values()).reduce(
              (a, b) => a + b,
              0
            );

            const newSystemLot = await prisma.lot.create({
              data: {
                lotNumber: SYSTEM_LOT_NUMBER,
                quantity: totalQty,
                initialQuantity: totalQty,
                receivedDate: new Date(),
                status: totalQty > 0 ? "ACTIVE" : "DEPLETED",
                isSystem: true,
                itemId: id,
                workspaceId: item.workspaceId,
                createdBy: userId,
              },
            });

            for (const [locationId, quantity] of locationTotals.entries()) {
              if (quantity > 0) {
                await prisma.lotLocation.create({
                  data: {
                    lotId: newSystemLot.id,
                    locationId: locationId,
                    quantity: quantity,
                  },
                });
              }
            }
          }
        }
      }

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
          lotTracking:
            lotTracking !== undefined ? lotTracking : item.lotTracking,
          ...(customerIds !== undefined && {
            customers: {
              deleteMany: {},
              create: customerIds.map((customerId: string) => ({
                customerId: customerId,
                quantity: 0,
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

      // If locations are being updated, handle ItemLocation records
      if (locationsToUpdate !== undefined) {
        // Get current quantities from lots across all locations
        const lots = await prisma.lot.findMany({
          where: { itemId: id },
          include: { locations: true },
        });

        const locationQuantities = new Map<string, number>();
        lots.forEach((lot) => {
          lot.locations.forEach((lotLoc) => {
            const current = locationQuantities.get(lotLoc.locationId) || 0;
            locationQuantities.set(
              lotLoc.locationId,
              current + lotLoc.quantity
            );
          });
        });

        // Remove old ItemLocation records
        await prisma.itemLocation.deleteMany({
          where: { itemId: id },
        });

        // Create ItemLocation records for all requested locations
        for (const locationId of locationsToUpdate) {
          await prisma.itemLocation.create({
            data: {
              itemId: id,
              locationId,
              quantity: locationQuantities.get(locationId) || 0,
              minStock: 0,
              maxStock: 0,
            },
          });
        }
      }

      // Recalculate status based on total quantity from lots
      const newOnHand = await calculateOnHandFromLots(id);
      const newStatus = determineStatus(newOnHand);

      // Update status if it changed
      if (newStatus !== updatedItem.status) {
        await prisma.item.update({
          where: { id },
          data: { status: newStatus },
        });
        updatedItem.status = newStatus;
      }

      // Ensure SYSTEM lot exists for this item (only if lot tracking is disabled)
      if (!updatedItem.lotTracking) {
        await getOrCreateSystemLot(id, item.workspaceId, userId);
      }

      // Add calculated onHand to response
      const itemWithOnHand = await addOnHandToItem(updatedItem);

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
          role: { in: ["OWNER", "ADMIN"] },
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have permission to delete this item",
        });
      }

      // Delete cascades to lots, lot locations, transactions, etc.
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

  // Adjust stock (add or remove) - NOW USES LOTLOCATION AS SOURCE OF TRUTH
  adjustStock: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { quantity, type, reason, locationId } = req.body;
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

      if (!locationId) {
        return res.status(400).json({
          status: "error",
          message: "Location ID is required",
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

      // If item has lot tracking enabled, require lot-specific adjustments
      if (item.lotTracking) {
        return res.status(400).json({
          status: "error",
          message:
            "This item uses lot tracking. Please use the lot adjustment endpoint to modify stock for specific lots.",
        });
      }

      // Get or create SYSTEM lot for this item
      const systemLot = await getOrCreateSystemLot(
        id,
        item.workspaceId,
        userId
      );

      // Calculate previous total stock from LotLocation (SOURCE OF TRUTH)
      const previousStock = await calculateOnHandFromLots(id);

      // Get or create LotLocation for SYSTEM lot at this location
      let lotLocation = await prisma.lotLocation.findUnique({
        where: {
          lotId_locationId: {
            lotId: systemLot.id,
            locationId: locationId,
          },
        },
      });

      if (!lotLocation) {
        lotLocation = await prisma.lotLocation.create({
          data: {
            lotId: systemLot.id,
            locationId: locationId,
            quantity: 0,
          },
        });
      }

      // Calculate new quantity for this location
      const previousLocationStock = lotLocation.quantity;
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

      // UPDATE SOURCE OF TRUTH: LotLocation.quantity
      await prisma.lotLocation.update({
        where: {
          lotId_locationId: {
            lotId: systemLot.id,
            locationId: locationId,
          },
        },
        data: {
          quantity: newLocationStock,
        },
      });

      // Update CACHED values: Lot.quantity
      await recalculateLotQuantity(systemLot.id);

      // Update CACHED values: ItemLocation.quantity
      await recalculateItemLocationQuantity(id, locationId);

      // Calculate new total stock from LotLocation
      const newStock = await calculateOnHandFromLots(id);

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

      // Create stock transaction (now ALWAYS references a lotId)
      await prisma.stockTransaction.create({
        data: {
          type,
          quantity,
          previousStock,
          newStock,
          reason,
          lotId: systemLot.id, // ALWAYS reference lot (SYSTEM for non-lotted items)
          itemId: id,
          workspaceId: item.workspaceId,
          userId: userId,
        },
      });

      // Add calculated onHand to response
      const itemWithOnHand = await addOnHandToItem(updatedItem);

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

  // Transfer stock between locations
  transferStock: async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { quantity, fromLocationId, toLocationId, reason, lotId } =
        req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!quantity || !fromLocationId || !toLocationId) {
        return res.status(400).json({
          status: "error",
          message: "Quantity, from location, and to location are required",
        });
      }

      if (fromLocationId === toLocationId) {
        return res.status(400).json({
          status: "error",
          message: "Cannot transfer to the same location",
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

      // Verify user has access
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

      // Fetch location details for better transaction reason
      const fromLocation = await prisma.location.findUnique({
        where: { id: fromLocationId },
        select: { code: true },
      });

      const toLocation = await prisma.location.findUnique({
        where: { id: toLocationId },
        select: { code: true },
      });

      if (!fromLocation || !toLocation) {
        return res.status(404).json({
          status: "error",
          message: "One or both locations not found",
        });
      }

      // Determine which lot to use
      let targetLotId = lotId;

      if (!targetLotId) {
        // Get SYSTEM lot for non-lotted items
        const systemLot = await getOrCreateSystemLot(
          id,
          item.workspaceId,
          userId
        );
        targetLotId = systemLot.id;
      }

      // Get source LotLocation
      const sourceLotLocation = await prisma.lotLocation.findUnique({
        where: {
          lotId_locationId: {
            lotId: targetLotId,
            locationId: fromLocationId,
          },
        },
      });

      if (!sourceLotLocation || sourceLotLocation.quantity < quantity) {
        return res.status(400).json({
          status: "error",
          message: "Insufficient stock at source location",
        });
      }

      const previousStock = await calculateOnHandFromLots(id);

      // Perform transfer in transaction
      await prisma.$transaction(async (tx) => {
        // Remove from source
        await tx.lotLocation.update({
          where: {
            lotId_locationId: {
              lotId: targetLotId,
              locationId: fromLocationId,
            },
          },
          data: {
            quantity: sourceLotLocation.quantity - quantity,
          },
        });

        // Add to destination (create if doesn't exist)
        await tx.lotLocation.upsert({
          where: {
            lotId_locationId: {
              lotId: targetLotId,
              locationId: toLocationId,
            },
          },
          update: {
            quantity: {
              increment: quantity,
            },
          },
          create: {
            lotId: targetLotId,
            locationId: toLocationId,
            quantity: quantity,
          },
        });

        // Ensure ItemLocation exists for destination
        await tx.itemLocation.upsert({
          where: {
            itemId_locationId: {
              itemId: id,
              locationId: toLocationId,
            },
          },
          update: {},
          create: {
            itemId: id,
            locationId: toLocationId,
            quantity: 0,
            minStock: 0,
            maxStock: 0,
          },
        });

        // Create SINGLE transfer transaction with location tracking
        await tx.stockTransaction.create({
          data: {
            type: "TRANSFER",
            quantity: quantity,
            previousStock: previousStock,
            newStock: previousStock, // Total doesn't change in transfer
            reason:
              reason || `Transfer: ${fromLocation.code} → ${toLocation.code}`,
            lotId: targetLotId,
            itemId: id,
            workspaceId: item.workspaceId,
            userId: userId,
            fromLocationId: fromLocationId, // NEW: Track source
            toLocationId: toLocationId, // NEW: Track destination
          },
        });
      });

      // Recalculate caches
      await recalculateItemLocationQuantity(id, fromLocationId);
      await recalculateItemLocationQuantity(id, toLocationId);
      await recalculateLotQuantity(targetLotId);

      const updatedItem = await prisma.item.findUnique({
        where: { id },
        include: {
          locations: {
            include: {
              location: true,
            },
          },
          category: true,
          supplier: true,
        },
      });

      const itemWithOnHand = await addOnHandToItem(updatedItem!);

      return res.status(200).json({
        status: "success",
        message: "Stock transferred successfully",
        data: { item: itemWithOnHand },
      });
    } catch (error) {
      console.error("Transfer stock error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to transfer stock",
      });
    }
  },
};

export default itemsController;
