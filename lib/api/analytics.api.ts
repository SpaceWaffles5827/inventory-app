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
  const response = await fetch(
    `/api/analytics?workspaceId=${encodeURIComponent(
      workspaceId
    )}&timeRange=${timeRange}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Failed to fetch analytics");
  }

  return result;
}
