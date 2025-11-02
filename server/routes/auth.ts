import authController from "../controllers/auth";
import express from "express";
import { Request, Response, NextFunction } from "express";
import { rateLimitMiddle } from "../utils/utils";

const router = express.Router();

const isAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() && req.user && req.user !== undefined) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Authentication
router.post("/register", rateLimitMiddle, authController.registerUser);
router.post("/login", rateLimitMiddle, authController.loginUser);
router.post("/logout", authController.logoutUser);

// User Profile
router.get("/profile", isAuth, authController.getUserProfile);
router.patch("/profile", isAuth, authController.updateUserProfile);

// Password Management
router.put("/password", isAuth, authController.updatePassword);
router.post(
  "/password-change-request",
  rateLimitMiddle,
  authController.requestPasswordChange
);
router.post(
  "/password-reset/:token",
  rateLimitMiddle,
  authController.updatePasswordWithToekn
);
router.post(
  "/change-password",
  isAuth,
  rateLimitMiddle,
  authController.changePassword
);

export default router;
