import {
  NotificationType,
  TicketHistoryAction,
  TicketPriority,
  TicketStatus,
  UserRole,
  AssignmentSource,
  AssignmentStatus,
} from "@prisma/client";
import { prisma } from "../config/database.js";
import { ApiError } from "../utils/api-response.js";
import {
  emitToAdministrators,
  emitToTicket,
  emitToUser,
  retainAssignedAgentInTicketRoom,
} from "../sockets/realtime.js";
import { createNotification } from "./notification.service.js";
import { assertTicketAccess, type TicketActor } from "./ticket-access.service.js";
import { assignmentRecommendations as getIntelligentRecommendations } from "./intelligent-assignment.service.js";

type AssignInput = { agentId: string; note?: string };

export async function assignTicket(ticketId: string, actor: TicketActor, input: AssignInput) {
  if (actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Only administrators can assign or reassign tickets.");
  }
  const [ticket, agent] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: ticketId } }),
    prisma.user.findUnique({ where: { id: input.agentId }, select: { id: true, fullName: true, role: true, isActive: true } }),
  ]);
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (!agent || agent.role !== UserRole.AGENT || !agent.isActive) {
    throw new ApiError(400, "INVALID_ASSIGNEE", "Choose an active agent account.");
  }
  if (ticket.assignedAgentId === agent.id) {
    throw new ApiError(409, "ALREADY_ASSIGNED", "This ticket is already assigned to that agent.");
  }
  const previousAgentId = ticket.assignedAgentId;
  const action = previousAgentId ? TicketHistoryAction.REASSIGNED : TicketHistoryAction.ASSIGNED;
  const updated = await prisma.$transaction(async (transaction) => {
    const changed = await transaction.ticket.updateMany({
      where: { id: ticketId, assignedAgentId: previousAgentId },
      data: { assignedAgentId: agent.id },
    });
    if (!changed.count) {
      throw new ApiError(409, "TICKET_ASSIGNMENT_CHANGED", "The ticket assignment changed. Refresh and try again.");
    }
    await transaction.ticketAssignment.create({
      data: {
        ticketId,
        assignedToId: agent.id,
        assignedById: actor.userId,
        previousAgentId,
        note: input.note,
        reason: input.note ? `Administrator override: ${input.note}` : "Manually assigned by an administrator.",
        source: AssignmentSource.MANUAL,
      },
    });
    await transaction.ticketAnalysis.updateMany({
      where: { ticketId },
      data: {
        assignmentStatus: AssignmentStatus.ASSIGNED,
        assignmentReason: input.note ? `Administrator override: ${input.note}` : "Manually assigned by an administrator.",
      },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action,
        metadata: { fromAgentId: previousAgentId, toAgentId: agent.id, note: input.note },
      },
    });
    return transaction.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  });

  const reassigned = Boolean(previousAgentId);
  const notificationType = reassigned ? NotificationType.TICKET_REASSIGNED : NotificationType.TICKET_ASSIGNED;
  await createNotification({
    userId: agent.id,
    ticketId,
    type: notificationType,
    title: `${reassigned ? "Ticket reassigned" : "New ticket assigned"} · ${ticket.ticketCode}`,
    body: `${ticket.subject}${input.note ? ` — ${input.note}` : ""}`,
  });
  if (previousAgentId) {
    await createNotification({
      userId: previousAgentId,
      ticketId,
      type: NotificationType.TICKET_REASSIGNED,
      title: `Ticket reassigned · ${ticket.ticketCode}`,
      body: `The ticket is now assigned to ${agent.fullName}.`,
    });
  }
  await createNotification({
    userId: ticket.customerId,
    ticketId,
    type: notificationType,
    title: `Support specialist assigned · ${ticket.ticketCode}`,
    body: `Your ticket is now assigned to ${agent.fullName}.`,
  });
  const event = { ticketId, ticketCode: ticket.ticketCode, agentId: agent.id, agentName: agent.fullName, updatedAt: updated.updatedAt };
  retainAssignedAgentInTicketRoom(ticketId, agent.id);
  emitToTicket(ticketId, "ticket:assigned", event);
  emitToUser(agent.id, "assignment:new", event);
  emitToAdministrators("ticket:assigned", event);
  return { ...event, previousAgentId, reassigned };
}

