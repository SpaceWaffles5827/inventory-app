import { Router } from "express";
import analyticsController from "../controllers/analytics";

const router = Router();

// Get analytics data
router.get("/", analyticsController.getAnalytics);

export default router;
