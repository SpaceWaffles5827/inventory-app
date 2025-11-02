import { Router } from "express";
import workspaceController from "../controllers/workspace";

const router = Router();

// Get all workspaces for current user
router.get("/", workspaceController.getUserWorkspaces);

// Get a single workspace by ID
router.get("/:id", workspaceController.getWorkspaceById);

// Create a new workspace
router.post("/", workspaceController.createWorkspace);

// Update a workspace (ADMIN/OWNER only)
router.patch("/:id", workspaceController.updateWorkspace);

// Delete a workspace (OWNER only)
router.delete("/:id", workspaceController.deleteWorkspace);

// Invite a user to workspace (ADMIN/OWNER only)
router.post("/:id/invite", workspaceController.inviteUser);

// Remove a member from workspace (ADMIN/OWNER only)
router.delete("/:id/members/:memberId", workspaceController.removeMember);

// Update member role (OWNER only)
router.patch(
  "/:id/members/:memberId/role",
  workspaceController.updateMemberRole
);

export default router;
