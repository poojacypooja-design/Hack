import type { RequestHandler } from "express";
import { getValidated } from "../middleware/validation.middleware.js";
import { createIncidentGroup, listIncidentGroups, reviewIncidentGroup } from "../services/issue-dna.service.js";
import type { TicketActor } from "../services/ticket-access.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { z } from "zod";
import { incidentGroupSchema, incidentParamsSchema, incidentReviewSchema } from "../utils/schemas.js";

function actorFromRequest(request: Parameters<RequestHandler>[0]): TicketActor {
  if (!request.auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const list: RequestHandler = async (request, response) => {
  return success(response, { items: await listIncidentGroups(actorFromRequest(request)) });
};

export const create: RequestHandler = async (request, response) => {
  const input = getValidated<z.infer<typeof incidentGroupSchema>>(response, "body");
  return success(response, { incident: await createIncidentGroup(input, actorFromRequest(request)) }, 201);
};

export const review: RequestHandler = async (request, response) => {
  const { incidentId } = getValidated<z.infer<typeof incidentParamsSchema>>(response, "params");
  const { status } = getValidated<z.infer<typeof incidentReviewSchema>>(response, "body");
  return success(response, { incident: await reviewIncidentGroup(incidentId, status, actorFromRequest(request)) });
};
