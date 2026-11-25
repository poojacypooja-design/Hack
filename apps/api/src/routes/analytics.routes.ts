import { Router } from "express";
import { UserRole } from "@prisma/client";
import { overview } from "../controllers/analytics.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { analyticsQuerySchema } from "../utils/schemas.js";

const router = Router();
router.get("/", requireAuth, requireRoles(UserRole.CUSTOMER, UserRole.AGENT, UserRole.ADMIN), validate(analyticsQuerySchema, "query"), overview);

export default router;
