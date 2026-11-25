import {
  NotificationType,
  TicketHistoryAction,
  TicketPriority,
  TicketStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import {
  emitToAdministrators,
  emitToTicket,
  removeAgentsFromTicketRoom,
  retainAssignedAgentInTicketRoom,
} from "../sockets/realtime.js";
import { ApiError } from "../utils/api-response.js";
import { generateTicketId } from "../utils/generate-ticket-id.js";
import { createNotification, notifyAdministrators } from "./notification.service.js";
import {
  activeTicketStatuses,
  assertTicketAccess,
  authorizedUnassignedWhere,
  type TicketActor,
} from "./ticket-access.service.js";
import type { CreateTicketInput, ListTicketsQuery, UpdateTicketInput } from "../utils/schemas.js";

const assignmentSelect = {
  id: true,
  fullName: true,
  email: true,
} as const;

const categoriesByDomain = {
  HEALTH: ["Appointments", "Telehealth", "Prescription", "Patient records", "Billing"],
  LOGISTICS: ["Fleet tracking", "Delivery status", "Driver app", "Route planning", "Billing"],
  SMART_OPERATIONS: ["Device connectivity", "Sensor alert", "Automation", "Data sync", "Access"],
} as const;

function assertCategory(domain: keyof typeof categoriesByDomain, category: string) {
  if (!(categoriesByDomain[domain] as readonly string[]).includes(category)) {
    throw new ApiError(400, "INVALID_CATEGORY", "Choose a ticket category supported by the selected domain.");
  }
}

function assertActor(actor: TicketActor | undefined): asserts actor is TicketActor {
  if (!actor) throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Please sign in to continue.");
}

export async function createTicket(actor: TicketActor, input: CreateTicketInput) {
  if (actor.role !== UserRole.CUSTOMER) {
    throw new ApiError(403, "CUSTOMER_ACCOUNT_REQUIRED", "Only customer accounts can submit a ticket.");
  }
  assertCategory(input.domain, input.category);
  const created = await prisma.$transaction(async (transaction) => {
    const policy = await transaction.sLAPolicy.findUnique({
      where: { domain_priority: { domain: input.domain, priority: input.priority } },
    });
    if (!policy?.isActive) {
      throw new ApiError(503, "SLA_POLICY_UNAVAILABLE", "No active SLA policy is configured for this ticket.");
    }
    const ticket = await transaction.ticket.create({
      data: {
        ticketCode: generateTicketId(),
        subject: input.subject,
        description: input.description,
        category: input.category,
        domain: input.domain,
        priority: input.priority,
        customerId: actor.userId,
      },
    });
    const now = ticket.createdAt;
    await transaction.sLARecord.create({
      data: {
        ticketId: ticket.id,
        policyId: policy.id,
        firstResponseDueAt: new Date(now.getTime() + policy.firstResponseMinutes * 60_000),
        resolutionDueAt: new Date(now.getTime() + policy.resolutionMinutes * 60_000),
      },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: actor.userId,
        action: TicketHistoryAction.CREATED,
        metadata: { domain: ticket.domain, priority: ticket.priority },
      },
    });
    return ticket;
  });

  const notice = {
    ticketId: created.id,
    type: NotificationType.TICKET_CREATED,
    title: `New ticket · ${created.ticketCode}`,
    body: `A new ${created.priority.toLowerCase()} priority ticket is waiting for assignment.`,
    dedupeKey: `ticket-created:${created.id}`,
  };
  await notifyAdministrators(notice);
  emitToAdministrators("ticket:new", { ticketId: created.id, ticketCode: created.ticketCode });
  return getTicketDetails(created.id, actor);
}

