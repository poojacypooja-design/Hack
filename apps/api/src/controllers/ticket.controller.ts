import { randomUUID } from "node:crypto";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import { fileTypeFromBuffer } from "file-type";
import { env } from "../config/env.js";
import { getValidated } from "../middleware/validation.middleware.js";
import {
  addAttachmentRecord,
  confirmTicketResolution,
  createTicket,
  getAttachment,
  getTicketDetails,
  listAssignedTickets,
  listTicketHistory,
  listTickets,
  listUnassignedTickets,
  submitFeedback,
  updateTicket,
  updateTicketStatus,
} from "../services/ticket.service.js";
import { findSimilarTickets } from "../services/issue-dna.service.js";
import { saveResolution, suggestResolutions } from "../services/resolution-memory.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { TicketActor } from "../services/ticket-access.service.js";
import {
  attachmentParamsSchema,
  createTicketSchema,
  feedbackSchema,
  listTicketsQuerySchema,
  resolutionSchema,
  ticketFeedbackParamsSchema,
  ticketParamsSchema,
  updateStatusSchema,
  updateTicketSchema,
} from "../utils/schemas.js";
import type { z } from "zod";
import { logger } from "../utils/logger.js";

function actorFromRequest(request: Parameters<RequestHandler>[0]): TicketActor {
  if (!request.auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return { userId: request.auth.userId, role: request.auth.role };
}

export const list: RequestHandler = async (request, response) => {
  const query = getValidated<z.infer<typeof listTicketsQuerySchema>>(response, "query");
  return success(response, await listTickets(actorFromRequest(request), query));
};

export const assigned: RequestHandler = async (request, response) => {
  const query = getValidated<z.infer<typeof listTicketsQuerySchema>>(response, "query");
  return success(response, await listAssignedTickets(actorFromRequest(request), query));
};

export const unassigned: RequestHandler = async (request, response) => {
  const query = getValidated<z.infer<typeof listTicketsQuerySchema>>(response, "query");
  return success(response, await listUnassignedTickets(actorFromRequest(request), query));
};

export const create: RequestHandler = async (request, response) => {
  const input = getValidated<z.infer<typeof createTicketSchema>>(response, "body");
  return success(response, await createTicket(actorFromRequest(request), input), 201);
};

export const detail: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, { ticket: await getTicketDetails(ticketId, actorFromRequest(request)) });
};

export const update: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const input = getValidated<z.infer<typeof updateTicketSchema>>(response, "body");
  return success(response, { ticket: await updateTicket(ticketId, actorFromRequest(request), input) });
};

export const updateStatus: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const input = getValidated<z.infer<typeof updateStatusSchema>>(response, "body");
  return success(response, { ticket: await updateTicketStatus(ticketId, actorFromRequest(request), input.status, input.note) });
};

export const history: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, { history: await listTicketHistory(ticketId, actorFromRequest(request)) });
};

export const uploadAttachment: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const actor = actorFromRequest(request);
  const file = request.file;
  if (!file) throw new ApiError(400, "FILE_REQUIRED", "Choose one attachment to upload.");
  const detected = await fileTypeFromBuffer(file.buffer);
  if (!detected || !["image/png", "image/jpeg", "application/pdf"].includes(detected.mime)) {
    throw new ApiError(400, "INVALID_FILE_CONTENT", "The file content does not match an accepted PNG, JPEG, or PDF type.");
  }
  const storageKey = `${randomUUID()}.${detected.ext}`;
  const uploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);
  await mkdir(uploadDirectory, { recursive: true, mode: 0o700 });
  const absolutePath = path.resolve(uploadDirectory, storageKey);
  if (path.dirname(absolutePath) !== uploadDirectory) {
    throw new ApiError(400, "INVALID_FILE_NAME", "The attachment name is invalid.");
  }
  await writeFile(absolutePath, file.buffer, { flag: "wx", mode: 0o600 });
  try {
    const originalName = path.basename(file.originalname).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 255);
    const attachment = await addAttachmentRecord(ticketId, actor, {
      originalName: originalName || `attachment.${detected.ext}`,
      storageKey,
      mimeType: detected.mime,
      sizeBytes: file.size,
    });
    return success(response, { attachment }, 201);
  } catch (error) {
    try {
      await unlink(absolutePath);
    } catch (cleanupError) {
      const errorName = cleanupError instanceof Error ? cleanupError.name : "UnknownError";
      logger.error("attachment.cleanup.failed", { errorName, ticketId });
    }
    throw error;
  }
};

export const downloadAttachment: RequestHandler = async (request, response) => {
  const { ticketId, attachmentId } = getValidated<z.infer<typeof attachmentParamsSchema>>(response, "params");
  const attachment = await getAttachment(ticketId, attachmentId, actorFromRequest(request));
  if (!/^[0-9a-f-]{36}\.(png|jpg|pdf)$/i.test(attachment.storageKey)) {
    throw new ApiError(500, "ATTACHMENT_STORAGE_ERROR", "The attachment could not be located.");
  }
  const uploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const absolutePath = path.resolve(uploadDirectory, attachment.storageKey);
  if (path.dirname(absolutePath) !== uploadDirectory) {
    throw new ApiError(500, "ATTACHMENT_STORAGE_ERROR", "The attachment could not be located.");
  }
  try {
    await stat(absolutePath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new ApiError(404, "ATTACHMENT_FILE_NOT_FOUND", "The attachment file is no longer available.");
    }
    throw error;
  }
  response.type(attachment.mimeType);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.download(absolutePath, attachment.originalName);
};

export const similar: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, await findSimilarTickets(ticketId, actorFromRequest(request)));
};

export const resolutionSuggestions: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, await suggestResolutions(ticketId, actorFromRequest(request)));
};

export const saveResolutionForTicket: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  const input = getValidated<z.infer<typeof resolutionSchema>>(response, "body");
  const actor = actorFromRequest(request);
  return success(response, { resolution: await saveResolution(ticketId, actor.userId, input, actor) }, 201);
};

export const feedback: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketFeedbackParamsSchema>>(response, "params");
  const input = getValidated<z.infer<typeof feedbackSchema>>(response, "body");
  return success(response, { feedback: await submitFeedback(ticketId, actorFromRequest(request), input) }, 201);
};

export const confirmResolution: RequestHandler = async (request, response) => {
  const { ticketId } = getValidated<z.infer<typeof ticketParamsSchema>>(response, "params");
  return success(response, {
    ticket: await confirmTicketResolution(ticketId, actorFromRequest(request)),
  });
};

