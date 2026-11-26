import type { RequestHandler } from "express";
import { getValidated } from "../middleware/validation.middleware.js";
import {
  assignTicket,
  assignmentRecommendations,
  claimTicket,
  escalateTicket,
} from "../services/assignment.service.js";
import {
  getAssignmentHistory,
  getAssignmentSettings,
  getAssignmentStatistics,
  retryAssignment,
  updateAssignmentSettings,
} from "../services/intelligent-assignment.service.js";
import type { TicketActor } from "../services/ticket-access.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { z } from "zod";
import {
  assignmentSchema,
  assignmentSettingsSchema,
  escalationSchema,
  ticketParamsSchema,
} from "../utils/schemas.js";

function actorFromRequest(request: Parameters<RequestHandler>[0]): TicketActor {
  if (!request.auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const assign: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const input = getValidated<z.infer<typeof assignmentSchema>>(response, "body");
  return success(response, await assignTicket(ticketId, actorFromRequest(request), input));
};

export const claim: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, await claimTicket(ticketId, actorFromRequest(request)));
};

export const escalate: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const { note } = getValidated<z.infer<typeof escalationSchema>>(response, "body");
  return success(response, await escalateTicket(ticketId, actorFromRequest(request), note));
};

export const recommendations: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, await assignmentRecommendations(ticketId, actorFromRequest(request)));
};

export const settings: RequestHandler = async (_request, response) => {
  return success(response, await getAssignmentSettings());
};

export const statistics: RequestHandler = async (_request, response) => {
  return success(response, await getAssignmentStatistics());
};

export const updateSettings: RequestHandler = async (_request, response) => {
  const input = getValidated<z.infer<typeof assignmentSettingsSchema>>(response, "body");
  return success(response, await updateAssignmentSettings(input));
};

export const history: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, await getAssignmentHistory(ticketId, actorFromRequest(request)));
};

export const retry: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, await retryAssignment(ticketId, actorFromRequest(request)));
};
