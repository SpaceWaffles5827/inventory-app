import { Router } from "express";
import lotsController from "../controllers/lots";

const router = Router();

// Get all lots for an item
router.get("/item/:itemId", lotsController.getLotsByItem);

// Create new lot for an item
router.post("/item/:itemId", lotsController.createLot);

// Get single lot
router.get("/:id", lotsController.getLotById);

// Update lot status
router.patch("/:id/status", lotsController.updateLotStatus);

// In your lots routes file (e.g., routes/lots.routes.ts)
router.post("/:id/adjust", lotsController.adjustLotQuantity);

// Update lot details
router.put("/:id", lotsController.updateLot);

export default router;
