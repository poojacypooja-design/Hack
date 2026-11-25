import { Router } from "express";
import { UserRole } from "@prisma/client";
import * as controller from "../controllers/ticket.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { attachmentUpload } from "../middleware/upload.middleware.js";
import { requireRoles } from "../middleware/role.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import {
  createTicketSchema,
  feedbackSchema,
  listTicketsQuerySchema,
  resolutionSchema,
  ticketFeedbackParamsSchema,
  ticketParamsSchema,
  updateStatusSchema,
  updateTicketSchema,
  attachmentParamsSchema,
} from "../utils/schemas.js";

const router = Router();
router.use(requireAuth);

router.get("/", validate(listTicketsQuerySchema, "query"), controller.list);
router.get("/assigned", requireRoles(UserRole.AGENT), validate(listTicketsQuerySchema, "query"), controller.assigned);
router.get("/unassigned", requireRoles(UserRole.AGENT), validate(listTicketsQuerySchema, "query"), controller.unassigned);
router.post("/", requireRoles(UserRole.CUSTOMER), validate(createTicketSchema), controller.create);
router.get("/:ticketId/history", validate(ticketParamsSchema, "params"), controller.history);
router.post(
  "/:ticketId/attachments",
  validate(ticketParamsSchema, "params"),
  attachmentUpload.single("file"),
  controller.uploadAttachment,
);
router.get("/:ticketId/attachments/:attachmentId", validate(attachmentParamsSchema, "params"), controller.downloadAttachment);
router.get("/:ticketId/similar", validate(ticketParamsSchema, "params"), controller.similar);
router.get("/:ticketId/resolution-suggestions", validate(ticketParamsSchema, "params"), controller.resolutionSuggestions);
router.post(
  "/:ticketId/resolution",
  requireRoles(UserRole.AGENT, UserRole.ADMIN),
  validate(ticketParamsSchema, "params"),
  validate(resolutionSchema),
  controller.saveResolutionForTicket,
);
router.post(
  "/:ticketId/feedback",
  requireRoles(UserRole.CUSTOMER),
  validate(ticketFeedbackParamsSchema, "params"),
  validate(feedbackSchema),
  controller.feedback,
);
router.post(
  "/:ticketId/confirm-resolution",
  requireRoles(UserRole.CUSTOMER),
  validate(ticketParamsSchema, "params"),
  controller.confirmResolution,
);
router.patch("/:ticketId/status", requireRoles(UserRole.AGENT, UserRole.ADMIN), validate(ticketParamsSchema, "params"), validate(updateStatusSchema), controller.updateStatus);
router.patch("/:ticketId", validate(ticketParamsSchema, "params"), validate(updateTicketSchema), controller.update);
router.get("/:ticketId", validate(ticketParamsSchema, "params"), controller.detail);

export default router;
