import { ticketParamsSchema } from "../utils/schemas.js";
import { ApiError } from "../utils/api-response.js";
import { assertTicketAccess, type TicketActor } from "../services/ticket-access.service.js";
import { logger } from "../utils/logger.js";
import type { Socket } from "socket.io";

type Acknowledge = (result: { success: boolean; message?: string }) => void;

export function registerTicketSocketHandlers(socket: Socket) {
  const joinedTicketRooms = new Set<string>();
  const actor = socket.data.auth as TicketActor;

  socket.on("ticket:join", (payload: unknown, acknowledge?: Acknowledge) => {
    void (async () => {
      try {
        const parsed = ticketParamsSchema.safeParse(payload);
        if (!parsed.success) throw new ApiError(400, "INVALID_TICKET_ID", "A valid ticket ID is required.");
        await assertTicketAccess(parsed.data.ticketId, actor);
        await socket.join(`ticket:${parsed.data.ticketId}`);
        joinedTicketRooms.add(parsed.data.ticketId);
        acknowledge?.({ success: true });
      } catch (error) {
        if (!(error instanceof ApiError)) {
          logger.error("socket.ticket_join.failed", {
            socketId: socket.id,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
        }
        acknowledge?.({
          success: false,
          message: error instanceof ApiError ? error.message : "The ticket room could not be joined.",
        });
      }
    })();
  });

  socket.on("ticket:leave", (payload: unknown, acknowledge?: Acknowledge) => {
    const parsed = ticketParamsSchema.safeParse(payload);
    if (!parsed.success || !joinedTicketRooms.has(parsed.data.ticketId)) {
      acknowledge?.({ success: false, message: "You have not joined that ticket room." });
      return;
    }
    joinedTicketRooms.delete(parsed.data.ticketId);
    void socket.leave(`ticket:${parsed.data.ticketId}`);
    acknowledge?.({ success: true });
  });
}
