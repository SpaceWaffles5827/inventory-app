import { Router } from "express";
import locationsController from "../controllers/locations";

const router = Router();

// Workspace structure endpoints
router.get("/workspace-structure", locationsController.getWorkspaceStructure);

router.put(
  "/workspace-structure",
  locationsController.updateWorkspaceStructure
);

// Get all locations in a workspace
router.get("/", locationsController.getLocations);

// Get a single location by ID
router.get("/:id", locationsController.getLocationById);

// Create a new location
router.post("/", locationsController.createLocation);

// Update a location
router.patch("/:id", locationsController.updateLocation);

// Delete a location
router.delete("/:id", locationsController.deleteLocation);

export default router;
