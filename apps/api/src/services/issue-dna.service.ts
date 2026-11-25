import { IncidentStatus, TicketHistoryAction, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { ApiError } from "../utils/api-response.js";
import { assertTicketAccess, type TicketActor } from "./ticket-access.service.js";

const stopWords = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being",
  "could", "does", "during", "from", "have", "into", "just", "more", "most", "not", "our",
  "same", "that", "their", "there", "they", "this", "those", "through", "under", "very",
  "was", "were", "what", "when", "where", "which", "with", "would", "your",
]);

export function normalizeTicketText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function ticketTextSimilarity(left: string, right: string) {
  const leftTokens = new Set(normalizeTicketText(left));
  const rightTokens = new Set(normalizeTicketText(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  const unionSize = leftTokens.size + rightTokens.size - intersection;
  return unionSize ? intersection / unionSize : 0;
}

function calculateTicketSimilarity(
  base: { subject: string; description: string; category: string; domain: string },
  candidate: { subject: string; description: string; category: string; domain: string },
) {
  const subjectScore = ticketTextSimilarity(base.subject, candidate.subject);
  const descriptionScore = ticketTextSimilarity(base.description, candidate.description);
  const score = Math.min(1,
    subjectScore * 0.45
    + descriptionScore * 0.4
    + (base.category === candidate.category ? 0.1 : 0)
    + (base.domain === candidate.domain ? 0.05 : 0),
  );
  return {
    score,
    matchedSignals: [
      ...(base.category === candidate.category ? ["same category"] : []),
      ...(base.domain === candidate.domain ? ["same operating domain"] : []),
      ...(subjectScore >= 0.2 ? ["related subject terms"] : []),
      ...(descriptionScore >= 0.2 ? ["related description terms"] : []),
    ],
  };
}

export async function findSimilarTickets(ticketId: string, actor: TicketActor, threshold = 0.25) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Issue DNA is available to agents and administrators.");
  }
  await assertTicketAccess(ticketId, actor);
  const base = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, subject: true, description: true, category: true, domain: true },
  });
  if (!base) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  const authorizedSkills = actor.role === UserRole.AGENT
    ? await prisma.agentSkill.findMany({
      where: { userId: actor.userId, domain: base.domain },
      select: { category: true },
    })
    : [];
  const candidates = await prisma.ticket.findMany({
    where: {
      id: { not: ticketId },
      domain: base.domain,
      status: { not: TicketStatus.CLOSED },
      ...(actor.role === UserRole.AGENT ? {
        OR: [
          { assignedAgentId: actor.userId },
          ...(authorizedSkills.length ? [{
            assignedAgentId: null,
            category: { in: authorizedSkills.map((skill) => skill.category) },
          }] : []),
        ],
      } : {}),
    },
    select: {
      id: true,
      ticketCode: true,
      subject: true,
      category: true,
      domain: true,
      status: true,
      priority: true,
      createdAt: true,
      description: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const matches = candidates
    .map((candidate) => {
      const { score, matchedSignals } = calculateTicketSimilarity(base, candidate);
      return {
        ticketId: candidate.id,
        ticketCode: candidate.ticketCode,
        subject: candidate.subject,
        category: candidate.category,
        status: candidate.status,
        priority: candidate.priority,
        similarity: Math.round(score * 100),
        matchedSignals,
        createdAt: candidate.createdAt,
      };
    })
    .filter((candidate) => candidate.similarity >= Math.round(threshold * 100))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20);
  return {
    ticketId,
    algorithm: "Jaccard token similarity: 45% subject, 40% description, 10% category, 5% domain.",
    potentialIncident: matches.length >= 2,
    matches,
  };
}

export async function createIncidentGroup(
  input: { ticketIds: string[]; title: string; summary: string },
  actor: TicketActor,
) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Only agents and administrators can group incident reports.");
  }
  const tickets = await prisma.ticket.findMany({
    where: { id: { in: input.ticketIds } },
    select: { id: true, subject: true, description: true, category: true, domain: true, ticketCode: true },
  });
  if (tickets.length !== input.ticketIds.length) {
    throw new ApiError(404, "TICKET_NOT_FOUND", "One or more tickets were not found.");
  }
  await Promise.all(tickets.map((ticket) => assertTicketAccess(ticket.id, actor)));
  if (new Set(tickets.map((ticket) => ticket.domain)).size !== 1) {
    throw new ApiError(400, "MIXED_INCIDENT_DOMAINS", "Tickets in one incident group must share an operating domain.");
  }
  const base = tickets[0];
  if (!base) throw new ApiError(400, "INVALID_INCIDENT_GROUP", "Select at least two tickets.");
  const links = tickets.map((ticket) => ({
    ticketId: ticket.id,
    similarity: ticket.id === base.id ? 1 : calculateTicketSimilarity(base, ticket).score,
  }));
  const group = await prisma.$transaction(async (transaction) => {
    const incident = await transaction.ticketIncidentGroup.create({
      data: {
        title: input.title,
        summary: input.summary,
        createdById: actor.userId,
        status: IncidentStatus.POTENTIAL,
        tickets: { create: links },
      },
    });
    await transaction.ticketHistory.createMany({
      data: tickets.map((ticket) => ({
        ticketId: ticket.id,
        actorId: actor.userId,
        action: TicketHistoryAction.INCIDENT_LINKED,
        metadata: { incidentId: incident.id, incidentTitle: incident.title },
      })),
    });
    return incident;
  });
  return { ...group, relatedTickets: tickets.map((ticket) => ({ id: ticket.id, ticketCode: ticket.ticketCode, subject: ticket.subject })) };
}

export async function listIncidentGroups(actor: TicketActor) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Incident groups are restricted to agents and administrators.");
  }
  const skills = actor.role === UserRole.AGENT
    ? await prisma.agentSkill.findMany({ where: { userId: actor.userId }, select: { domain: true, category: true } })
    : [];
  const ticketAccess = actor.role === UserRole.ADMIN ? undefined : {
      every: {
        ticket: {
          OR: [
            { assignedAgentId: actor.userId },
            ...(skills.length ? [{ assignedAgentId: null, OR: skills }] : []),
          ],
        },
      },
    };
  return prisma.ticketIncidentGroup.findMany({
    where: ticketAccess ? { tickets: ticketAccess } : {},
    include: {
      tickets: {
        include: {
          ticket: { select: { id: true, ticketCode: true, subject: true, status: true, priority: true } },
        },
        orderBy: { similarity: "desc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function reviewIncidentGroup(groupId: string, status: "CONFIRMED" | "RESOLVED", actor: TicketActor) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Only agents and administrators can review incident groups.");
  }
  const group = await prisma.ticketIncidentGroup.findUnique({
    where: { id: groupId },
    include: { tickets: { select: { ticketId: true } } },
  });
  if (!group) throw new ApiError(404, "INCIDENT_NOT_FOUND", "The incident group was not found.");
  await Promise.all(group.tickets.map(({ ticketId }) => assertTicketAccess(ticketId, actor)));
  return prisma.ticketIncidentGroup.update({ where: { id: groupId }, data: { status } });
}
