import { Router } from "express";
import workspaceMembersController from "../controllers/workspaceMembers";

const router = Router();

// Get all members in a workspace
router.get("/", workspaceMembersController.getMembers);

// Update member role
router.patch("/:memberId/role", workspaceMembersController.updateMemberRole);

// Remove member from workspace
router.delete("/:memberId", workspaceMembersController.removeMember);

// Invite member
router.post("/invite", workspaceMembersController.inviteMember);

// Get pending invitations
router.get("/invitations", workspaceMembersController.getInvitations);

// Cancel invitation
router.delete(
  "/invitations/:invitationId",
  workspaceMembersController.cancelInvitation
);

// Resend invitation
router.post(
  "/invitations/:invitationId/resend",
  workspaceMembersController.resendInvitation
);

export default router;