export async function listTickets(actor: TicketActor, query: ListTicketsQuery) {
  assertActor(actor);
  const { page, limit } = query;
  const where: Prisma.TicketWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.domain ? { domain: query.domain } : {}),
    ...(query.search ? {
      OR: [
        { ticketCode: { contains: query.search, mode: "insensitive" } },
        { subject: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
      ],
    } : {}),
  };

  if (actor.role === UserRole.CUSTOMER) {
    where.customerId = actor.userId;
  } else if (actor.role === UserRole.AGENT) {
    if (query.assigned === "unassigned") {
      const skills = await authorizedUnassignedWhere(actor.userId);
      if (!skills.length) return { items: [], total: 0, page, limit };
      where.AND = [
        { assignedAgentId: null },
        { OR: skills },
      ];
    } else {
      where.assignedAgentId = actor.userId;
    }
  } else if (query.assigned === "unassigned") {
    where.assignedAgentId = null;
  } else if (query.assigned === "me") {
    where.assignedAgentId = actor.userId;
  }

  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        customer: { select: assignmentSelect },
        assignedAgent: { select: assignmentSelect },
        slaRecord: {
          select: {
            firstResponseDueAt: true,
            resolutionDueAt: true,
            firstResponseAt: true,
            resolvedAt: true,
            policy: { select: { firstResponseMinutes: true, resolutionMinutes: true } },
          },
        },
        _count: { select: { messages: true, attachments: true } },
      },
    }),
    prisma.ticket.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function listAssignedTickets(actor: TicketActor, query: ListTicketsQuery) {
  if (actor.role !== UserRole.AGENT) {
    throw new ApiError(403, "FORBIDDEN", "Assigned ticket queues are available to agents.");
  }
  return listTickets(actor, { ...query, assigned: "me" });
}

export async function listUnassignedTickets(actor: TicketActor, query: ListTicketsQuery) {
  if (actor.role !== UserRole.AGENT) {
    throw new ApiError(403, "FORBIDDEN", "The unassigned queue is available to agents.");
  }
  return listTickets(actor, { ...query, assigned: "unassigned" });
}

export async function getTicketDetails(ticketId: string, actor: TicketActor) {
  await assertTicketAccess(ticketId, actor);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      customer: { select: { id: true, fullName: true, email: true, company: true } },
      assignedAgent: { select: assignmentSelect },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, fullName: true, role: true } } },
      },
      ...(actor.role === UserRole.CUSTOMER ? {} : {
        internalNotes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, fullName: true, role: true } } },
        },
      }),
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
      },
      assignments: {
        orderBy: { createdAt: "asc" },
        include: {
          assignedTo: { select: { id: true, fullName: true } },
          assignedBy: { select: { id: true, fullName: true } },
        },
      },
      history: {
        where: actor.role === UserRole.CUSTOMER ? { action: { not: TicketHistoryAction.INTERNAL_NOTE } } : {},
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { id: true, fullName: true, role: true } } },
      },
      slaRecord: { include: { policy: true } },
      feedback: {
        select: {
          rating: true,
          agentRating: true,
          communicationRating: true,
          resolutionRating: true,
          comment: true,
          suggestions: true,
          createdAt: true,
          agent: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  return ticket;
}

export async function updateTicket(ticketId: string, actor: TicketActor, input: UpdateTicketInput) {
  await assertTicketAccess(ticketId, actor);
  const current = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!current) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (actor.role === UserRole.CUSTOMER) {
    if (current.status !== TicketStatus.OPEN && current.status !== TicketStatus.WAITING_FOR_CUSTOMER) {
      throw new ApiError(409, "TICKET_NOT_EDITABLE", "You can only edit a ticket while it is open or waiting for your response.");
    }
    if (input.priority !== undefined) {
      throw new ApiError(403, "PRIORITY_CHANGE_RESTRICTED", "Customers cannot change ticket priority after submission.");
    }
    if (input.category) assertCategory(current.domain, input.category);
  } else if (actor.role === UserRole.AGENT) {
    const keys = Object.keys(input);
    if (keys.some((key) => key !== "priority" && key !== "category")) {
      throw new ApiError(403, "FIELD_UPDATE_RESTRICTED", "Agents can update ticket category and priority only.");
    }
    if (input.category) assertCategory(current.domain, input.category);
  } else if (input.category) {
    assertCategory(current.domain, input.category);
  }

  const updated = await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.update({ where: { id: ticketId }, data: input });
    if (input.priority && input.priority !== current.priority) {
      const policy = await transaction.sLAPolicy.findUnique({
        where: { domain_priority: { domain: current.domain, priority: input.priority } },
      });
      if (!policy?.isActive) {
        throw new ApiError(503, "SLA_POLICY_UNAVAILABLE", "No active SLA policy is configured for this priority.");
      }
      const currentSla = await transaction.sLARecord.findUnique({ where: { ticketId } });
      if (currentSla) {
        const newFirstResponseDeadline = new Date(current.createdAt.getTime() + policy.firstResponseMinutes * 60_000);
        await transaction.sLARecord.update({
          where: { ticketId },
          data: {
            policyId: policy.id,
            ...(currentSla.firstResponseAt === null ? {
              firstResponseDueAt: newFirstResponseDeadline,
              firstResponseBreached: new Date() > newFirstResponseDeadline,
            } : {}),
            resolutionDueAt: new Date(current.createdAt.getTime() + policy.resolutionMinutes * 60_000),
          },
        });
      }
    }
    await transaction.ticketHistory.create({
      data: { ticketId, actorId: actor.userId, action: TicketHistoryAction.UPDATED, metadata: input },
    });
    return ticket;
  });
  if (input.category && input.category !== current.category) {
    if (updated.assignedAgentId) retainAssignedAgentInTicketRoom(ticketId, updated.assignedAgentId);
    else removeAgentsFromTicketRoom(ticketId);
  }
  emitToTicket(ticketId, "ticket:updated", { ticketId, updatedAt: updated.updatedAt });
  emitToAdministrators("ticket:updated", { ticketId, updatedAt: updated.updatedAt });
  return getTicketDetails(ticketId, actor);
}

