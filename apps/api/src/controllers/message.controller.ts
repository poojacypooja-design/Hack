import type { RequestHandler } from "express";
import { getValidated } from "../middleware/validation.middleware.js";
import { createInternalNote, createPublicMessage, listInternalNotes, listPublicMessages } from "../services/message.service.js";
import type { TicketActor } from "../services/ticket-access.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { z } from "zod";
import { messageSchema, ticketParamsSchema } from "../utils/schemas.js";

function actorFromRequest(request: Parameters<RequestHandler>[0]): TicketActor {
  if (!request.auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const listPublic: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, { messages: await listPublicMessages(ticketId, actorFromRequest(request)) });
};

export const createPublic: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const { body } = getValidated<z.infer<typeof messageSchema>>(response, "body");
  return success(response, { message: await createPublicMessage(ticketId, actorFromRequest(request), body) }, 201);
};

export const listInternal: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, { notes: await listInternalNotes(ticketId, actorFromRequest(request)) });
};

export const createInternal: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const { body } = getValidated<z.infer<typeof messageSchema>>(response, "body");
  return success(response, { note: await createInternalNote(ticketId, actorFromRequest(request), body) }, 201);
};
