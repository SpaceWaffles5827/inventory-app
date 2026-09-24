// Analytics rebuilt from StockTransaction history.
//
// Historical stock levels are reconstructed backwards from today's on-hand
// (LotLocation): onHand(T) = onHand(now) - net movement after T, where
// INPUT = +qty, OUTPUT = -qty, TRANSFER = 0. Status counts and inventory value
// per period use each item's CURRENT reorderPoint and cost (history of those
// isn't stored). All buckets are UTC.
import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../utils/prisma";
import { requireMembership, requireUserId } from "../utils/access";
import { sendSuccess } from "../utils/http";
import { parseQuery, zId } from "../utils/validate";
import { determineStatus, getOnHandByItem } from "../utils/stock";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RANGES: Record<string, { unit: "day" | "month"; count: number }> = {
  "7days": { unit: "day", count: 7 },
  "30days": { unit: "day", count: 30 },
  "3months": { unit: "month", count: 3 },
  "6months": { unit: "month", count: 6 },
  "1year": { unit: "month", count: 12 },
};

const querySchema = z.object({
  workspaceId: zId,
  timeRange: z.preprocess((v) => (v === "" ? undefined : v), z.string().max(20).optional()),
  months: z.preprocess(
    (v) => (v === undefined || v === "" ? undefined : Number(v)),
    z.number().int().min(1).max(36).optional()
  ),
  top: z.preprocess(
    (v) => (v === undefined || v === "" ? undefined : Number(v)),
    z.number().int().min(1).max(50).default(5)
  ),
});

type Bucket = { key: string; label: string; short: string; start: Date; end: Date };

const pad = (n: number) => String(n).padStart(2, "0");

