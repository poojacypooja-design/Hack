import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "../controllers/sla.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { policySchema, ticketParamsSchema } from "../utils/schemas.js";

const router = Router();
router.use(requireAuth);
router.get("/risks", requireRoles(UserRole.AGENT, UserRole.ADMIN), controller.risks);
router.get("/policies", requireRoles(UserRole.ADMIN), controller.policies);
router.put("/policies", requireRoles(UserRole.ADMIN), validate(policySchema), controller.upsertPolicy);
router.get("/tickets/:ticketId", requireRoles(UserRole.AGENT, UserRole.ADMIN), validate(ticketParamsSchema, "params"), controller.ticketRisk);

export default router;
