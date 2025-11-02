import { Router } from "express";
import categoriesController from "../controllers/categories";

const router = Router();

// Get all categories in a workspace
router.get("/", categoriesController.getCategories);

// Get a single category by ID
router.get("/:id", categoriesController.getCategoryById);

// Create a new category
router.post("/", categoriesController.createCategory);

// Update a category
router.patch("/:id", categoriesController.updateCategory);

// Delete a category
router.delete("/:id", categoriesController.deleteCategory);

export default router;
