import { TicketHistoryAction, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { ApiError } from "../utils/api-response.js";
import { assertTicketAccess, authorizedUnassignedWhere, type TicketActor } from "./ticket-access.service.js";
import { ticketTextSimilarity } from "./issue-dna.service.js";

export async function suggestResolutions(ticketId: string, actor: TicketActor) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Resolution memory is available to agents and administrators.");
  }
  await assertTicketAccess(ticketId, actor);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, subject: true, description: true, domain: true, category: true },
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  const skills = actor.role === UserRole.AGENT
    ? await authorizedUnassignedWhere(actor.userId)
    : [];
  const agentAccess = actor.role === UserRole.AGENT
    ? {
      OR: [
        { assignedAgentId: actor.userId },
        ...(skills.length
          ? [{ assignedAgentId: null, OR: skills }]
          : []),
      ],
    }
    : undefined;
  const knowledge = await prisma.resolutionKnowledge.findMany({
    where: {
      ticketId: { not: ticketId },
      domain: ticket.domain,
      OR: [
        { category: ticket.category },
        { tags: { hasSome: ticket.category.toLowerCase().split(/\s+/) } },
      ],
      ticket: {
        status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
        ...(agentAccess ?? {}),
      },
    },
    select: {
      id: true,
      ticketId: true,
      title: true,
      issueSummary: true,
      solution: true,
      category: true,
      tags: true,
      createdAt: true,
      ticket: { select: { ticketCode: true, resolvedAt: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  const suggestions = knowledge
    .map((item) => {
      const textScore = ticketTextSimilarity(
        `${ticket.subject} ${ticket.description}`,
        `${item.title} ${item.issueSummary} ${item.tags.join(" ")}`,
      );
      const categoryBonus = item.category === ticket.category ? 0.25 : 0;
      return {
        ...item,
        similarity: Math.min(1, textScore * 0.75 + categoryBonus),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10)
    .map(({ similarity, ...item }) => ({ ...item, similarity: Math.round(similarity * 100) }));
  return {
    ticketId,
    method: "Historical resolved knowledge ranked by transparent token overlap and category match.",
    suggestions,
  };
}

export async function saveResolution(
  ticketId: string,
  authorId: string,
  input: { title: string; issueSummary: string; solution: string; tags: string[] },
  actor: TicketActor,
) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Only agents and administrators can save resolution knowledge.");
  }
  await assertTicketAccess(ticketId, actor);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED) {
    throw new ApiError(409, "TICKET_NOT_RESOLVED", "Resolve the ticket before adding it to Resolution Memory.");
  }
  return prisma.$transaction(async (transaction) => {
    const knowledge = await transaction.resolutionKnowledge.upsert({
      where: { ticketId },
      update: {
        authorId,
        title: input.title,
        issueSummary: input.issueSummary,
        solution: input.solution,
        tags: input.tags,
      },
      create: {
        ticketId,
        authorId,
        title: input.title,
        issueSummary: input.issueSummary,
        solution: input.solution,
        domain: ticket.domain,
        category: ticket.category,
        tags: input.tags,
      },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: authorId,
        action: TicketHistoryAction.RESOLUTION_SAVED,
        metadata: { knowledgeId: knowledge.id },
      },
    });
    return knowledge;
  });
}
