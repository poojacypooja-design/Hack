import type { Server } from "socket.io";

let socketServer: Server | undefined;

export function setSocketServer(server: Server) {
  socketServer = server;
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  socketServer?.to(`user:${userId}`).emit(event, payload);
}

export function emitToTicket(ticketId: string, event: string, payload: unknown) {
  socketServer?.to(`ticket:${ticketId}`).emit(event, payload);
}

export function emitToAdministrators(event: string, payload: unknown) {
  socketServer?.to("role:ADMIN").emit(event, payload);
}

export function disconnectSession(sessionId: string) {
  socketServer?.in(`session:${sessionId}`).disconnectSockets(true);
}

export function disconnectUser(userId: string) {
  socketServer?.in(`user:${userId}`).disconnectSockets(true);
}

export function retainAssignedAgentInTicketRoom(ticketId: string, agentId: string) {
  const ticketRoom = `ticket:${ticketId}`;
  socketServer?.in("role:AGENT").socketsLeave(ticketRoom);
  socketServer?.in(`user:${agentId}`).socketsJoin(ticketRoom);
}

export function removeAgentsFromTicketRoom(ticketId: string) {
  socketServer?.in("role:AGENT").socketsLeave(`ticket:${ticketId}`);
}