export async function claimTicket(ticketId: string, actor: TicketActor) {
  if (actor.role !== UserRole.AGENT) {
    throw new ApiError(403, "FORBIDDEN", "Only agents can claim a ticket from the authorized unassigned queue.");
  }
  await assertTicketAccess(ticketId, actor);
  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.ticket.updateMany({
      where: { id: ticketId, assignedAgentId: null },
      data: { assignedAgentId: actor.userId },
    });
    if (!result.count) throw new ApiError(409, "TICKET_ALREADY_ASSIGNED", "Another agent has already claimed this ticket.");
    await transaction.ticketAssignment.create({
      data: {
        ticketId,
        assignedToId: actor.userId,
        assignedById: actor.userId,
        note: "Claimed from authorized queue.",
        source: AssignmentSource.CLAIM,
        reason: "Claimed by an authorized agent.",
      },
    });
    await transaction.ticketAnalysis.updateMany({
      where: { ticketId },
      data: { assignmentStatus: AssignmentStatus.ASSIGNED, assignmentReason: "Claimed by an authorized agent." },
    });
    await transaction.ticketHistory.create({
      data: { ticketId, actorId: actor.userId, action: TicketHistoryAction.ASSIGNED, metadata: { claimed: true } },
    });
    return transaction.ticket.findUniqueOrThrow({ where: { id: ticketId }, select: { ticketCode: true, customerId: true, updatedAt: true } });
  });
  await createNotification({
    userId: updated.customerId,
    ticketId,
    type: NotificationType.TICKET_ASSIGNED,
    title: `Support specialist assigned · ${updated.ticketCode}`,
    body: "A support specialist has picked up your ticket.",
  });
  const event = { ticketId, ticketCode: updated.ticketCode, agentId: actor.userId, updatedAt: updated.updatedAt };
  retainAssignedAgentInTicketRoom(ticketId, actor.userId);
  emitToTicket(ticketId, "ticket:assigned", event);
  emitToAdministrators("ticket:assigned", event);
  return event;
}

export async function escalateTicket(ticketId: string, actor: TicketActor, note: string) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Only support staff can escalate a ticket.");
  }
  await assertTicketAccess(ticketId, actor);
  const current = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!current) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (current.status === TicketStatus.RESOLVED || current.status === TicketStatus.CLOSED) {
    throw new ApiError(409, "TICKET_NOT_ACTIVE", "Resolved or closed tickets cannot be escalated.");
  }
  const nextPriority = current.priority === TicketPriority.LOW ? TicketPriority.MEDIUM
    : current.priority === TicketPriority.MEDIUM ? TicketPriority.HIGH
      : TicketPriority.CRITICAL;
  const escalation = await prisma.$transaction(async (transaction) => {
    const policy = await transaction.sLAPolicy.findUnique({
      where: { domain_priority: { domain: current.domain, priority: nextPriority } },
    });
    if (!policy?.isActive) {
      throw new ApiError(503, "SLA_POLICY_UNAVAILABLE", "No active SLA policy is configured for the escalated priority.");
    }
    const ticket = await transaction.ticket.update({
      where: { id: ticketId },
      data: {
        priority: nextPriority,
        escalationLevel: { increment: 1 },
      },
    });
    const slaRecord = await transaction.sLARecord.findUnique({ where: { ticketId } });
    if (slaRecord) {
      const firstResponseDueAt = new Date(current.createdAt.getTime() + policy.firstResponseMinutes * 60_000);
      await transaction.sLARecord.update({
        where: { ticketId },
        data: {
          policyId: policy.id,
          ...(slaRecord.firstResponseAt === null ? {
            firstResponseDueAt,
            firstResponseBreached: new Date() > firstResponseDueAt,
          } : {}),
          resolutionDueAt: new Date(current.createdAt.getTime() + policy.resolutionMinutes * 60_000),
        },
      });
    }
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: TicketHistoryAction.ESCALATED,
        metadata: { note, previousPriority: current.priority, priority: nextPriority, escalationLevel: ticket.escalationLevel },
      },
    });
    return ticket;
  });
  const body = `Your support request has been escalated for additional attention.`;
  await createNotification({
    userId: current.customerId,
    ticketId,
    type: NotificationType.ESCALATION,
    title: `Ticket escalated · ${current.ticketCode}`,
    body,
  });
  await createNotification({
    userId: escalation.assignedAgentId ?? actor.userId,
    ticketId,
    type: NotificationType.ESCALATION,
    title: `Escalated ticket · ${current.ticketCode}`,
    body: note,
  });
  const event = {
    ticketId,
    ticketCode: current.ticketCode,
    priority: escalation.priority,
    escalationLevel: escalation.escalationLevel,
  };
  emitToTicket(ticketId, "ticket:escalated", event);
  emitToAdministrators("ticket:escalated", event);
  return event;
}

export async function assignmentRecommendations(ticketId: string, actor: TicketActor) {
  return getIntelligentRecommendations(ticketId, actor);
}
