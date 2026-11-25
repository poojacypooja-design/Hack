import { createHash } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { ApiError } from "../utils/api-response.js";
import { disconnectSession } from "../sockets/realtime.js";

export const requireAuth: RequestHandler = async (request, _response, next) => {
  const token: unknown = request.cookies?.[env.SESSION_COOKIE_NAME];
  if (typeof token !== "string" || token.length < 32) {
    throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
      disconnectSession(session.id);
    }
    throw new ApiError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }

  request.auth = {
    userId: session.user.id,
    role: session.user.role,
    email: session.user.email,
    sessionId: session.id,
  };
  next();
};
