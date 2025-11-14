import { Router } from "express";
import customersController from "../controllers/customers";

const router = Router();

// Get customer statistics
router.get("/stats", customersController.getCustomerStats);

// Get all customers in a workspace
router.get("/", customersController.getCustomers);

// Get a single customer by ID
router.get("/:id", customersController.getCustomerById);

// Create a new customer
router.post("/", customersController.createCustomer);

// Update a customer
router.patch("/:id", customersController.updateCustomer);

// Delete a customer
router.delete("/:id", customersController.deleteCustomer);

// Attach an item to a customer
router.post("/attach-item", customersController.attachItemToCustomer);

// Detach an item from a customer
router.delete(
  "/:customerId/items/:itemId",
  customersController.detachItemFromCustomer
);

export default router;
