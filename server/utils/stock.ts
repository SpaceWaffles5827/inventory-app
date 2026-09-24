// Stock engine.
//
// SOURCE OF TRUTH: LotLocation.quantity (units of one lot at one location).
// CACHES (recomputed from LotLocation inside the same DB transaction by
// recomputeItemCaches): Lot.quantity, ItemLocation.quantity, Item.status.
//
// Every stock mutation runs through withStockTransaction():
//   1. READ COMMITTED isolation (each statement sees the latest committed data)
//   2. lockItem() takes a row lock on the item (SELECT ... FOR UPDATE) so all
//      stock mutations of one item are serialised, which also makes the cache
//      recomputation race-free
//   3. decrements are conditional (`quantity >= n`) so stock can never go
//      negative even if a code path forgets the lock -> 409 "Insufficient stock"
//   4. deadlocks / write conflicts (P2034) are retried a few times
//
// StockTransaction.previousStock / newStock are always the ITEM's total on-hand
// before / after the movement. OUTPUT records fromLocationId, INPUT records
// toLocationId, TRANSFER records both.
import { ItemStatus, LotStatus, Prisma, TransactionType } from "@prisma/client";
import prisma from "./prisma";
import { HttpError, notFound } from "./http";

export type Tx = Prisma.TransactionClient;

export const SYSTEM_LOT_NUMBER = "SYSTEM";
export const EXISTING_STOCK_LOT_NUMBER = "EXISTING-STOCK";
export const RESERVED_LOT_NUMBERS = [SYSTEM_LOT_NUMBER, EXISTING_STOCK_LOT_NUMBER];

export const isReservedLotNumber = (lotNumber: string) =>
  RESERVED_LOT_NUMBERS.includes(lotNumber.trim().toUpperCase());

// ---------------------------------------------------------------------------
// Status rules
// ---------------------------------------------------------------------------

/** OUT_OF_STOCK when onHand <= 0, LOW_STOCK when onHand <= reorderPoint, else IN_STOCK. */
export function determineStatus(onHand: number, reorderPoint: number): ItemStatus {
  if (onHand <= 0) return "OUT_OF_STOCK";
  if (onHand <= reorderPoint) return "LOW_STOCK";
  return "IN_STOCK";
}

/** Manual statuses (QUARANTINED / RECALLED / EXPIRED) stick; otherwise follow quantity. */
export function nextLotStatus(current: LotStatus, quantity: number): LotStatus {
  if (current === "QUARANTINED" || current === "RECALLED" || current === "EXPIRED") {
    return current;
  }
  if (quantity <= 0) return "DEPLETED";
  if (current === "DEPLETED") return "ACTIVE";
  return current;
}

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

export const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

function isRetryableTxError(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P2034" || /deadlock|lock wait timeout/i.test(e.message);
  }
  if (e instanceof Prisma.PrismaClientUnknownRequestError) {
    return /deadlock|1213|lock wait timeout|1205/i.test(e.message);
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Transactions + locking
// ---------------------------------------------------------------------------

export async function withStockTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  attempts = 4
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (e) {
      if (attempt < attempts && isRetryableTxError(e)) {
        await sleep(25 * attempt + Math.floor(Math.random() * 50));
        continue;
      }
      throw e;
    }
  }
}

/**
 * Row-lock the item for the rest of the transaction and return its fresh row.
 * Every stock mutation of an item must call this first.
 */
