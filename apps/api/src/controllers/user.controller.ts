import type { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { getValidated } from "../middleware/validation.middleware.js";
import {
  listUsers,
  provisionAgent,
  setAgentAvailability,
  setUserActive,
  updateAgentAssignmentProfile,
} from "../services/user.service.js";
import { ApiError, getPublicUser, success } from "../utils/api-response.js";
import type { z } from "zod";
import {
  agentAssignmentProfileSchema,
  agentAvailabilitySchema,
  paginationQuerySchema,
  userListQuerySchema,
  userParamsSchema,
  userStatusSchema,
  provisionAgentSchema,
} from "../utils/schemas.js";

export const list: RequestHandler = async (_request, response) => {
  const query = getValidated<z.infer<typeof userListQuerySchema>>(response, "query");
  return success(response, await listUsers(query.page, query.limit, query.role as UserRole | undefined, query.search));
};

export const customers: RequestHandler = async (_request, response) => {
  const query = getValidated<z.infer<typeof paginationQuerySchema>>(response, "query");
  return success(response, await listUsers(query.page, query.limit, UserRole.CUSTOMER));
};

export const detail: RequestHandler = async (_request, response) => {
  const { userId } = getValidated<z.infer<typeof userParamsSchema>>(response, "params");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      phone: true,
      company: true,
      preferredDomain: true,
      isActive: true,
      isAvailable: true,
      createdAt: true,
      skills: { select: { domain: true, category: true, skillLevel: true, skillTags: true } },
      _count: { select: { customerTickets: true, assignedTickets: true } },
    },
  });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "The user account was not found.");
  return success(response, { user });
};

export const createAgent: RequestHandler = async (_request, response) => {
  const input = getValidated<z.infer<typeof provisionAgentSchema>>(response, "body");
  const agent = await provisionAgent(input);
  return success(response, { user: agent }, 201);
};

export const updateStatus: RequestHandler = async (request, response) => {
  const actorId = request.auth?.userId;
  const { userId } = getValidated<z.infer<typeof userParamsSchema>>(response, "params");
  const { isActive } = getValidated<z.infer<typeof userStatusSchema>>(response, "body");
  if (!actorId) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  if (actorId === userId && !isActive) {
    throw new ApiError(400, "SELF_DEACTIVATION_NOT_ALLOWED", "Administrators cannot deactivate their own account.");
  }
  return success(response, { user: await setUserActive(userId, isActive) });
};

export const updateAvailability: RequestHandler = async (request, response) => {
  const { isAvailable } = getValidated<z.infer<typeof agentAvailabilitySchema>>(response, "body");
  if (!request.auth) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return success(response, { user: await setAgentAvailability(request.auth.userId, isAvailable) });
};

export const updateAssignmentProfile: RequestHandler = async (request, response) => {
  const { userId } = getValidated<z.infer<typeof userParamsSchema>>(response, "params");
  const input = getValidated<z.infer<typeof agentAssignmentProfileSchema>>(response, "body");
  return success(response, { user: await updateAgentAssignmentProfile(userId, input) });
};

export const publicUser = getPublicUser;
