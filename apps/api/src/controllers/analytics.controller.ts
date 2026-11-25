import type { RequestHandler } from "express";
import { getValidated } from "../middleware/validation.middleware.js";
import { getAnalytics } from "../services/analytics.service.js";
import type { TicketActor } from "../services/ticket-access.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { z } from "zod";
import { analyticsQuerySchema } from "../utils/schemas.js";

export const overview: RequestHandler = async (request, response) => {
  if (!request.auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  const period = getValidated<z.infer<typeof analyticsQuerySchema>>(response, "query");
  const actor: TicketActor = { userId: request.auth.userId, role: request.auth.role };
  return success(response, await getAnalytics(actor, period));
};
