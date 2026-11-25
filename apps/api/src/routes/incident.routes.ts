import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "../controllers/incident.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { incidentGroupSchema, incidentParamsSchema, incidentReviewSchema } from "../utils/schemas.js";

const router = Router();
router.use(requireAuth, requireRoles(UserRole.AGENT, UserRole.ADMIN));
router.get("/", controller.list);
router.post("/", validate(incidentGroupSchema), controller.create);
router.patch("/:incidentId", validate(incidentParamsSchema, "params"), validate(incidentReviewSchema), controller.review);

export default router;
