import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { corsOptions } from "./config/cors.js";
import { prisma } from "./config/database.js";
import { requestIdMiddleware, errorMiddleware, notFoundMiddleware } from "./middleware/error.middleware.js";
import { logger } from "./utils/logger.js";
import { startSlaMonitoring } from "./services/sla.service.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import ticketRoutes from "./routes/ticket.routes.js";
import assignmentRoutes from "./routes/assignment.routes.js";
import messageRoutes from "./routes/message.routes.js";
import slaRoutes from "./routes/sla.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import incidentRoutes from "./routes/incident.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import { initializeSocketServer } from "./sockets/socket.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(requestIdMiddleware);
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return response.status(200).json({ success: true, data: { status: "ok", database: "connected" } });
  } catch (error) {
    logger.error("health.database_unavailable", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return response.status(503).json({
      success: false,
      data: { status: "degraded", database: "unavailable" },
      error: { code: "DATABASE_UNAVAILABLE", message: "The database is currently unavailable." },
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/sla", slaRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const httpServer = createServer(app);
const io = initializeSocketServer(httpServer);
const slaTimer = startSlaMonitoring();

httpServer.listen(env.PORT, () => {
  logger.info("server.started", { port: env.PORT, environment: env.NODE_ENV });
});

let isShuttingDown = false;
async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info("server.shutdown.started", { signal });
  clearInterval(slaTimer);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await prisma.$disconnect();
  logger.info("server.shutdown.completed", { signal });
}

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });

httpServer.on("error", (error) => {
  logger.error("server.listen.failed", { errorName: error.name });
  process.exitCode = 1;
});
