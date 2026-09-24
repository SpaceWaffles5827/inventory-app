import { Request, Response } from "express";
import { Item, Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../utils/prisma";
import {
  PERMISSIONS,
  assertAllInWorkspace,
  assertInWorkspace,
  assertRefsInWorkspace,
  loadItemForUser,
  requireMembership,
  requireUserId,
} from "../utils/access";
import { HttpError, badRequest, notFound, sendSuccess } from "../utils/http";
import {
  paginationQuery,
  parseBody,
  parseQuery,
  zBooleanish,
  zId,
  zIdArray,
  zMoney,
  zNonNegativeInt,
  zOptionalId,
  zOptionalText,
  zPositiveInt,
  zText,
} from "../utils/validate";
import {
  EXISTING_STOCK_LOT_NUMBER,
  SYSTEM_LOT_NUMBER,
  Tx,
  addToLotLocation,
  applyAdjustment,
  applyTransfer,
  getItemOnHand,
  getItemStockByLocation,
  getOnHandByItem,
  getOrCreateSystemLot,
  isUniqueViolation,
  lockItem,
  recomputeItemCaches,
  recordTransaction,
  withStockTransaction,
} from "../utils/stock";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

const itemInclude = {
  category: true,
  supplier: true,
  customers: { include: { customer: true } },
  locations: { include: { location: true } },
} satisfies Prisma.ItemInclude;

const itemDetailInclude = {
  ...itemInclude,
  workspace: true,
  transactions: {
    orderBy: { createdAt: "desc" as const },
    take: 10,
    include: {
      user: { select: { id: true, name: true, email: true } },
      fromLocation: { select: { code: true } },
      toLocation: { select: { code: true } },
    },
  },
} satisfies Prisma.ItemInclude;

/** Item (list shape) + derived onHand, read after the write committed. */
async function itemResponse(id: string) {
  const item = await prisma.item.findUniqueOrThrow({ where: { id }, include: itemInclude });
  return { ...item, onHand: await getItemOnHand(prisma, id) };
}

const unique = <T>(xs: T[]) => Array.from(new Set(xs));

/** null / "" -> not provided, for optional numeric fields sent by HTML forms. */
const optionalNumber = <S extends z.ZodTypeAny>(schema: S) =>
  z.preprocess((v) => (v === null || v === "" ? undefined : v), schema.optional());

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const createItemSchema = z.object({
  workspaceId: zId,
  name: zText(191),
  barcode: zOptionalText(191),
  unit: zOptionalText(50),
  description: zOptionalText(10000),
  onHand: optionalNumber(zNonNegativeInt("Initial quantity")),
  cost: optionalNumber(zMoney("Cost")),
  reorderPoint: optionalNumber(zNonNegativeInt("Reorder point")),
  categoryId: zOptionalId,
  supplierId: zOptionalId,
  locationId: zOptionalId,
  locationIds: zIdArray.optional(),
  customerIds: zIdArray.optional(),
});

const locationSettingSchema = z.object({
  locationId: zId,
  minStock: optionalNumber(zNonNegativeInt("Min stock")),
  maxStock: optionalNumber(zNonNegativeInt("Max stock")),
  notes: zOptionalText(500),
});

const updateItemSchema = z.object({
  itemNumber: zText(50).optional(),
  name: zText(191).optional(),
  barcode: zOptionalText(191),
  unit: zOptionalText(50),
  description: zOptionalText(10000),
  cost: optionalNumber(zMoney("Cost")),
  reorderPoint: optionalNumber(zNonNegativeInt("Reorder point")),
  categoryId: zOptionalId,
  supplierId: zOptionalId,
  locationId: zOptionalId,
  locationIds: zIdArray.optional(),
  customerIds: zIdArray.optional(),
  lotTracking: zBooleanish.optional(),
  /** Optional per-location min/max stock levels. */
  locationSettings: z.array(locationSettingSchema).max(500).optional(),
});

const adjustStockSchema = z.object({
  quantity: zPositiveInt("Quantity"),
  type: z.enum(["INPUT", "OUTPUT"]),
  reason: zText(500),
  locationId: zId,
});

const transferStockSchema = z
  .object({
    quantity: zPositiveInt("Quantity"),
    fromLocationId: zId,
    toLocationId: zId,
    reason: zOptionalText(500),
    lotId: zOptionalId,
  })
  .refine((b) => b.fromLocationId !== b.toLocationId, {
    message: "Cannot transfer to the same location",
    path: ["toLocationId"],
  });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Highest ITM-<n> in the workspace + 1. Two concurrent creates can compute the
 * same number; the unique (workspaceId, itemNumber) index rejects the loser
 * only after the winner committed, so re-reading the max on retry always
 * moves forward (and leaves no gaps).
 */
async function nextItemNumber(workspaceId: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ maxNum: bigint | number | null }[]>`
    SELECT MAX(CAST(SUBSTRING(itemNumber, 5) AS UNSIGNED)) AS maxNum
    FROM items
    WHERE workspaceId = ${workspaceId} AND itemNumber REGEXP '^ITM-[0-9]+$'`;
  const next = Number(rows[0]?.maxNum ?? 0) + 1;
  return `ITM-${String(next).padStart(3, "0")}`;
}