function buildBuckets(unit: "day" | "month", count: number, now: Date): Bucket[] {
  const buckets: Bucket[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  for (let i = count - 1; i >= 0; i--) {
    if (unit === "month") {
      const start = new Date(Date.UTC(y, m - i, 1));
      const end = i === 0 ? now : new Date(Date.UTC(y, m - i + 1, 1));
      buckets.push({
        key: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`,
        short: MONTHS[start.getUTCMonth()],
        label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
        start,
        end,
      });
    } else {
      const start = new Date(Date.UTC(y, m, d - i));
      const end = i === 0 ? now : new Date(Date.UTC(y, m, d - i + 1));
      const label = `${MONTHS[start.getUTCMonth()]} ${start.getUTCDate()}`;
      buckets.push({
        key: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
        short: label,
        label,
        start,
        end,
      });
    }
  }
  return buckets;
}

type Movement = { unitsIn: number; unitsOut: number; transferred: number; count: number };
const emptyMovement = (): Movement => ({ unitsIn: 0, unitsOut: 0, transferred: 0, count: 0 });

function addMovement(m: Movement, type: string, qty: number, count: number) {
  if (type === "INPUT") m.unitsIn += qty;
  else if (type === "OUTPUT") m.unitsOut += qty;
  else m.transferred += qty;
  m.count += count;
}

const unitsMoved = (m: Movement) => m.unitsIn + m.unitsOut + m.transferred;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

const analyticsController = {
  /**
   * GET /api/analytics?workspaceId=&timeRange=7days|30days|3months|6months|1year&months=&top=
   */
  getAnalytics: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const q = parseQuery(querySchema, req);
    await requireMembership(userId, q.workspaceId);
    const workspaceId = q.workspaceId;

    const range = q.months
      ? { unit: "month" as const, count: q.months }
      : RANGES[q.timeRange ?? "6months"] ?? RANGES["6months"];
    const now = new Date();
    const buckets = buildBuckets(range.unit, range.count, now);
    const periodStart = buckets[0].start;
    const periodMs = now.getTime() - periodStart.getTime();
    const previousStart = new Date(periodStart.getTime() - periodMs);

    const bucketFormat = range.unit === "month" ? "%Y-%m" : "%Y-%m-%d";

    const [items, onHandMap, currentRows, previousRows] = await Promise.all([
      prisma.item.findMany({
        where: { workspaceId },
        select: {
          id: true,
          name: true,
          itemNumber: true,
          cost: true,
          reorderPoint: true,
          createdAt: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      }),
      getOnHandByItem(prisma, workspaceId),
      prisma.$queryRaw<{ itemId: string; type: string; bucket: string; qty: bigint | number; cnt: bigint | number }[]>`
        SELECT itemId, type, DATE_FORMAT(createdAt, ${bucketFormat}) AS bucket,
               CAST(SUM(quantity) AS SIGNED) AS qty, COUNT(*) AS cnt
        FROM stock_transactions
        WHERE workspaceId = ${workspaceId} AND createdAt >= ${periodStart} AND createdAt <= ${now}
        GROUP BY itemId, type, bucket`,
      prisma.$queryRaw<{ itemId: string; type: string; qty: bigint | number; cnt: bigint | number }[]>`
        SELECT itemId, type, CAST(SUM(quantity) AS SIGNED) AS qty, COUNT(*) AS cnt
        FROM stock_transactions
        WHERE workspaceId = ${workspaceId} AND createdAt >= ${previousStart} AND createdAt < ${periodStart}
        GROUP BY itemId, type`,
    ]);

    const bucketIndex = new Map(buckets.map((b, i) => [b.key, i]));

    // Per bucket totals, per item net change per bucket, per item period movement.
    const bucketMovement = buckets.map(emptyMovement);
    const itemNetByBucket = new Map<string, number[]>();
    const itemMovement = new Map<string, Movement>();
    const itemPrevMovement = new Map<string, Movement>();

    for (const r of currentRows) {
      const i = bucketIndex.get(r.bucket);
      if (i === undefined) continue;
      const qty = Number(r.qty);
      const cnt = Number(r.cnt);
      addMovement(bucketMovement[i], r.type, qty, cnt);

      const im = itemMovement.get(r.itemId) ?? emptyMovement();
      addMovement(im, r.type, qty, cnt);
      itemMovement.set(r.itemId, im);

      const delta = r.type === "INPUT" ? qty : r.type === "OUTPUT" ? -qty : 0;
      if (delta !== 0) {
        const arr = itemNetByBucket.get(r.itemId) ?? new Array(buckets.length).fill(0);
        arr[i] += delta;
        itemNetByBucket.set(r.itemId, arr);
      }
    }
    for (const r of previousRows) {
      const pm = itemPrevMovement.get(r.itemId) ?? emptyMovement();
      addMovement(pm, r.type, Number(r.qty), Number(r.cnt));
      itemPrevMovement.set(r.itemId, pm);
    }

    // Reconstruct each bucket's closing stock: walk backwards from today.
    const trend = buckets.map((b) => ({
      bucket: b,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
      value: 0,
      units: 0,
    }));
    for (const item of items) {
      const net = itemNetByBucket.get(item.id);
      let level = onHandMap.get(item.id) ?? 0; // closing level of the last bucket
      for (let i = buckets.length - 1; i >= 0; i--) {
        if (i < buckets.length - 1 && net) level -= net[i + 1];
        if (item.createdAt > buckets[i].end) continue; // item didn't exist yet
        const qty = Math.max(0, level);
        const t = trend[i];
        const status = determineStatus(qty, item.reorderPoint);
        if (status === "IN_STOCK") t.inStock++;
        else if (status === "LOW_STOCK") t.lowStock++;
        else t.outOfStock++;
        t.units += qty;
        t.value += qty * item.cost;
      }
    }

    const stockTrendData = trend.map((t, i) => ({
      month: t.bucket.short,
      label: t.bucket.label,
      periodStart: t.bucket.start.toISOString(),
      periodEnd: t.bucket.end.toISOString(),
      inStock: t.inStock,
      lowStock: t.lowStock,
      outOfStock: t.outOfStock,
      value: round2(t.value),
      units: t.units,
      stockIn: bucketMovement[i].unitsIn,
      stockOut: bucketMovement[i].unitsOut,
      net: bucketMovement[i].unitsIn - bucketMovement[i].unitsOut,
      transfers: bucketMovement[i].transferred,
    }));

    // Current snapshot
    let totalStockValue = 0;
    let totalUnits = 0;
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const categories = new Map<
      string,
      { categoryId: string | null; name: string; itemCount: number; units: number; inventoryValue: number }
    >();
    for (const item of items) {
      const onHand = onHandMap.get(item.id) ?? 0;
      totalUnits += onHand;
      totalStockValue += onHand * item.cost;
      const status = determineStatus(onHand, item.reorderPoint);
      if (status === "IN_STOCK") inStockCount++;
      else if (status === "LOW_STOCK") lowStockCount++;
      else outOfStockCount++;

      const key = item.categoryId ?? "__none__";
      const c = categories.get(key) ?? {
        categoryId: item.categoryId,
        name: item.category?.name ?? "Uncategorized",
        itemCount: 0,
        units: 0,
        inventoryValue: 0,
      };
      c.itemCount++;
      c.units += Math.max(0, onHand);
      c.inventoryValue += Math.max(0, onHand) * item.cost;
      categories.set(key, c);
    }

    const periodTotals = bucketMovement.reduce((acc, m) => {
      acc.unitsIn += m.unitsIn;
      acc.unitsOut += m.unitsOut;
      acc.transferred += m.transferred;
      acc.count += m.count;
      return acc;
    }, emptyMovement());

    // Turnover = units shipped out / average units on hand across the period.
    const avgUnits =
      stockTrendData.reduce((s, t) => s + t.units, 0) / Math.max(1, stockTrendData.length);
    const stockTurnover = avgUnits > 0 ? round1(periodTotals.unitsOut / avgUnits) : 0;

    const itemsById = new Map(items.map((i) => [i.id, i]));
    const topMovingItems = Array.from(itemMovement.entries())
      .map(([itemId, m]) => {
        const moved = unitsMoved(m);
        const prev = itemPrevMovement.get(itemId);
        const previousMoved = prev ? unitsMoved(prev) : 0;
        const changePct =
          previousMoved > 0 ? round1(((moved - previousMoved) / previousMoved) * 100) : null;
        const trend: "up" | "down" | "flat" =
          changePct === null ? (moved > 0 ? "up" : "flat") : changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";
        const change =
          changePct === null
            ? moved > 0
              ? "New"
              : "0%"
            : `${changePct > 0 ? "+" : ""}${Math.round(changePct)}%`;
        const item = itemsById.get(itemId);
        return {
          itemId,
          name: item?.name ?? "Deleted item",
          itemNumber: item?.itemNumber ?? null,
          moved,
          unitsIn: m.unitsIn,
          unitsOut: m.unitsOut,
          transferred: m.transferred,
          transactions: m.count,
          previousMoved,
          changePct,
          trend,
          change,
        };
      })
      .sort((a, b) => b.moved - a.moved || b.transactions - a.transactions)
      .slice(0, q.top);

    const categoryDistribution = Array.from(categories.values())
      .map((c) => ({
        name: c.name,
        value: c.itemCount, // kept: pie chart = items per category
        categoryId: c.categoryId,
        itemCount: c.itemCount,
        units: c.units,
        inventoryValue: round2(c.inventoryValue),
      }))
      .sort((a, b) => b.inventoryValue - a.inventoryValue || b.itemCount - a.itemCount);

    return sendSuccess(res, {
      keyMetrics: {
        totalStockValue: round2(totalStockValue),
        stockTurnover,
        inStockCount,
        lowStockCount,
        outOfStockCount,
        totalSkus: items.length,
        totalUnits,
        unitsIn: periodTotals.unitsIn,
        unitsOut: periodTotals.unitsOut,
        netMovement: periodTotals.unitsIn - periodTotals.unitsOut,
        unitsTransferred: periodTotals.transferred,
        transactionCount: periodTotals.count,
      },
      stockTrendData,
      movementData: stockTrendData.map((t) => ({
        month: t.month,
        label: t.label,
        stockIn: t.stockIn,
        stockOut: t.stockOut,
        net: t.net,
        transfers: t.transfers,
      })),
      inventoryValueData: stockTrendData.map((t) => ({ month: t.month, label: t.label, value: t.value })),
      categoryDistribution,
      topMovingItems,
      period: {
        timeRange: q.months ? `${q.months}months` : q.timeRange ?? "6months",
        granularity: range.unit,
        start: periodStart.toISOString(),
        end: now.toISOString(),
        previousStart: previousStart.toISOString(),
        previousEnd: periodStart.toISOString(),
      },
    });
  },
};

export default analyticsController;

