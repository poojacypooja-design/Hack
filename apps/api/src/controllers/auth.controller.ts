import type { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { getValidated } from "../middleware/validation.middleware.js";
import { getProfile, login as authenticate, registerCustomer, revokeSessionToken, updateProfile } from "../services/auth.service.js";
import { ApiError, success } from "../utils/api-response.js";
import type { LoginInput, RegisterInput } from "../utils/schemas.js";

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function setSessionCookie(response: Parameters<RequestHandler>[1], token: string, expiresAt: Date) {
  response.cookie(env.SESSION_COOKIE_NAME, token, {
    ...cookieOptions,
    expires: expiresAt,
  });
}

export const register: RequestHandler = async (_request, response) => {
  const input = getValidated<RegisterInput>(response, "body");
  const session = await registerCustomer(input);
  setSessionCookie(response, session.token, session.expiresAt);
  return success(response, { user: session.user }, 201);
};

export function login(expectedRole?: UserRole): RequestHandler {
  return async (_request, response) => {
    const input = getValidated<LoginInput>(response, "body");
    const session = await authenticate(input, expectedRole);
    setSessionCookie(response, session.token, session.expiresAt);
    return success(response, { user: session.user, expiresAt: session.expiresAt });
  };
}

export const logout: RequestHandler = async (request, response) => {
  await revokeSessionToken(request.cookies?.[env.SESSION_COOKIE_NAME]);
  response.clearCookie(env.SESSION_COOKIE_NAME, cookieOptions);
  return success(response, { message: "Signed out." });
};

export const me: RequestHandler = async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return success(response, { user: await getProfile(userId) });
};

export const updateMe: RequestHandler = async (request, response) => {
  const userId = request.auth?.userId;
  if (!userId) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  return success(response, { user: await updateProfile(userId, getValidated(response, "body")) });
};
