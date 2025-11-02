import { Request, Response } from "express";
import prisma from "../utils/prisma";

interface MonthlyData {
  month: string;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  value: number;
}

interface ItemMovement {
  itemId: string;
  name: string;
  moved: number;
  count: number;
}

const analyticsController = {
  // Get analytics data for a workspace
  getAnalytics: async (req: Request, res: Response) => {
    try {
      const { workspaceId, timeRange } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      if (!workspaceId) {
        return res.status(400).json({
          status: "error",
          message: "Workspace ID is required",
        });
      }

      // Verify user has access to this workspace
      const workspaceMember = await prisma.workspaceMember.findFirst({
        where: {
          userId: userId,
          workspaceId: workspaceId as string,
        },
      });

      if (!workspaceMember) {
        return res.status(403).json({
          status: "error",
          message: "You don't have access to this workspace",
        });
      }

      // Calculate date range
      const now = new Date();
      let startDate = new Date();

      switch (timeRange) {
        case "7days":
          startDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          startDate.setDate(now.getDate() - 30);
          break;
        case "3months":
          startDate.setMonth(now.getMonth() - 3);
          break;
        case "6months":
          startDate.setMonth(now.getMonth() - 6);
          break;
        case "1year":
          startDate.setFullYear(now.getFullYear() - 1);
          break;
        default:
          startDate.setMonth(now.getMonth() - 6);
      }

      // Get all items in workspace
      const items = await prisma.item.findMany({
        where: {
          workspaceId: workspaceId as string,
        },
        include: {
          category: true,
        },
      });

      // Calculate key metrics
      const totalStockValue = items.reduce(
        (sum, item) => sum + item.onHand * item.cost,
        0
      );

      const inStockCount = items.filter(
        (item) => item.status === "IN_STOCK"
      ).length;
      const lowStockCount = items.filter(
        (item) => item.status === "LOW_STOCK"
      ).length;
      const outOfStockCount = items.filter(
        (item) => item.status === "OUT_OF_STOCK"
      ).length;

      // Get transactions for the time range
      const transactions = await prisma.stockTransaction.findMany({
        where: {
          workspaceId: workspaceId as string,
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          item: {
            include: {
              category: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Calculate stock turnover (simplified - transactions / average stock)
      const totalTransactions = transactions.reduce(
        (sum, t) => sum + t.quantity,
        0
      );
      const averageStock = items.reduce((sum, item) => sum + item.onHand, 0);
      const stockTurnover =
        averageStock > 0 ? totalTransactions / averageStock : 0;

      // Group transactions by month for trends
      const monthlyData = new Map<string, MonthlyData>();
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      // Initialize months
      for (let i = 0; i < 6; i++) {
        const date = new Date();
        date.setMonth(now.getMonth() - i);
        const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        monthlyData.set(monthKey, {
          month: monthNames[date.getMonth()],
          inStock: 0,
          lowStock: 0,
          outOfStock: 0,
          value: 0,
        });
      }

      // Current stock levels (approximate for historical data)
      monthlyData.forEach((data) => {
        data.inStock = inStockCount;
        data.lowStock = lowStockCount;
        data.outOfStock = outOfStockCount;
        data.value = totalStockValue;
      });

      const stockTrendData = Array.from(monthlyData.values()).reverse();

      // Category distribution
      const categoryMap = new Map<string, number>();
      items.forEach((item) => {
        const categoryName = item.category?.name || "Uncategorized";
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + 1);
      });

      const categoryDistribution = Array.from(categoryMap.entries()).map(
        ([name, value]) => ({
          name,
          value,
        })
      );

      // Top moving items (based on transaction frequency)
      const itemMovementMap = new Map<string, ItemMovement>();
      transactions.forEach((transaction) => {
        const itemId = transaction.itemId;
        const existing = itemMovementMap.get(itemId);
        if (existing) {
          existing.moved += transaction.quantity;
          existing.count += 1;
        } else {
          itemMovementMap.set(itemId, {
            itemId,
            name: transaction.item.name,
            moved: transaction.quantity,
            count: 1,
          });
        }
      });

      const topMovingItems = Array.from(itemMovementMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((item) => ({
          name: item.name,
          moved: item.count,
          trend: "up" as const, // Simplified - could calculate based on previous period
          change: "+0%", // Simplified - could calculate based on previous period
        }));

      return res.status(200).json({
        status: "success",
        data: {
          keyMetrics: {
            totalStockValue,
            stockTurnover: parseFloat(stockTurnover.toFixed(1)),
            inStockCount,
            lowStockCount,
          },
          stockTrendData,
          categoryDistribution,
          inventoryValueData: stockTrendData.map((d) => ({
            month: d.month,
            value: d.value,
          })),
          topMovingItems,
        },
      });
    } catch (error: unknown) {
      console.error("Get analytics error:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to retrieve analytics",
      });
    }
  },
};

export default analyticsController;
