import type { RequestHandler } from "express";
import { getValidated } from "../middleware/validation.middleware.js";
import { getTicketRisk, listPolicies, listSlaRisks, savePolicy } from "../services/sla.service.js";
import type { TicketActor } from "../services/ticket-access.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { z } from "zod";
import { policySchema, ticketParamsSchema } from "../utils/schemas.js";

function actorFromRequest(request: Parameters<RequestHandler>[0]): TicketActor {
  if (!request.auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const risks: RequestHandler = async (request, response) => {
  return success(response, { items: await listSlaRisks(actorFromRequest(request)) });
};

export const ticketRisk: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, await getTicketRisk(ticketId, actorFromRequest(request)));
};

export const policies: RequestHandler = async (_request, response) => {
  return success(response, { items: await listPolicies() });
};

export const upsertPolicy: RequestHandler = async (_request, response) => {
  const input = getValidated<z.infer<typeof policySchema>>(response, "body");
  return success(response, { policy: await savePolicy(input) });
};
