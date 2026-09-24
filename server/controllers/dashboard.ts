import { Request, Response } from "express";
import { z } from "zod";
import prisma from "../utils/prisma";
import { requireMembership, requireUserId } from "../utils/access";
import { sendSuccess } from "../utils/http";
import { parseQuery, zId } from "../utils/validate";
import { getOnHandByItem } from "../utils/stock";
import { toTransactionEntry, transactionFeedSelect } from "../utils/transactionFeed";

const round2 = (n: number) => Math.round(n * 100) / 100;

const dashboardController = {
  /**
   * GET /api/dashboard/summary?workspaceId=
   * lowStockCount counts LOW_STOCK only (0 < onHand <= reorderPoint);
   * outOfStockCount counts onHand <= 0. They never overlap.
   */
  getSummary: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const { workspaceId } = parseQuery(z.object({ workspaceId: zId }), req);
    await requireMembership(userId, workspaceId);

    const [items, onHandMap, locationsCount, recent] = await Promise.all([
      prisma.item.findMany({
        where: { workspaceId },
        select: { id: true, name: true, itemNumber: true, unit: true, cost: true, reorderPoint: true },
      }),
      getOnHandByItem(prisma, workspaceId),
      prisma.location.count({ where: { workspaceId } }),
      prisma.stockTransaction.findMany({
        where: { workspaceId },
        select: transactionFeedSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
      }),
    ]);

    let totalUnits = 0;
    let inventoryValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const needsAttention: {
      id: string;
      name: string;
      itemNumber: string;
      onHand: number;
      reorderPoint: number;
      unit: string | null;
    }[] = [];

    for (const item of items) {
      const onHand = onHandMap.get(item.id) ?? 0;
      totalUnits += onHand;
      inventoryValue += onHand * item.cost;
      if (onHand <= 0) outOfStockCount++;
      else if (onHand <= item.reorderPoint) lowStockCount++;
      if (onHand <= 0 || onHand <= item.reorderPoint) {
        needsAttention.push({
          id: item.id,
          name: item.name,
          itemNumber: item.itemNumber,
          onHand,
          reorderPoint: item.reorderPoint,
          unit: item.unit,
        });
      }
    }

    // Out of stock first, then lowest onHand / reorderPoint ratio.
    const ratio = (e: { onHand: number; reorderPoint: number }) =>
      e.reorderPoint > 0 ? e.onHand / e.reorderPoint : e.onHand > 0 ? Infinity : 0;
    needsAttention.sort((a, b) => {
      const aOut = a.onHand <= 0 ? 0 : 1;
      const bOut = b.onHand <= 0 ? 0 : 1;
      if (aOut !== bOut) return aOut - bOut;
      const r = ratio(a) - ratio(b);
      if (r !== 0) return r;
      return a.name.localeCompare(b.name);
    });

    return sendSuccess(res, {
      totalSkus: items.length,
      totalUnits,
      inventoryValue: round2(inventoryValue),
      lowStockCount,
      outOfStockCount,
      locationsCount,
      recentTransactions: recent.map(toTransactionEntry),
      lowStockItems: needsAttention.slice(0, 10),
    });
  },
};

export default dashboardController;
