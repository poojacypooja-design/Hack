import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "../controllers/message.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { messageSchema, ticketParamsSchema } from "../utils/schemas.js";

const router = Router();
router.use(requireAuth);
router.get("/:ticketId", validate(ticketParamsSchema, "params"), controller.listPublic);
router.post("/:ticketId", validate(ticketParamsSchema, "params"), validate(messageSchema), controller.createPublic);
router.get("/:ticketId/internal-notes", requireRoles(UserRole.AGENT, UserRole.ADMIN), validate(ticketParamsSchema, "params"), controller.listInternal);
router.post("/:ticketId/internal-notes", requireRoles(UserRole.AGENT, UserRole.ADMIN), validate(ticketParamsSchema, "params"), validate(messageSchema), controller.createInternal);

export default router;
