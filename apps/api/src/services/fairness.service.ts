import { TicketPriority, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { assertTicketAccess, activeTicketStatuses, type TicketActor } from "./ticket-access.service.js";
import { ApiError } from "../utils/api-response.js";

type RecommendationInput = {
  ticketId: string;
  actor: TicketActor;
};

export async function recommendAgents({ ticketId, actor }: RecommendationInput) {
  if (actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Only administrators can view organization-wide assignment recommendations.");
  }
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, domain: true, category: true, priority: true, description: true, assignedAgentId: true },
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (ticket.assignedAgentId) {
    throw new ApiError(409, "TICKET_ALREADY_ASSIGNED", "Assignment recommendations are available for unassigned tickets.");
  }

  const activeStatuses = activeTicketStatuses();
  const [agents, assigned] = await Promise.all([
    prisma.user.findMany({
      where: { role: UserRole.AGENT, isActive: true },
      select: {
        id: true,
        fullName: true,
        skills: { where: { domain: ticket.domain, category: ticket.category }, select: { skillLevel: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { assignedAgentId: { not: null }, status: { in: activeStatuses } },
      select: { assignedAgentId: true, priority: true },
    }),
  ]);
  const workload = new Map<string, { active: number; urgent: number }>();
  for (const ticketItem of assigned) {
    if (!ticketItem.assignedAgentId) continue;
    const counts = workload.get(ticketItem.assignedAgentId) ?? { active: 0, urgent: 0 };
    counts.active += 1;
    if (ticketItem.priority === TicketPriority.CRITICAL || ticketItem.priority === TicketPriority.HIGH) counts.urgent += 1;
    workload.set(ticketItem.assignedAgentId, counts);
  }

  const complexityWeight = Math.min(5, Math.max(1, Math.ceil(ticket.description.length / 700)));
  const recommendations = agents.map((agent) => {
    const load = workload.get(agent.id) ?? { active: 0, urgent: 0 };
    const skillLevel = agent.skills[0]?.skillLevel ?? 0;
    const score = Math.max(0, Math.min(100,
      100
      - load.active * 4
      - load.urgent * 7
      - complexityWeight * 2
      + skillLevel * 8,
    ));
    const reasons = [
      skillLevel ? `Matching domain skill (level ${skillLevel}/5)` : "No exact category skill on record",
      `${load.active} active tickets`,
      `${load.urgent} high/critical tickets`,
    ];
    return {
      agentId: agent.id,
      name: agent.fullName,
      activeTickets: load.active,
      urgentTickets: load.urgent,
      skillLevel,
      score,
      reasons,
    };
  }).sort((a, b) => b.score - a.score || a.activeTickets - b.activeTickets || a.name.localeCompare(b.name));

  return {
    ticketId: ticket.id,
    complexityWeight,
    method: "Transparent score: skill match +8 per level, minus 4 per active ticket, 7 per urgent ticket, and 2 per complexity point.",
    recommendations,
  };
}

export async function getAgentWorkloads() {
  const activeStatuses = activeTicketStatuses();
  const agents = await prisma.user.findMany({
    where: { role: UserRole.AGENT, isActive: true },
    select: { id: true, fullName: true, skills: { select: { domain: true, category: true, skillLevel: true } } },
    orderBy: { fullName: "asc" },
  });
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: activeStatuses }, assignedAgentId: { not: null } },
    select: { assignedAgentId: true, priority: true },
  });
  return agents.map((agent) => {
    const assigned = tickets.filter((ticket) => ticket.assignedAgentId === agent.id);
    return {
      agentId: agent.id,
      name: agent.fullName,
      activeTickets: assigned.length,
      urgentTickets: assigned.filter((ticket) => ticket.priority === TicketPriority.CRITICAL || ticket.priority === TicketPriority.HIGH).length,
      skills: agent.skills,
    };
  });
}
