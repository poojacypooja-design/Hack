import { createHash } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { allowedWebOrigin } from "../config/cors.js";
import { logger } from "../utils/logger.js";
import { registerTicketSocketHandlers } from "./ticket.socket.js";
import { setSocketServer } from "./realtime.js";

function getCookieValue(header: string, name: string) {
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return undefined;
}

export function initializeSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: allowedWebOrigin, credentials: true, methods: ["GET", "POST"] },
    maxHttpBufferSize: 1_000_000,
  });

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie ?? "";
      const token = getCookieValue(cookieHeader, env.SESSION_COOKIE_NAME);
      if (!token || token.length < 32) {
        next(new Error("Authentication required."));
        return;
      }
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: { select: { id: true, email: true, role: true, isActive: true } } },
      });
      if (!session || session.expiresAt <= new Date() || !session.user.isActive) {
        next(new Error("Authentication required."));
        return;
      }
      socket.data.auth = {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role,
        sessionId: session.id,
        expiresAt: session.expiresAt,
      };
      next();
    } catch (error) {
      logger.warn("socket.authentication.failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      next(new Error("Authentication could not be verified."));
    }
  });

  io.on("connection", (socket) => {
    const auth = socket.data.auth as { userId: string; role: string; sessionId: string; expiresAt: Date };
    void socket.join(`user:${auth.userId}`);
    void socket.join(`session:${auth.sessionId}`);
    if (auth.role === "ADMIN") void socket.join("role:ADMIN");
    if (auth.role === "AGENT") void socket.join("role:AGENT");
    registerTicketSocketHandlers(socket);

    let expiryTimer: ReturnType<typeof setTimeout>;
    socket.once("disconnect", () => clearTimeout(expiryTimer));
    const disconnectAtExpiry = () => {
      const remaining = auth.expiresAt.getTime() - Date.now();
      if (remaining <= 0) {
        socket.disconnect(true);
        return;
      }
      expiryTimer = setTimeout(disconnectAtExpiry, Math.min(remaining, 2_000_000_000));
    };
    disconnectAtExpiry();
  });

  setSocketServer(io);
  return io;
}
