import type { RequestHandler, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/api-response.js";

type ValidationTarget = "body" | "query" | "params";

export const validate = (schema: ZodType, target: ValidationTarget = "body"): RequestHandler => {
  return (request, response, next) => {
    const result = schema.safeParse(request[target]);
    if (!result.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "The request contains invalid fields.",
        result.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      );
    }

    const validated = response.locals.validated as Partial<Record<ValidationTarget, unknown>> | undefined;
    response.locals.validated = { ...validated, [target]: result.data };
    next();
  };
};

export function getValidated<T>(response: Response, target: ValidationTarget): T {
  const values = response.locals.validated as Partial<Record<ValidationTarget, unknown>> | undefined;
  const value = values?.[target];
  if (value === undefined) {
    throw new ApiError(500, "VALIDATION_PIPELINE_ERROR", "Request validation was not applied.");
  }
  return value as T;
}
