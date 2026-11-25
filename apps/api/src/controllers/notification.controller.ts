import type { RequestHandler } from "express";
import { getValidated } from "../middleware/validation.middleware.js";
import { listNotifications, markAllNotificationsRead, markNotificationRead } from "../services/notification.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { z } from "zod";
import { notificationListQuerySchema, notificationParamsSchema, notificationReadSchema } from "../utils/schemas.js";

function userIdFromRequest(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.userId) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return request.auth.userId;
}

export const list: RequestHandler = async (request, response) => {
  const query = getValidated<z.infer<typeof notificationListQuerySchema>>(response, "query");
  return success(response, await listNotifications(
    userIdFromRequest(request),
    query.page,
    query.limit,
    query.unreadOnly === "true",
  ));
};

export const markRead: RequestHandler = async (request, response) => {
  const { notificationId } = getValidated<z.infer<typeof notificationParamsSchema>>(response, "params");
  const { read } = getValidated<z.infer<typeof notificationReadSchema>>(response, "body");
  await markNotificationRead(userIdFromRequest(request), notificationId, read);
  return success(response, { notificationId, read });
};

export const markAllRead: RequestHandler = async (request, response) => {
  return success(response, await markAllNotificationsRead(userIdFromRequest(request)));
};
