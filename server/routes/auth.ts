import express from "express";
import authController from "../controllers/auth";
import { isAuth } from "../middleware/auth";
import {
  loginLimiter,
  loginEmailLimiter,
  registerLimiter,
  passwordResetRequestLimiter,
  passwordResetLimiter,
  passwordChangeLimiter,
} from "../utils/utils";

const router = express.Router();

// Authentication
router.post("/register", registerLimiter, authController.registerUser);
router.post("/login", loginLimiter, loginEmailLimiter, authController.loginUser);
router.post("/logout", authController.logoutUser);

// User Profile
router.get("/profile", isAuth, authController.getUserProfile);
router.patch("/profile", isAuth, authController.updateUserProfile);

// Password Management (both routes kept for existing clients; same handler)
router.put("/password", isAuth, passwordChangeLimiter, authController.changePassword);
router.post("/change-password", isAuth, passwordChangeLimiter, authController.changePassword);
router.post(
  "/password-change-request",
  passwordResetRequestLimiter,
  authController.requestPasswordChange
);
router.post(
  "/password-reset/:token",
  passwordResetLimiter,
  authController.resetPasswordWithToken
);

export default router;
