import { Router } from "express";
import * as controller from "../controllers/notification.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validation.middleware.js";
import { notificationListQuerySchema, notificationParamsSchema, notificationReadSchema } from "../utils/schemas.js";

const router = Router();
router.use(requireAuth);
router.get("/", validate(notificationListQuerySchema, "query"), controller.list);
router.patch("/read-all", controller.markAllRead);
router.patch("/:notificationId", validate(notificationParamsSchema, "params"), validate(notificationReadSchema), controller.markRead);

export default router;
