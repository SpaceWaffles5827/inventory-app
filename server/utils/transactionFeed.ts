// Shape of a stock transaction as returned by the activity feed endpoints
// (GET /api/transactions and GET /api/dashboard/summary).
import { Prisma } from "@prisma/client";
import { SYSTEM_LOT_NUMBER } from "./stock";

export const transactionFeedSelect = {
  id: true,
  type: true,
  quantity: true,
  reason: true,
  previousStock: true,
  newStock: true,
  createdAt: true,
  item: { select: { id: true, name: true, itemNumber: true, unit: true } },
  lot: { select: { id: true, lotNumber: true } },
  fromLocation: { select: { id: true, code: true } },
  toLocation: { select: { id: true, code: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.StockTransactionSelect;

type Row = Prisma.StockTransactionGetPayload<{ select: typeof transactionFeedSelect }>;

export type TransactionEntry = {
  id: string;
  type: Row["type"];
  quantity: number;
  reason: string | null;
  previousStock: number | null;
  newStock: number | null;
  createdAt: string;
  item: { id: string; name: string; itemNumber: string; unit: string | null } | null;
  lot: { id: string; lotNumber: string } | null;
  fromLocation: { id: string; code: string } | null;
  toLocation: { id: string; code: string } | null;
  user: { id: string; name: string | null } | null;
};

/** The internal SYSTEM lot (non-lot-tracked items) is reported as lot: null. */
export function toTransactionEntry(row: Row): TransactionEntry {
  return {
    id: row.id,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason ?? null,
    previousStock: row.previousStock ?? null,
    newStock: row.newStock ?? null,
    createdAt: row.createdAt.toISOString(),
    item: row.item ?? null,
    lot: row.lot && row.lot.lotNumber !== SYSTEM_LOT_NUMBER ? row.lot : null,
    fromLocation: row.fromLocation ?? null,
    toLocation: row.toLocation ?? null,
    user: row.user ?? null,
  };
}