const allowedStatusTransitions: Record<TicketStatus, TicketStatus[]> = {
  OPEN: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_CUSTOMER, TicketStatus.RESOLVED],
  IN_PROGRESS: [TicketStatus.OPEN, TicketStatus.WAITING_FOR_CUSTOMER, TicketStatus.RESOLVED],
  WAITING_FOR_CUSTOMER: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED],
  RESOLVED: [TicketStatus.CLOSED, TicketStatus.IN_PROGRESS],
  CLOSED: [],
};

export async function updateTicketStatus(
  ticketId: string,
  actor: TicketActor,
  nextStatus: TicketStatus,
  note?: string,
) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Customers cannot change ticket status.");
  }
  await assertTicketAccess(ticketId, actor);
  const current = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!current) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (!allowedStatusTransitions[current.status].includes(nextStatus)) {
    throw new ApiError(409, "INVALID_STATUS_TRANSITION", `A ticket cannot move from ${current.status} to ${nextStatus}.`);
  }
  const now = new Date();
  const updated = await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.update({
      where: { id: ticketId },
      data: {
        status: nextStatus,
        resolvedAt: nextStatus === TicketStatus.RESOLVED ? now : nextStatus === TicketStatus.IN_PROGRESS ? null : current.resolvedAt,
      },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: TicketHistoryAction.STATUS_CHANGED,
        metadata: { from: current.status, to: nextStatus, ...(note ? { note } : {}) },
      },
    });
    if (nextStatus === TicketStatus.RESOLVED) {
      const sla = await transaction.sLARecord.findUnique({
        where: { ticketId },
        select: { resolutionDueAt: true, firstResponseDueAt: true, firstResponseAt: true },
      });
      await transaction.sLARecord.updateMany({
        where: { ticketId },
        data: {
          resolvedAt: now,
          resolutionBreached: Boolean(sla && now > sla.resolutionDueAt),
          ...(sla && !sla.firstResponseAt ? { firstResponseBreached: now > sla.firstResponseDueAt } : {}),
        },
      });
    } else if (nextStatus === TicketStatus.IN_PROGRESS && current.status === TicketStatus.RESOLVED) {
      await transaction.sLARecord.updateMany({ where: { ticketId }, data: { resolvedAt: null } });
    }
    return ticket;
  });
  const type = nextStatus === TicketStatus.RESOLVED || nextStatus === TicketStatus.CLOSED
    ? NotificationType.RESOLUTION
    : NotificationType.STATUS_CHANGED;
  await createNotification({
    userId: current.customerId,
    ticketId,
    type,
    title: `Ticket status updated · ${current.ticketCode}`,
    body: `Your ticket is now ${nextStatus.toLowerCase().replaceAll("_", " ")}.`,
  });
  const event = { ticketId, ticketCode: current.ticketCode, status: updated.status, updatedAt: updated.updatedAt };
  emitToTicket(ticketId, "ticket:status", event);
  emitToAdministrators("ticket:status", event);
  return getTicketDetails(ticketId, actor);
}

