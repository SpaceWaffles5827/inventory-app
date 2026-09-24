import { Router } from "express";
import lotsController from "../controllers/lots";

const router = Router();

// Get all lots for an item
router.get("/item/:itemId", lotsController.getLotsByItem);

// Create (receive) a new lot for an item
router.post("/item/:itemId", lotsController.createLot);

// Lots with stock expiring within ?days= (default 30) — before "/:id"
router.get("/expiring", lotsController.getExpiringLots);

// Get single lot
router.get("/:id", lotsController.getLotById);

// Update lot status
router.patch("/:id/status", lotsController.updateLotStatus);

// Adjust lot quantity at a location
router.post("/:id/adjust", lotsController.adjustLotQuantity);

// Update lot details
router.put("/:id", lotsController.updateLot);

export default router;
