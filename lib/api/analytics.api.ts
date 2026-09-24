import { apiRequest } from "./client";

export interface AnalyticsData {
  keyMetrics: {
    totalStockValue: number;
    stockTurnover: number;
    inStockCount: number;
    lowStockCount: number;
  };
  stockTrendData: Array<{
    month: string;
    inStock: number;
    lowStock: number;
    outOfStock: number;
    value: number;
  }>;
  categoryDistribution: Array<{
    name: string;
    value: number;
  }>;
  inventoryValueData: Array<{
    month: string;
    value: number;
  }>;
  topMovingItems: Array<{
    name: string;
    moved: number;
    trend: string;
    change: string;
  }>;
}

export interface AnalyticsApiResponse {
  status: "success" | "error";
  message?: string;
  data?: AnalyticsData;
}

/**
 * Get analytics data for a workspace
 */
export async function getAnalyticsApi(
  workspaceId: string,
  timeRange: string = "6months"
): Promise<AnalyticsApiResponse> {
  return apiRequest<AnalyticsApiResponse>("/api/analytics", {
    query: { workspaceId, timeRange },
    errorMessage: "Failed to fetch analytics",
  });
}
