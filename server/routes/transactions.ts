import { Router } from "express";
import transactionsController from "../controllers/transactions";

const router = Router();

/**
 * @openapi
 * /api/transactions:
 *   get:
 *     summary: Stock movement log (newest first, cursor paginated)
 *     tags: [Transactions]
 *     parameters:
 *       - { in: query, name: workspaceId, required: true, schema: { type: string } }
 *       - { in: query, name: itemId, schema: { type: string } }
 *       - { in: query, name: locationId, schema: { type: string }, description: "matches from OR to location" }
 *       - { in: query, name: lotId, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string, enum: [INPUT, OUTPUT, TRANSFER] } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time }, description: "a bare YYYY-MM-DD includes that whole day" }
 *       - { in: query, name: limit, schema: { type: integer, default: 50, maximum: 200 } }
 *       - { in: query, name: cursor, schema: { type: string }, description: "id of the last row of the previous page" }
 *     responses:
 *       200: { description: "{ status, data: { transactions: TransactionEntry[], nextCursor: string|null } }" }
 */
router.get("/", transactionsController.listTransactions);

export default router;
