import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../utils/prisma";
import {
  PERMISSIONS,
  assertInWorkspace,
  loadItemForUser,
  loadLotForUser,
  requireMembership,
  requireUserId,
} from "../utils/access";
import { HttpError, badRequest, notFound, sendSuccess } from "../utils/http";
import {
  parseBody,
  parseQuery,
  zId,
  zOptionalDate,
  zOptionalId,
  zOptionalText,
  zPositiveInt,
  zText,
} from "../utils/validate";
import {
  SYSTEM_LOT_NUMBER,
  addToLotLocation,
  applyAdjustment,
  getItemOnHand,
  isReservedLotNumber,
  isUniqueViolation,
  lockItem,
  recomputeItemCaches,
  recordTransaction,
  withStockTransaction,
} from "../utils/stock";

const LOT_STATUSES = ["ACTIVE", "DEPLETED", "EXPIRED", "QUARANTINED", "RECALLED"] as const;

const creatorSelect = { select: { id: true, name: true, email: true } } as const;

const lotInclude = {
  supplier: true,
  creator: creatorSelect,
  locations: { include: { location: true } },
} satisfies Prisma.LotInclude;

type LotWithLocations = Prisma.LotGetPayload<{ include: { locations: { include: { location: true } } } }>;

/** Adds locationCode on every LotLocation (existing response contract). */
const withLocationCodes = <T extends LotWithLocations>(lot: T) => ({
  ...lot,
  locations: lot.locations.map((ll) => ({ ...ll, locationCode: ll.location.code })),
});

async function lotResponse(id: string) {
  const lot = await prisma.lot.findUniqueOrThrow({ where: { id }, include: lotInclude });
  return withLocationCodes(lot);
}

const zLotNumber = zText(100).refine((v) => !isReservedLotNumber(v), {
  message: "This lot number is reserved by the system. Please choose a different lot number.",
});

const createLotSchema = z.object({
  lotNumber: zLotNumber,
  quantity: zPositiveInt("Quantity"),
  receivedDate: zOptionalDate,
  manufactureDate: zOptionalDate,
  expirationDate: zOptionalDate,
  supplierId: zOptionalId,
  poNumber: zOptionalText(100),
  notes: zOptionalText(5000),
  locationAssignments: z
    .array(z.object({ locationId: zId, quantity: zPositiveInt("Location quantity") }))
    .max(200)
    .optional(),
});

const adjustLotSchema = z.object({
  type: z.enum(["INPUT", "OUTPUT"]),
  quantity: zPositiveInt("Quantity"),
  reason: zOptionalText(500),
  locationId: zId,
});

const updateLotSchema = z.object({
  lotNumber: zText(100).optional(),
  status: z.enum(LOT_STATUSES).optional(),
  receivedDate: zOptionalDate,
  manufactureDate: zOptionalDate,
  expirationDate: zOptionalDate,
  supplierId: zOptionalId,
  poNumber: zOptionalText(100),
  notes: zOptionalText(5000),
});

const updateLotStatusSchema = z.object({
  status: z.enum(LOT_STATUSES).optional(),
  notes: zOptionalText(5000),
});

