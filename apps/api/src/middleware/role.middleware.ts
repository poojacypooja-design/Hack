import type { RequestHandler } from "express";
import type { UserRole } from "@prisma/client";
import { ApiError } from "../utils/api-response.js";

export function requireRoles(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth || !roles.includes(request.auth.role)) {
      throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
    }
    next();
  };
}
