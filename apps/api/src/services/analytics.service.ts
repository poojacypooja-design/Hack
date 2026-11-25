import { Prisma, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { getAgentWorkloads } from "./fairness.service.js";
import type { TicketActor } from "./ticket-access.service.js";

export async function getAnalytics(
  actor: TicketActor,
  period: { from?: Date; to?: Date },
) {
  const dateFilter: Prisma.DateTimeFilter = {
    ...(period.from ? { gte: period.from } : {}),
    ...(period.to ? { lte: period.to } : {}),
  };
  const where: Prisma.TicketWhereInput = {
    ...(period.from || period.to ? { createdAt: dateFilter } : {}),
    ...(actor.role === UserRole.CUSTOMER ? { customerId: actor.userId } : {}),
    ...(actor.role === UserRole.AGENT ? { assignedAgentId: actor.userId } : {}),
  };
  const durationConditions = [Prisma.sql`"resolvedAt" IS NOT NULL`];
  if (period.from) durationConditions.push(Prisma.sql`"createdAt" >= ${period.from}`);
  if (period.to) durationConditions.push(Prisma.sql`"createdAt" <= ${period.to}`);
  if (actor.role === UserRole.CUSTOMER) durationConditions.push(Prisma.sql`"customerId" = ${actor.userId}::uuid`);
  if (actor.role === UserRole.AGENT) durationConditions.push(Prisma.sql`"assignedAgentId" = ${actor.userId}::uuid`);

  const [
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    slaTotal,
    slaBreached,
    categories,
    priorities,
    agentWorkload,
    satisfaction,
  ] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: { in: [TicketStatus.OPEN, TicketStatus.WAITING_FOR_CUSTOMER] } } }),
    prisma.ticket.count({ where: { ...where, status: TicketStatus.IN_PROGRESS } }),
    prisma.ticket.count({ where: { ...where, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } } }),
    prisma.sLARecord.count({ where: { ticket: where } }),
    prisma.sLARecord.count({
      where: {
        ticket: where,
        OR: [{ firstResponseBreached: true }, { resolutionBreached: true }],
      },
    }),
    prisma.ticket.groupBy({ by: ["category"], where, _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
    prisma.ticket.groupBy({ by: ["priority"], where, _count: { _all: true } }),
    actor.role === UserRole.ADMIN ? getAgentWorkloads() : Promise.resolve([]),
    prisma.ticketFeedback.aggregate({
      where: { ticket: where },
      _avg: { rating: true },
      _count: { _all: true },
    }),
  ]);
  const duration = await prisma.$queryRaw<Array<{ averageHours: number | null }>>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600.0)::float AS "averageHours"
    FROM "Ticket"
    WHERE ${Prisma.join(durationConditions, " AND ")}
  `);
  const averageResolutionTimeHours = duration[0]?.averageHours ?? 0;

  return {
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    slaCompliance: slaTotal ? Math.round(((slaTotal - slaBreached) / slaTotal) * 10000) / 100 : 100,
    slaBreaches: slaBreached,
    averageResolutionTimeHours: Math.round(averageResolutionTimeHours * 100) / 100,
    categories: categories.map((item) => ({ category: item.category, count: item._count._all })),
    priorities: priorities.map((item) => ({ priority: item.priority, count: item._count._all })),
    agentWorkload,
    customerSatisfaction: {
      averageRating: satisfaction._avg.rating ?? 0,
      feedbackCount: satisfaction._count._all,
    },
    period: {
      ...(period.from ? { from: period.from } : {}),
      ...(period.to ? { to: period.to } : {}),
    },
  };
}