export async function confirmTicketResolution(ticketId: string, actor: TicketActor) {
  if (actor.role !== UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Only the ticket's customer can confirm its resolution.");
  }
  await assertTicketAccess(ticketId, actor);
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.status !== TicketStatus.RESOLVED) {
    throw new ApiError(409, "TICKET_NOT_RESOLVED", "Only resolved tickets can be confirmed as closed.");
  }
  const updated = await prisma.$transaction(async (transaction) => {
    const closed = await transaction.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.CLOSED },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: TicketHistoryAction.STATUS_CHANGED,
        metadata: { from: TicketStatus.RESOLVED, to: TicketStatus.CLOSED, confirmedByCustomer: true },
      },
    });
    return closed;
  });
  emitToTicket(ticketId, "ticket:status", {
    ticketId,
    ticketCode: ticket.ticketCode,
    status: updated.status,
    updatedAt: updated.updatedAt,
  });
  emitToAdministrators("ticket:status", {
    ticketId,
    ticketCode: ticket.ticketCode,
    status: updated.status,
    updatedAt: updated.updatedAt,
  });
  return getTicketDetails(ticketId, actor);
}

export async function listTicketHistory(ticketId: string, actor: TicketActor) {
  await assertTicketAccess(ticketId, actor);
  return prisma.ticketHistory.findMany({
    where: {
      ticketId,
      ...(actor.role === UserRole.CUSTOMER ? { action: { not: TicketHistoryAction.INTERNAL_NOTE } } : {}),
    },
    include: { actor: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function addAttachmentRecord(
  ticketId: string,
  actor: TicketActor,
  input: { originalName: string; storageKey: string; mimeType: string; sizeBytes: number },
) {
  await assertTicketAccess(ticketId, actor);
  return prisma.$transaction(async (transaction) => {
    const attachment = await transaction.ticketAttachment.create({
      data: { ticketId, uploadedById: actor.userId, ...input },
      select: { id: true, ticketId: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: TicketHistoryAction.UPDATED,
        metadata: { attachmentId: attachment.id, action: "ATTACHMENT_ADDED" },
      },
    });
    return attachment;
  });
}

export async function getAttachment(ticketId: string, attachmentId: string, actor: TicketActor) {
  await assertTicketAccess(ticketId, actor);
  const attachment = await prisma.ticketAttachment.findFirst({
    where: { id: attachmentId, ticketId },
    select: { id: true, originalName: true, storageKey: true, mimeType: true, sizeBytes: true },
  });
  if (!attachment) throw new ApiError(404, "ATTACHMENT_NOT_FOUND", "The attachment was not found.");
  return attachment;
}

export async function submitFeedback(
  ticketId: string,
  actor: TicketActor,
  input: {
    rating: number;
    agentRating: number;
    communicationRating: number;
    resolutionRating: number;
    comment?: string;
    suggestions?: string;
  },
) {
  if (actor.role !== UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Only the ticket's customer can submit feedback.");
  }
  await assertTicketAccess(ticketId, actor);
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { status: true, ticketCode: true, assignedAgentId: true },
  });
  if (!ticket || (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED)) {
    throw new ApiError(409, "TICKET_NOT_RESOLVED", "Feedback is available after a ticket is resolved.");
  }
  const feedback = await prisma.ticketFeedback.upsert({
    where: { ticketId },
    update: {
      rating: input.rating,
      agentRating: input.agentRating,
      communicationRating: input.communicationRating,
      resolutionRating: input.resolutionRating,
      comment: input.comment ?? null,
      suggestions: input.suggestions ?? null,
    },
    create: {
      ticketId,
      customerId: actor.userId,
      agentId: ticket.assignedAgentId,
      rating: input.rating,
      agentRating: input.agentRating,
      communicationRating: input.communicationRating,
      resolutionRating: input.resolutionRating,
      comment: input.comment ?? null,
      suggestions: input.suggestions ?? null,
    },
  });
  const notice = {
    ticketId,
    type: NotificationType.CUSTOMER_FEEDBACK,
    title: `Customer feedback received · ${ticket.ticketCode}`,
    body: "A customer submitted feedback for a resolved support ticket.",
    dedupeKey: `customer-feedback:${ticketId}`,
  };
  if (feedback.agentId) {
    await createNotification({ ...notice, userId: feedback.agentId });
  }
  await notifyAdministrators(notice);
  return feedback;
}
