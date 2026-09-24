import { Router } from "express";
import dashboardController from "../controllers/dashboard";

const router = Router();

/**
 * @openapi
 * /api/dashboard/summary:
 *   get:
 *     summary: Headline numbers, low-stock items and the 10 latest movements
 *     tags: [Dashboard]
 *     parameters:
 *       - { in: query, name: workspaceId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "{ status, data: { totalSkus, totalUnits, inventoryValue, lowStockCount, outOfStockCount, locationsCount, recentTransactions, lowStockItems } }" }
 */
router.get("/summary", dashboardController.getSummary);

export default router;
