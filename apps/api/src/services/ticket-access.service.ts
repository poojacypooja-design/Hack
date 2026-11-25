import { TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { ApiError } from "../utils/api-response.js";

export type TicketActor = {
  userId: string;
  role: UserRole;
};

const activeStatuses: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_FOR_CUSTOMER,
];

export async function canAccessTicket(ticketId: string, actor: TicketActor): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { customerId: true, assignedAgentId: true, domain: true, category: true },
  });
  if (!ticket) return false;
  if (actor.role === UserRole.ADMIN) return true;
  if (actor.role === UserRole.CUSTOMER) return ticket.customerId === actor.userId;
  if (ticket.assignedAgentId === actor.userId) return true;
  if (ticket.assignedAgentId !== null) return false;
  const skill = await prisma.agentSkill.findFirst({
    where: { userId: actor.userId, domain: ticket.domain, category: ticket.category },
    select: { id: true },
  });
  return Boolean(skill);
}

export async function assertTicketAccess(ticketId: string, actor: TicketActor) {
  const allowed = await canAccessTicket(ticketId, actor);
  if (!allowed) {
    throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  }
}

export async function authorizedUnassignedWhere(agentId: string) {
  const skills = await prisma.agentSkill.findMany({
    where: { userId: agentId },
    select: { domain: true, category: true },
  });
  return skills.map((skill) => ({ domain: skill.domain, category: skill.category }));
}

export function activeTicketStatuses() {
  return activeStatuses;
}