const lotsController = {
  // GET /api/lots/item/:itemId  (SYSTEM lot hidden; EXISTING-STOCK shown)
  getLotsByItem: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { item } = await loadItemForUser(userId, req.params.itemId);

    const lots = await prisma.lot.findMany({
      where: { itemId: item.id, lotNumber: { not: SYSTEM_LOT_NUMBER } },
      include: lotInclude,
      orderBy: [{ expirationDate: "asc" }, { receivedDate: "desc" }],
    });

    return sendSuccess(res, { lots: lots.map(withLocationCodes) });
  },

  // GET /api/lots/expiring?workspaceId=&days=30  (active lots with stock expiring soon)
  getExpiringLots: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const q = parseQuery(
      z.object({
        workspaceId: zId,
        days: z.preprocess(
          (v) => (v === undefined || v === "" ? undefined : Number(v)),
          z.number().int().min(0).max(3650).default(30)
        ),
      }),
      req
    );
    await requireMembership(userId, q.workspaceId);

    const until = new Date(Date.now() + q.days * 24 * 60 * 60 * 1000);
    const lots = await prisma.lot.findMany({
      where: {
        workspaceId: q.workspaceId,
        isSystem: false,
        quantity: { gt: 0 },
        expirationDate: { not: null, lte: until },
      },
      include: {
        ...lotInclude,
        item: { select: { id: true, name: true, itemNumber: true, unit: true } },
      },
      orderBy: { expirationDate: "asc" },
      take: 500,
    });

    return sendSuccess(res, { lots: lots.map(withLocationCodes) });
  },

  // POST /api/lots/item/:itemId — receive a new lot
  createLot: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(createLotSchema, req);
    const { item } = await loadItemForUser(userId, req.params.itemId, PERMISSIONS.stockOperation);

    if (!item.lotTracking) throw badRequest("Lot tracking is not enabled for this item");
    if (body.supplierId) await assertInWorkspace("supplier", body.supplierId, item.workspaceId);

    const itemLocations = await prisma.itemLocation.findMany({
      where: { itemId: item.id },
      select: { locationId: true },
      orderBy: { createdAt: "asc" },
    });

    // Default: everything goes to the item's first location. Duplicate
    // locations in the payload are merged.
    let assignments = body.locationAssignments ?? [];
    if (assignments.length === 0) {
      if (itemLocations.length === 0) {
        throw badRequest(
          "Item has no locations assigned. Please assign a location to the item first, or provide location assignments for this lot."
        );
      }
      assignments = [{ locationId: itemLocations[0].locationId, quantity: body.quantity }];
    }
    const merged = new Map<string, number>();
    for (const a of assignments) merged.set(a.locationId, (merged.get(a.locationId) ?? 0) + a.quantity);

    const totalAssigned = Array.from(merged.values()).reduce((s, q) => s + q, 0);
    if (totalAssigned !== body.quantity) {
      throw badRequest(
        `Location quantities (${totalAssigned}) must total the lot quantity (${body.quantity})`
      );
    }

    const assigned = new Set(itemLocations.map((l) => l.locationId));
    if (Array.from(merged.keys()).some((id) => !assigned.has(id))) {
      throw badRequest(
        "One or more locations are not assigned to this item. Please assign the locations to the item first."
      );
    }

    const existing = await prisma.lot.findUnique({
      where: {
        workspaceId_itemId_lotNumber: {
          workspaceId: item.workspaceId,
          itemId: item.id,
          lotNumber: body.lotNumber,
        },
      },
      select: { id: true },
    });
    if (existing) throw badRequest("A lot with this number already exists for this item");

    let lotId: string;
    try {
      lotId = await withStockTransaction(async (tx) => {
        const locked = await lockItem(tx, item.id);
        if (!locked.lotTracking) throw badRequest("Lot tracking is not enabled for this item");

        const lot = await tx.lot.create({
          data: {
            lotNumber: body.lotNumber,
            quantity: 0,
            initialQuantity: body.quantity,
            receivedDate: body.receivedDate ?? new Date(),
            manufactureDate: body.manufactureDate ?? null,
            expirationDate: body.expirationDate ?? null,
            status: "ACTIVE",
            poNumber: body.poNumber ?? null,
            notes: body.notes ?? null,
            isSystem: false,
            itemId: item.id,
            workspaceId: item.workspaceId,
            supplierId: body.supplierId ?? null,
            createdBy: userId,
          },
        });

        // One INPUT per receiving location so each movement names its location.
        let running = await getItemOnHand(tx, item.id);
        for (const [locationId, qty] of merged) {
          await addToLotLocation(tx, lot.id, locationId, qty);
          await recordTransaction(tx, {
            type: "INPUT",
            quantity: qty,
            previousStock: running,
            newStock: running + qty,
            reason: `Lot ${body.lotNumber} received`,
            lotId: lot.id,
            itemId: item.id,
            workspaceId: item.workspaceId,
            userId,
            toLocationId: locationId,
          });
          running += qty;
        }

        await recomputeItemCaches(tx, item.id);
        return lot.id;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new HttpError(409, "A lot with this number already exists for this item");
      }
      throw e;
    }

    return sendSuccess(res, { lot: await lotResponse(lotId) }, "Lot created successfully", 201);
  },

  // GET /api/lots/:id
  getLotById: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const lot = await prisma.lot.findUnique({
      where: { id: req.params.id },
      include: {
        ...lotInclude,
        item: true,
        transactions: {
          include: { user: creatorSelect },
          orderBy: { createdAt: "desc" },
          take: 500,
        },
      },
    });
    if (!lot) throw notFound("Lot not found");
    await requireMembership(userId, lot.workspaceId);

    return sendSuccess(res, { lot: withLocationCodes(lot) });
  },

  // PATCH /api/lots/:id/status  { status?, notes? }
  updateLotStatus: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(updateLotStatusSchema, req);
    const { lot } = await loadLotForUser(
      userId,
      req.params.id,
      PERMISSIONS.edit,
      "You don't have permission to update this lot"
    );

    await prisma.lot.update({
      where: { id: lot.id },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    return sendSuccess(res, { lot: await lotResponse(lot.id) }, "Lot updated successfully");
  },

  // POST /api/lots/:id/adjust  { type, quantity, locationId, reason? }
  adjustLotQuantity: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(adjustLotSchema, req);
    const { lot } = await loadLotForUser(userId, req.params.id, PERMISSIONS.stockOperation);
    await assertInWorkspace("location", body.locationId, lot.workspaceId);

    await withStockTransaction(async (tx) => {
      const item = await lockItem(tx, lot.itemId);
      // With lot tracking off, stock lives in the SYSTEM lot only; old lots are history.
      if (!item.lotTracking && lot.lotNumber !== SYSTEM_LOT_NUMBER) {
        throw badRequest("Lot tracking is disabled for this item; adjust the item's stock instead");
      }
      await applyAdjustment(tx, {
        type: body.type,
        itemId: lot.itemId,
        workspaceId: lot.workspaceId,
        lotId: lot.id,
        locationId: body.locationId,
        quantity: body.quantity,
        reason: body.reason || `Lot ${lot.lotNumber} adjustment`,
        userId,
      });
    });

    return sendSuccess(res, { lot: await lotResponse(lot.id) }, "Lot quantity adjusted successfully");
  },

  // PUT /api/lots/:id — lot details
  updateLot: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(updateLotSchema, req);
    const { lot } = await loadLotForUser(
      userId,
      req.params.id,
      PERMISSIONS.edit,
      "You don't have permission to update this lot"
    );

    if (body.lotNumber !== undefined && body.lotNumber !== lot.lotNumber) {
      if (lot.isSystem || isReservedLotNumber(lot.lotNumber)) {
        throw badRequest("Cannot change the lot number of system-managed lots");
      }
      if (isReservedLotNumber(body.lotNumber)) {
        throw badRequest("This lot number is reserved by the system");
      }
      const clash = await prisma.lot.findUnique({
        where: {
          workspaceId_itemId_lotNumber: {
            workspaceId: lot.workspaceId,
            itemId: lot.itemId,
            lotNumber: body.lotNumber,
          },
        },
        select: { id: true },
      });
      if (clash) throw badRequest("A lot with this number already exists for this item");
    }
    if (body.supplierId) await assertInWorkspace("supplier", body.supplierId, lot.workspaceId);

    await prisma.lot.update({
      where: { id: lot.id },
      data: {
        ...(body.lotNumber !== undefined && { lotNumber: body.lotNumber }),
        ...(body.status !== undefined && { status: body.status }),
        // Dates: undefined / null keep the current value (existing behaviour).
        ...(body.receivedDate && { receivedDate: body.receivedDate }),
        ...(body.manufactureDate && { manufactureDate: body.manufactureDate }),
        ...(body.expirationDate && { expirationDate: body.expirationDate }),
        ...(body.supplierId !== undefined && { supplierId: body.supplierId }),
        ...(body.poNumber !== undefined && { poNumber: body.poNumber }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });

    return sendSuccess(res, { lot: await lotResponse(lot.id) }, "Lot updated successfully");
  },
};

export default lotsController;
