import { Router } from "express";
import { UserRole } from "@prisma/client";
import {
  createAgent,
  customers,
  detail,
  list,
  updateAssignmentProfile,
  updateAvailability,
  updateStatus,
} from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  agentAssignmentProfileSchema,
  agentAvailabilitySchema,
  paginationQuerySchema,
  provisionAgentSchema,
  userListQuerySchema,
  userParamsSchema,
  userStatusSchema,
} from "../utils/schemas.js";

const router = Router();
router.use(requireAuth);
router.get("/", requireRoles(UserRole.ADMIN), validate(userListQuerySchema, "query"), list);
router.get("/customers", requireRoles(UserRole.ADMIN), validate(paginationQuerySchema, "query"), customers);
router.patch("/availability", requireRoles(UserRole.AGENT), validate(agentAvailabilitySchema), updateAvailability);
router.patch("/:userId/assignment-profile", requireRoles(UserRole.ADMIN), validate(userParamsSchema, "params"), validate(agentAssignmentProfileSchema), updateAssignmentProfile);
router.get("/:userId", requireRoles(UserRole.ADMIN), validate(userParamsSchema, "params"), detail);
router.post("/agents", requireRoles(UserRole.ADMIN), validate(provisionAgentSchema), createAgent);
router.patch("/:userId/status", requireRoles(UserRole.ADMIN), validate(userParamsSchema, "params"), validate(userStatusSchema), updateStatus);

export default router;
