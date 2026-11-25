import { NotificationType, TicketHistoryAction, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { ApiError } from "../utils/api-response.js";
import { emitToAdministrators, emitToTicket } from "../sockets/realtime.js";
import { createNotification, notifyAdministrators } from "./notification.service.js";
import { assertTicketAccess, type TicketActor } from "./ticket-access.service.js";

export async function listPublicMessages(ticketId: string, actor: TicketActor) {
  await assertTicketAccess(ticketId, actor);
  return prisma.ticketMessage.findMany({
    where: { ticketId },
    include: { author: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createPublicMessage(ticketId: string, actor: TicketActor, body: string) {
  await assertTicketAccess(ticketId, actor);
  const message = await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketCode: true, customerId: true, assignedAgentId: true, slaRecord: true },
    });
    if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
    const created = await transaction.ticketMessage.create({
      data: { ticketId, authorId: actor.userId, body },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: TicketHistoryAction.PUBLIC_MESSAGE,
        metadata: { messageId: created.id },
      },
    });
    await transaction.ticket.update({ where: { id: ticketId }, data: { updatedAt: created.createdAt } });
    if (actor.role !== UserRole.CUSTOMER && ticket.slaRecord && !ticket.slaRecord.firstResponseAt) {
      await transaction.sLARecord.update({
        where: { ticketId },
        data: {
          firstResponseAt: created.createdAt,
          firstResponseBreached: created.createdAt > ticket.slaRecord.firstResponseDueAt,
        },
      });
    }
    return { ...created, ticketCode: ticket.ticketCode, customerId: ticket.customerId, assignedAgentId: ticket.assignedAgentId };
  });

  const notification = {
    ticketId,
    type: NotificationType.NEW_MESSAGE,
    title: `New reply · ${message.ticketCode}`,
    body: `${message.author.fullName} sent a message on your support ticket.`,
  };
  if (actor.role === UserRole.CUSTOMER) {
    if (message.assignedAgentId) {
      await createNotification({ ...notification, userId: message.assignedAgentId });
    } else {
      await notifyAdministrators({ ...notification, dedupeKey: undefined });
    }
  } else {
    await createNotification({ ...notification, userId: message.customerId });
  }
  const publicMessage = {
    id: message.id,
    ticketId,
    body: message.body,
    createdAt: message.createdAt,
    author: message.author,
  };
  emitToTicket(ticketId, "ticket:message", publicMessage);
  emitToAdministrators("ticket:message", { ticketId, ticketCode: message.ticketCode, message: publicMessage });
  return publicMessage;
}

export async function createInternalNote(ticketId: string, actor: TicketActor, body: string) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Only agents and administrators can add internal notes.");
  }
  await assertTicketAccess(ticketId, actor);
  const note = await prisma.$transaction(async (transaction) => {
    const created = await transaction.internalNote.create({
      data: { ticketId, authorId: actor.userId, body },
      include: { author: { select: { id: true, fullName: true, role: true } } },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: actor.userId,
        action: TicketHistoryAction.INTERNAL_NOTE,
        metadata: { noteId: created.id },
      },
    });
    return created;
  });
  return note;
}

export async function listInternalNotes(ticketId: string, actor: TicketActor) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "Internal notes are not available to customers.");
  }
  await assertTicketAccess(ticketId, actor);
  return prisma.internalNote.findMany({
    where: { ticketId },
    include: { author: { select: { id: true, fullName: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
}
