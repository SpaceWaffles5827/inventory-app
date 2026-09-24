import { Router } from "express";
import invitationsController from "../controllers/invitations";
import { invitationLimiter } from "../utils/utils";

const router = Router();

// Verify invitation (public route, token based)
router.get("/verify", invitationLimiter, invitationsController.verifyInvitation);

// Accept invitation (public route, token based)
router.post("/accept", invitationLimiter, invitationsController.acceptInvitation);

export default router;
