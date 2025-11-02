import { Router } from "express";
import itemsController from "../controllers/items";

const router = Router();

// Get all items in a workspace
router.get("/", itemsController.getItems);

// Get a single item by ID
router.get("/:id", itemsController.getItemById);

// Create a new item
router.post("/", itemsController.createItem);

// Update an item
router.patch("/:id", itemsController.updateItem);

// Delete an item
router.delete("/:id", itemsController.deleteItem);

// Adjust stock (add/remove quantity)
router.post("/:id/adjust-stock", itemsController.adjustStock);

export default router;
