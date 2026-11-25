import type { CorsOptions } from "cors";
import { env } from "./env.js";
import { ApiError } from "../utils/api-response.js";

export const allowedWebOrigin = (env.FRONTEND_URL ?? env.WEB_ORIGIN).replace(/\/+$/, "");

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin || origin.replace(/\/+$/, "") === allowedWebOrigin) {
      callback(null, true);
      return;
    }

    callback(new ApiError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Request-Id"],
  maxAge: 600,
};