const jitter = () => new Promise((r) => setTimeout(r, 5 + Math.floor(Math.random() * 25)));

const isItemNumberCollision = (e: unknown) =>
  isUniqueViolation(e) &&
  String((e as Prisma.PrismaClientKnownRequestError).meta?.target ?? "").includes("itemNumber");

const lotKey = (workspaceId: string, itemId: string, lotNumber: string) => ({
  workspaceId_itemId_lotNumber: { workspaceId, itemId, lotNumber },
});

const appendNote = (notes: string | null, line: string) =>
  notes ? `${notes}\n${line}` : line;

/**
 * Turning lot tracking ON: the untracked stock (SYSTEM lot) becomes a visible
 * EXISTING-STOCK lot. LotLocation rows — the source of truth — are kept as-is.
 */
async function enableLotTracking(tx: Tx, item: Item) {
  const system = await tx.lot.findUnique({
    where: lotKey(item.workspaceId, item.id, SYSTEM_LOT_NUMBER),
    include: { locations: true },
  });
  if (!system) return; // nothing untracked to convert
  const qty = system.locations.reduce((s, l) => s + l.quantity, 0);

  const existing = await tx.lot.findUnique({
    where: lotKey(item.workspaceId, item.id, EXISTING_STOCK_LOT_NUMBER),
  });
  if (!existing) {
    await tx.lot.update({
      where: { id: system.id },
      data: {
        lotNumber: EXISTING_STOCK_LOT_NUMBER,
        isSystem: true,
        initialQuantity: Math.max(system.initialQuantity, qty),
        notes: "Pre-existing inventory before lot tracking was enabled",
      },
    });
    return;
  }

  // An EXISTING-STOCK lot is already there (e.g. toggled before): merge into it.
  for (const ll of system.locations) {
    if (ll.quantity > 0) await addToLotLocation(tx, existing.id, ll.locationId, ll.quantity);
  }
  await tx.stockTransaction.updateMany({ where: { lotId: system.id }, data: { lotId: existing.id } });
  await tx.lot.delete({ where: { id: system.id } });
}

/**
 * Turning lot tracking OFF: all stock is consolidated into the SYSTEM lot at
 * the same locations. Other lots are KEPT (emptied, with a note) so their
 * transaction history survives.
 */
async function disableLotTracking(tx: Tx, item: Item, userId: string) {
  const lots = await tx.lot.findMany({
    where: { itemId: item.id },
    include: { locations: true },
  });

  let target = lots.find((l) => l.lotNumber === SYSTEM_LOT_NUMBER);
  if (!target) {
    const existing = lots.find((l) => l.lotNumber === EXISTING_STOCK_LOT_NUMBER);
    if (existing) {
      await tx.lot.update({
        where: { id: existing.id },
        data: { lotNumber: SYSTEM_LOT_NUMBER, isSystem: true, notes: null },
      });
      target = existing;
    }
  }
  const targetId = target
    ? target.id
    : (await getOrCreateSystemLot(tx, item.id, item.workspaceId, userId)).id;

  const today = new Date().toISOString().slice(0, 10);
  for (const lot of lots) {
    if (lot.id === targetId) continue;
    let moved = 0;
    for (const ll of lot.locations) {
      if (ll.quantity <= 0) continue;
      await addToLotLocation(tx, targetId, ll.locationId, ll.quantity);
      await tx.lotLocation.update({ where: { id: ll.id }, data: { quantity: 0 } });
      moved += ll.quantity;
    }
    if (moved > 0) {
      await tx.lot.update({
        where: { id: lot.id },
        data: {
          notes: appendNote(
            lot.notes,
            `${today}: ${moved} unit(s) consolidated into untracked stock when lot tracking was disabled`
          ),
        },
      });
    }
  }
}

