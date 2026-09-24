import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import prisma from "../utils/prisma";
import { requireMembership, requireUserId } from "../utils/access";
import { sendSuccess } from "../utils/http";
import { paginationQuery, parseQuery, zId } from "../utils/validate";
import { toTransactionEntry, transactionFeedSelect } from "../utils/transactionFeed";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const zQueryDate = (endOfDay: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === "") return undefined;
    if (typeof v !== "string") return v;
    // A bare date for `to` means "through the end of that day" (UTC).
    if (DATE_ONLY.test(v)) return new Date(`${v}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
    return new Date(v);
  }, z.date().optional());

const listSchema = paginationQuery(50, 200).extend({
  workspaceId: zId,
  itemId: zId.optional(),
  locationId: zId.optional(),
  lotId: zId.optional(),
  type: z.enum(["INPUT", "OUTPUT", "TRANSFER"]).optional(),
  from: zQueryDate(false),
  to: zQueryDate(true),
});

const transactionsController = {
  /**
   * GET /api/transactions?workspaceId=&itemId=&locationId=&lotId=&type=&from=&to=&limit=&cursor=
   * Newest first. `cursor` = id of the last row of the previous page.
   * -> { transactions: TransactionEntry[], nextCursor: string | null }
   */
  listTransactions: async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const q = parseQuery(listSchema, req);
    await requireMembership(userId, q.workspaceId);

    const where: Prisma.StockTransactionWhereInput = { workspaceId: q.workspaceId };
    if (q.itemId) where.itemId = q.itemId;
    if (q.lotId) where.lotId = q.lotId;
    if (q.type) where.type = q.type;
    if (q.locationId) {
      where.OR = [{ fromLocationId: q.locationId }, { toLocationId: q.locationId }];
    }
    if (q.from || q.to) {
      where.createdAt = {
        ...(q.from ? { gte: q.from } : {}),
        ...(q.to ? { lte: q.to } : {}),
      };
    }

    const rows = await prisma.stockTransaction.findMany({
      where,
      select: transactionFeedSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;

    return sendSuccess(res, {
      transactions: page.map(toTransactionEntry),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    });
  },
};

export default transactionsController;
