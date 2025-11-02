import { Router } from "express";
import invitationsController from "../controllers/invitations";

const router = Router();

// Verify invitation (public route)
router.get("/verify", invitationsController.verifyInvitation);

// Accept invitation (public route)
router.post("/accept", invitationsController.acceptInvitation);

export default router;
