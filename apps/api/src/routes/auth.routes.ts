import { Router } from "express";
import rateLimit from "express-rate-limit";
import { UserRole } from "@prisma/client";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import * as authController from "../controllers/auth.controller.js";
import { loginSchema, registerSchema, updateProfileSchema } from "../utils/schemas.js";

const router = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many sign-in attempts. Try again later." } },
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

router.post("/register", registrationLimiter, validate(registerSchema), authController.register);
router.post("/login", loginLimiter, validate(loginSchema), authController.login());
router.post("/customer/login", loginLimiter, validate(loginSchema), authController.login(UserRole.CUSTOMER));
router.post("/agent/login", loginLimiter, validate(loginSchema), authController.login(UserRole.AGENT));
router.post("/admin/login", loginLimiter, validate(loginSchema), authController.login(UserRole.ADMIN));
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);
router.patch("/me", requireAuth, validate(updateProfileSchema), authController.updateMe);

export default router;
