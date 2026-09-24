// Client-side API helpers for the stock movement log and dashboard summary
import { apiRequest } from "./client";
import type { ApiResponse } from "./types";

export type TransactionType = "INPUT" | "OUTPUT" | "TRANSFER";

export type TransactionEntry = {
  id: string;
  type: TransactionType;
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

export type TransactionsQuery = {
  workspaceId: string;
  itemId?: string;
  locationId?: string;
  lotId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export type TransactionsApiResponse = ApiResponse<{
  transactions: TransactionEntry[];
  nextCursor?: string | null;
}>;

export type LowStockEntry = {
  id: string;
  name: string;
  itemNumber: string;
  onHand: number;
  reorderPoint: number;
  unit: string | null;
};

export type DashboardSummary = {
  totalSkus: number;
  totalUnits: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  locationsCount: number;
  recentTransactions: TransactionEntry[];
  lowStockItems: LowStockEntry[];
};

export type DashboardSummaryApiResponse = ApiResponse<DashboardSummary>;

/**
 * List stock transactions (newest first) with optional filters and cursor pagination
 */
export async function getTransactionsApi(query: TransactionsQuery): Promise<TransactionsApiResponse> {
  return apiRequest<TransactionsApiResponse>("/api/transactions", {
    query,
    errorMessage: "Failed to load activity",
  });
}

/**
 * Get headline numbers, low-stock items and recent activity for the overview page
 */
export async function getDashboardSummaryApi(workspaceId: string): Promise<DashboardSummaryApiResponse> {
  return apiRequest<DashboardSummaryApiResponse>("/api/dashboard/summary", {
    query: { workspaceId },
    errorMessage: "Failed to load dashboard",
  });
}
