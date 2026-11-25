import type { ErrorRequestHandler, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-response.js";
import { logger } from "../utils/logger.js";

export const requestIdMiddleware: RequestHandler = (request, response, next) => {
  const requestId = randomUUID();
  request.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  next();
};

export const notFoundMiddleware: RequestHandler = (request, _response, next) => {
  next(new ApiError(404, "ROUTE_NOT_FOUND", `No route matches ${request.method} ${request.path}.`));
};

export const errorMiddleware: ErrorRequestHandler = (error: unknown, request, response, _next) => {
  let apiError: ApiError;

  if (error instanceof ApiError) {
    apiError = error;
  } else if (error instanceof ZodError) {
    apiError = new ApiError(
      400,
      "VALIDATION_ERROR",
      "The request contains invalid fields.",
      error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    );
  } else if (error instanceof multer.MulterError) {
    apiError = new ApiError(
      error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      "UPLOAD_ERROR",
      error.code === "LIMIT_FILE_SIZE" ? "The attachment exceeds the upload limit." : "The attachment could not be accepted.",
    );
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    apiError = error.code === "P2002"
      ? new ApiError(409, "CONFLICT", "A record with those details already exists.")
      : error.code === "P2025"
        ? new ApiError(404, "RECORD_NOT_FOUND", "The requested record was not found.")
        : new ApiError(500, "DATABASE_ERROR", "The request could not be completed.");
  } else {
    apiError = new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
    const errorName = error instanceof Error ? error.name : "UnknownError";
    logger.error("request.failed", { requestId: request.requestId, errorName });
  }

  response.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
    requestId: request.requestId,
  });
};
