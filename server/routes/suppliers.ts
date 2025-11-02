import { Router } from "express";
import suppliersController from "../controllers/suppliers";

const router = Router();

// Get all suppliers in a workspace
router.get("/", suppliersController.getSuppliers);

// Get a single supplier by ID
router.get("/:id", suppliersController.getSupplierById);

// Create a new supplier
router.post("/", suppliersController.createSupplier);

// Update a supplier
router.patch("/:id", suppliersController.updateSupplier);

// Delete a supplier
router.delete("/:id", suppliersController.deleteSupplier);

export default router;