export async function lockItem(tx: Tx, itemId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM items WHERE id = ${itemId} FOR UPDATE`;
  if (rows.length === 0) throw notFound("Item not found");
  return tx.item.findUniqueOrThrow({ where: { id: itemId } });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Item total on-hand straight from LotLocation. */
export async function getItemOnHand(db: Tx | typeof prisma, itemId: string): Promise<number> {
  const agg = await db.lotLocation.aggregate({
    where: { lot: { itemId } },
    _sum: { quantity: true },
  });
  return agg._sum.quantity ?? 0;
}

/**
 * On-hand for many items in ONE query (sum of LotLocation per item).
 * Items without any stock are absent from the map (treat as 0).
 */
export async function getOnHandByItem(
  db: Tx | typeof prisma,
  workspaceId: string,
  itemIds?: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (itemIds && itemIds.length === 0) return map;
  const itemFilter = itemIds
    ? Prisma.sql`AND l.itemId IN (${Prisma.join(itemIds)})`
    : Prisma.empty;
  const rows = await db.$queryRaw<{ itemId: string; onHand: bigint | number | null }[]>`
    SELECT l.itemId AS itemId, CAST(COALESCE(SUM(ll.quantity), 0) AS SIGNED) AS onHand
    FROM lot_locations ll
    JOIN lots l ON l.id = ll.lotId
    WHERE l.workspaceId = ${workspaceId} ${itemFilter}
    GROUP BY l.itemId`;
  for (const r of rows) map.set(r.itemId, Number(r.onHand ?? 0));
  return map;
}

/** Units of an item per location (LotLocation sums). */
export async function getItemStockByLocation(tx: Tx, itemId: string): Promise<Map<string, number>> {
  const rows = await tx.lotLocation.findMany({
    where: { lot: { itemId } },
    select: { locationId: true, quantity: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.locationId, (map.get(r.locationId) ?? 0) + r.quantity);
  return map;
}

// ---------------------------------------------------------------------------
// Cache recomputation (the ONLY place caches are written)
// ---------------------------------------------------------------------------

/**
 * Recompute Lot.quantity (+ lot status), ItemLocation.quantity and Item.status
 * for one item from LotLocation. Must run inside the stock transaction, after
 * lockItem().
 */
export async function recomputeItemCaches(
  tx: Tx,
  itemId: string
): Promise<{ onHand: number; status: ItemStatus }> {
  const item = await tx.item.findUniqueOrThrow({
    where: { id: itemId },
    select: { id: true, reorderPoint: true, status: true },
  });

  const lots = await tx.lot.findMany({
    where: { itemId },
    select: {
      id: true,
      quantity: true,
      status: true,
      locations: { select: { locationId: true, quantity: true } },
    },
  });

  const perLocation = new Map<string, number>();
  let onHand = 0;
  for (const lot of lots) {
    let lotQty = 0;
    for (const ll of lot.locations) {
      lotQty += ll.quantity;
      perLocation.set(ll.locationId, (perLocation.get(ll.locationId) ?? 0) + ll.quantity);
    }
    onHand += lotQty;
    const status = nextLotStatus(lot.status, lotQty);
    if (lotQty !== lot.quantity || status !== lot.status) {
      await tx.lot.update({ where: { id: lot.id }, data: { quantity: lotQty, status } });
    }
  }

  const itemLocations = await tx.itemLocation.findMany({
    where: { itemId },
    select: { id: true, locationId: true, quantity: true },
  });
  const byLocation = new Map(itemLocations.map((il) => [il.locationId, il]));

  for (const [locationId, qty] of perLocation) {
    const row = byLocation.get(locationId);
    if (!row) {
      // Stock exists somewhere the item isn't assigned yet -> assign it.
      if (qty > 0) await tx.itemLocation.create({ data: { itemId, locationId, quantity: qty } });
    } else if (row.quantity !== qty) {
      await tx.itemLocation.update({ where: { id: row.id }, data: { quantity: qty } });
    }
  }
  for (const row of itemLocations) {
    if (!perLocation.has(row.locationId) && row.quantity !== 0) {
      await tx.itemLocation.update({ where: { id: row.id }, data: { quantity: 0 } });
    }
  }

  const status = determineStatus(onHand, item.reorderPoint);
  if (status !== item.status) {
    await tx.item.update({ where: { id: itemId }, data: { status } });
  }
  return { onHand, status };
}

// ---------------------------------------------------------------------------
// Mutations on the source of truth
// ---------------------------------------------------------------------------

/** Atomic conditional decrement: 409 if fewer than `qty` units are there. */
export async function removeFromLotLocation(
  tx: Tx,
  lotId: string,
  locationId: string,
  qty: number
): Promise<void> {
  const res = await tx.lotLocation.updateMany({
    where: { lotId, locationId, quantity: { gte: qty } },
    data: { quantity: { decrement: qty } },
  });
  if (res.count === 0) {
    const row = await tx.lotLocation.findUnique({
      where: { lotId_locationId: { lotId, locationId } },
      select: { quantity: true },
    });
    const available = row?.quantity ?? 0;
    throw new HttpError(
      409,
      `Insufficient stock: tried to remove ${qty} but only ${available} available at this location`,
      { data: { available, requested: qty } }
    );
  }
}

/** Atomic increment, creating the LotLocation row if needed. */
export async function addToLotLocation(
  tx: Tx,
  lotId: string,
  locationId: string,
  qty: number
): Promise<void> {
  const res = await tx.lotLocation.updateMany({
    where: { lotId, locationId },
    data: { quantity: { increment: qty } },
  });
  if (res.count > 0) return;
  try {
    await tx.lotLocation.create({ data: { lotId, locationId, quantity: qty } });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    await tx.lotLocation.updateMany({
      where: { lotId, locationId },
      data: { quantity: { increment: qty } },
    });
  }
}

/** SYSTEM lot of a non-lot-tracked item (find-or-create, race safe). */
export async function getOrCreateSystemLot(
  tx: Tx,
  itemId: string,
  workspaceId: string,
  userId: string | null
) {
  const where = {
    workspaceId_itemId_lotNumber: { workspaceId, itemId, lotNumber: SYSTEM_LOT_NUMBER },
  };
  const existing = await tx.lot.findUnique({ where });
  if (existing) return existing;
  try {
    return await tx.lot.create({
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
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    return tx.lot.findUniqueOrThrow({ where });
  }
}

export async function recordTransaction(
  tx: Tx,
  data: {
    type: TransactionType;
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string;
    lotId: string;
    itemId: string;
    workspaceId: string;
    userId: string | null;
    fromLocationId?: string | null;
    toLocationId?: string | null;
  }
) {
  return tx.stockTransaction.create({
    data: {
      ...data,
      fromLocationId: data.fromLocationId ?? null,
      toLocationId: data.toLocationId ?? null,
    },
  });
}

/**
 * One adjustment (INPUT or OUTPUT) of `lotId` at `locationId`, including the
 * cache refresh and the audit row. Caller holds the item lock.
 */
export async function applyAdjustment(
  tx: Tx,
  args: {
    type: "INPUT" | "OUTPUT";
    itemId: string;
    workspaceId: string;
    lotId: string;
    locationId: string;
    quantity: number;
    reason: string;
    userId: string | null;
  }
) {
  const previousStock = await getItemOnHand(tx, args.itemId);
  if (args.type === "INPUT") {
    await addToLotLocation(tx, args.lotId, args.locationId, args.quantity);
  } else {
    await removeFromLotLocation(tx, args.lotId, args.locationId, args.quantity);
  }
  const { onHand } = await recomputeItemCaches(tx, args.itemId);
  const transaction = await recordTransaction(tx, {
    type: args.type,
    quantity: args.quantity,
    previousStock,
    newStock: onHand,
    reason: args.reason,
    lotId: args.lotId,
    itemId: args.itemId,
    workspaceId: args.workspaceId,
    userId: args.userId,
    fromLocationId: args.type === "OUTPUT" ? args.locationId : null,
    toLocationId: args.type === "INPUT" ? args.locationId : null,
  });
  return { previousStock, onHand, transaction };
}

/** Move units of one lot between two locations of the same item. Caller holds the item lock. */
export async function applyTransfer(
  tx: Tx,
  args: {
    itemId: string;
    workspaceId: string;
    lotId: string;
    fromLocationId: string;
    toLocationId: string;
    quantity: number;
    reason: string;
    userId: string | null;
  }
) {
  const previousStock = await getItemOnHand(tx, args.itemId);
  await removeFromLotLocation(tx, args.lotId, args.fromLocationId, args.quantity);
  await addToLotLocation(tx, args.lotId, args.toLocationId, args.quantity);
  const { onHand } = await recomputeItemCaches(tx, args.itemId);
  const transaction = await recordTransaction(tx, {
    type: "TRANSFER",
    quantity: args.quantity,
    previousStock,
    newStock: onHand,
    reason: args.reason,
    lotId: args.lotId,
    itemId: args.itemId,
    workspaceId: args.workspaceId,
    userId: args.userId,
    fromLocationId: args.fromLocationId,
    toLocationId: args.toLocationId,
  });
  return { previousStock, onHand, transaction };
}