/**
 * Make the item's assigned locations exactly `desired`. A location that still
 * holds stock of this item can't be removed (400) — nothing is orphaned.
 */
async function setItemLocations(tx: Tx, itemId: string, desired: string[]) {
  const current = await tx.itemLocation.findMany({
    where: { itemId },
    include: { location: { select: { code: true } } },
  });
  const stock = await getItemStockByLocation(tx, itemId);
  const desiredSet = new Set(desired);

  const removing = current.filter((c) => !desiredSet.has(c.locationId));
  const blocked = removing.filter((c) => (stock.get(c.locationId) ?? 0) > 0);
  if (blocked.length > 0) {
    const detail = blocked
      .map((b) => `${b.location.code} (${stock.get(b.locationId)} units)`)
      .join(", ");
    throw new HttpError(
      400,
      `Cannot remove location${blocked.length > 1 ? "s" : ""} ${detail}: stock is still stored there. Transfer or remove that stock first.`,
      {
        data: {
          blockedLocations: blocked.map((b) => ({
            locationId: b.locationId,
            code: b.location.code,
            quantity: stock.get(b.locationId) ?? 0,
          })),
        },
      }
    );
  }

  if (removing.length > 0) {
    const ids = removing.map((r) => r.locationId);
    await tx.itemLocation.deleteMany({ where: { itemId, locationId: { in: ids } } });
    await tx.lotLocation.deleteMany({
      where: { locationId: { in: ids }, quantity: 0, lot: { itemId } },
    });
  }

  const currentSet = new Set(current.map((c) => c.locationId));
  for (const locationId of desired) {
    if (!currentSet.has(locationId)) {
      await tx.itemLocation.create({
        data: { itemId, locationId, quantity: stock.get(locationId) ?? 0 },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

const itemsController = {
  // POST /api/items
  createItem: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(createItemSchema, req);
    const workspaceId = body.workspaceId;
    await requireMembership(userId, workspaceId, PERMISSIONS.edit);

    const locationIds = unique(
      body.locationIds && body.locationIds.length > 0
        ? body.locationIds
        : body.locationId
          ? [body.locationId]
          : []
    );
    const customerIds = unique(body.customerIds ?? []);
    await assertRefsInWorkspace(workspaceId, {
      categoryId: body.categoryId,
      supplierId: body.supplierId,
      locationIds,
      customerIds,
    });

    const initialQuantity = body.onHand ?? 0;
    if (initialQuantity > 0 && locationIds.length === 0) {
      throw badRequest("A storage location is required to record initial stock");
    }

    let itemId: string | null = null;
    for (let attempt = 0; attempt < 10 && !itemId; attempt++) {
      if (attempt > 0) await jitter();
      const itemNumber = await nextItemNumber(workspaceId);
      try {
        itemId = await withStockTransaction(async (tx) => {
          const item = await tx.item.create({
            data: {
              itemNumber,
              name: body.name,
              barcode: body.barcode ?? null,
              unit: body.unit ?? null,
              description: body.description ?? null,
              cost: body.cost ?? 0,
              reorderPoint: body.reorderPoint ?? 10,
              categoryId: body.categoryId ?? null,
              supplierId: body.supplierId ?? null,
              workspaceId,
              status: "OUT_OF_STOCK",
              lotTracking: false,
              customers: {
                create: customerIds.map((customerId) => ({ customerId, quantity: 0 })),
              },
              locations: {
                create: locationIds.map((locationId) => ({ locationId, quantity: 0 })),
              },
            },
          });

          const systemLot = await getOrCreateSystemLot(tx, item.id, workspaceId, userId);

          if (initialQuantity > 0) {
            // Split evenly; the first location takes the remainder.
            const per = Math.floor(initialQuantity / locationIds.length);
            let running = 0;
            for (let i = 0; i < locationIds.length; i++) {
              const qty =
                i === 0 ? initialQuantity - per * (locationIds.length - 1) : per;
              if (qty <= 0) continue;
              await addToLotLocation(tx, systemLot.id, locationIds[i], qty);
              await recordTransaction(tx, {
                type: "INPUT",
                quantity: qty,
                previousStock: running,
                newStock: running + qty,
                reason: "Initial stock",
                lotId: systemLot.id,
                itemId: item.id,
                workspaceId,
                userId,
                toLocationId: locationIds[i],
              });
              running += qty;
            }
            await tx.lot.update({
              where: { id: systemLot.id },
              data: { initialQuantity },
            });
          }

          await recomputeItemCaches(tx, item.id);
          return item.id;
        });
      } catch (e) {
        if (isItemNumberCollision(e)) continue; // someone took this number; try the next
        throw e;
      }
    }
    if (!itemId) {
      throw new HttpError(409, "Could not allocate an item number. Please try again.");
    }

    return sendSuccess(res, { item: await itemResponse(itemId) }, "Item created successfully", 201);
  },

  // GET /api/items?workspaceId=&limit=&cursor=
  getItems: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const q = parseQuery(paginationQuery(1000, 1000).extend({ workspaceId: zId }), req);
    await requireMembership(userId, q.workspaceId);

    const rows = await prisma.item.findMany({
      where: { workspaceId: q.workspaceId },
      include: itemInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;

    // One aggregate query for every item on the page (no N+1).
    const onHand = await getOnHandByItem(
      prisma,
      q.workspaceId,
      page.map((i) => i.id)
    );
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return sendSuccess(res, {
      items: page.map((item) => ({ ...item, onHand: onHand.get(item.id) ?? 0 })),
      nextCursor,
      pageInfo: { limit: q.limit, hasMore, nextCursor },
    });
  },

  // GET /api/items/:id
  getItemById: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: itemDetailInclude,
    });
    if (!item) throw notFound("Item not found");
    await requireMembership(userId, item.workspaceId);

    return sendSuccess(res, {
      item: { ...item, onHand: await getItemOnHand(prisma, item.id) },
    });
  },

  // PATCH /api/items/:id
  updateItem: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const id = req.params.id;
    const body = parseBody(updateItemSchema, req);

    const item = await prisma.item.findUnique({ where: { id } });
    if (!item) throw notFound("Item not found");

    const togglesLotTracking =
      body.lotTracking !== undefined && body.lotTracking !== item.lotTracking;
    await requireMembership(
      userId,
      item.workspaceId,
      togglesLotTracking ? PERMISSIONS.toggleLotTracking : PERMISSIONS.edit,
      togglesLotTracking
        ? { message: "Only admins and owners can turn lot tracking on or off" }
        : {}
    );

    if (body.itemNumber && body.itemNumber !== item.itemNumber) {
      const clash = await prisma.item.findFirst({
        where: { workspaceId: item.workspaceId, itemNumber: body.itemNumber, id: { not: id } },
        select: { id: true },
      });
      if (clash) {
        throw badRequest("An item with this item number already exists in your workspace");
      }
    }

    // `locationIds` (even []) sets the exact list; a lone `locationId` replaces it.
    const desiredLocations =
      body.locationIds !== undefined
        ? unique(body.locationIds)
        : body.locationId
          ? [body.locationId]
          : undefined;
    const customerIds = body.customerIds !== undefined ? unique(body.customerIds) : undefined;

    await assertRefsInWorkspace(item.workspaceId, {
      categoryId: body.categoryId,
      supplierId: body.supplierId,
      locationIds: desiredLocations,
      customerIds,
    });
    if (body.locationSettings?.length) {
      await assertAllInWorkspace(
        "location",
        body.locationSettings.map((s) => s.locationId),
        item.workspaceId
      );
    }

    await withStockTransaction(async (tx) => {
      const locked = await lockItem(tx, id);

      if (body.lotTracking !== undefined && body.lotTracking !== locked.lotTracking) {
        if (body.lotTracking) await enableLotTracking(tx, locked);
        else await disableLotTracking(tx, locked, userId);
      }

      await tx.item.update({
        where: { id },
        data: {
          ...(body.itemNumber !== undefined && { itemNumber: body.itemNumber }),
          ...(body.name !== undefined && { name: body.name }),
          ...(body.barcode !== undefined && { barcode: body.barcode }),
          ...(body.unit !== undefined && { unit: body.unit }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.cost !== undefined && { cost: body.cost }),
          ...(body.reorderPoint !== undefined && { reorderPoint: body.reorderPoint }),
          ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
          ...(body.supplierId !== undefined && { supplierId: body.supplierId }),
          ...(body.lotTracking !== undefined && { lotTracking: body.lotTracking }),
          ...(customerIds !== undefined && {
            customers: {
              deleteMany: {},
              create: customerIds.map((customerId) => ({ customerId, quantity: 0 })),
            },
          }),
        },
      });

      if (desiredLocations !== undefined) await setItemLocations(tx, id, desiredLocations);

      for (const s of body.locationSettings ?? []) {
        const data = {
          ...(s.minStock !== undefined && { minStock: s.minStock }),
          ...(s.maxStock !== undefined && { maxStock: s.maxStock }),
          ...(s.notes !== undefined && { notes: s.notes }),
        };
        await tx.itemLocation.upsert({
          where: { itemId_locationId: { itemId: id, locationId: s.locationId } },
          update: data,
          create: { itemId: id, locationId: s.locationId, quantity: 0, ...data },
        });
      }

      const lotTracking = body.lotTracking ?? locked.lotTracking;
      if (!lotTracking) await getOrCreateSystemLot(tx, id, locked.workspaceId, userId);

      await recomputeItemCaches(tx, id);
    });

    return sendSuccess(res, { item: await itemResponse(id) }, "Item updated successfully");
  },

  // DELETE /api/items/:id (ADMIN+). Cascades lots, stock and history of the item.
  deleteItem: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { item } = await loadItemForUser(
      userId,
      req.params.id,
      PERMISSIONS.delete,
      "You don't have permission to delete this item"
    );
    await prisma.item.delete({ where: { id: item.id } });
    return sendSuccess(res, {}, "Item deleted successfully");
  },

  // POST /api/items/:id/adjust-stock  { type, quantity, reason, locationId }
  adjustStock: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(adjustStockSchema, req);
    const { item } = await loadItemForUser(userId, req.params.id, PERMISSIONS.stockOperation);

    const lotTrackedMessage =
      "This item uses lot tracking. Please use the lot adjustment endpoint to modify stock for specific lots.";
    if (item.lotTracking) throw badRequest(lotTrackedMessage);
    await assertInWorkspace("location", body.locationId, item.workspaceId);

    await withStockTransaction(async (tx) => {
      const locked = await lockItem(tx, item.id);
      if (locked.lotTracking) throw badRequest(lotTrackedMessage);
      const systemLot = await getOrCreateSystemLot(tx, item.id, item.workspaceId, userId);
      await applyAdjustment(tx, {
        type: body.type,
        itemId: item.id,
        workspaceId: item.workspaceId,
        lotId: systemLot.id,
        locationId: body.locationId,
        quantity: body.quantity,
        reason: body.reason,
        userId,
      });
    });

    return sendSuccess(res, { item: await itemResponse(item.id) }, "Stock adjusted successfully");
  },

  // POST /api/items/:id/transfer-stock  { quantity, fromLocationId, toLocationId, lotId?, reason? }
  transferStock: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const body = parseBody(transferStockSchema, req);
    const { item } = await loadItemForUser(userId, req.params.id, PERMISSIONS.stockOperation);

    const locations = await prisma.location.findMany({
      where: {
        id: { in: [body.fromLocationId, body.toLocationId] },
        workspaceId: item.workspaceId,
      },
      select: { id: true, code: true },
    });
    const code = (id: string) => locations.find((l) => l.id === id)?.code;
    if (!code(body.fromLocationId) || !code(body.toLocationId)) {
      throw notFound("One or both locations not found");
    }

    await withStockTransaction(async (tx) => {
      const locked = await lockItem(tx, item.id);

      let lotId: string;
      if (body.lotId) {
        const lot = await tx.lot.findFirst({
          where: { id: body.lotId, itemId: item.id, workspaceId: item.workspaceId },
          select: { id: true },
        });
        if (!lot) throw notFound("Lot not found for this item");
        lotId = lot.id;
      } else if (locked.lotTracking) {
        throw badRequest("This item uses lot tracking. Choose which lot to transfer (lotId).");
      } else {
        lotId = (await getOrCreateSystemLot(tx, item.id, item.workspaceId, userId)).id;
      }

      await applyTransfer(tx, {
        itemId: item.id,
        workspaceId: item.workspaceId,
        lotId,
        fromLocationId: body.fromLocationId,
        toLocationId: body.toLocationId,
        quantity: body.quantity,
        reason:
          body.reason || `Transfer: ${code(body.fromLocationId)} → ${code(body.toLocationId)}`,
        userId,
      });
    });

    return sendSuccess(res, { item: await itemResponse(item.id) }, "Stock transferred successfully");
  },
};

export default itemsController;
