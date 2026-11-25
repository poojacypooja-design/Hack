import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "../controllers/assignment.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { assignmentSchema, escalationSchema, ticketParamsSchema } from "../utils/schemas.js";

const router = Router();
router.use(requireAuth);
router.post("/tickets/:ticketId/assign", requireRoles(UserRole.ADMIN), validate(ticketParamsSchema, "params"), validate(assignmentSchema), controller.assign);
router.get("/tickets/:ticketId/recommendations", requireRoles(UserRole.ADMIN), validate(ticketParamsSchema, "params"), controller.recommendations);
router.post("/tickets/:ticketId/claim", requireRoles(UserRole.AGENT), validate(ticketParamsSchema, "params"), controller.claim);
router.post("/tickets/:ticketId/escalate", requireRoles(UserRole.AGENT, UserRole.ADMIN), validate(ticketParamsSchema, "params"), validate(escalationSchema), controller.escalate);

export default router;
