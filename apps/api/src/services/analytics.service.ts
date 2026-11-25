import { Prisma, TicketStatus, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { getAgentWorkloads } from "./fairness.service.js";
import type { TicketActor } from "./ticket-access.service.js";
import { activeTicketStatuses } from "./ticket-access.service.js";

export function calculateCsatSummary(
  distribution: Array<{ rating: number; count: number }>,
) {
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  const positive = distribution.reduce((sum, item) => sum + (item.rating >= 4 ? item.count : 0), 0);
  return {
    feedbackCount: total,
    positiveCount: positive,
    csatPercent: total ? Math.round((positive / total) * 10000) / 100 : null,
  };
}

export async function getAnalytics(
  actor: TicketActor,
  period: { from?: Date; to?: Date },
) {
  const dateFilter: Prisma.DateTimeFilter = {
    ...(period.from ? { gte: period.from } : {}),
    ...(period.to ? { lte: period.to } : {}),
  };
  const trendFrom = period.from ?? new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const trendTo = period.to ?? new Date();
  const where: Prisma.TicketWhereInput = {
    ...(period.from || period.to ? { createdAt: dateFilter } : {}),
    ...(actor.role === UserRole.CUSTOMER ? { customerId: actor.userId } : {}),
    ...(actor.role === UserRole.AGENT ? { assignedAgentId: actor.userId } : {}),
  };
  const feedbackWhere: Prisma.TicketFeedbackWhereInput = actor.role === UserRole.AGENT
    ? {
      agentId: actor.userId,
      rating: { gte: 1, lte: 5 },
      ...(period.from || period.to ? { createdAt: dateFilter } : {}),
    }
    : {
      ticket: where,
      rating: { gte: 1, lte: 5 },
      ...(period.from || period.to ? { createdAt: dateFilter } : {}),
    };
  const durationConditions = [Prisma.sql`"resolvedAt" IS NOT NULL`];
  if (period.from) durationConditions.push(Prisma.sql`"createdAt" >= ${period.from}`);
  if (period.to) durationConditions.push(Prisma.sql`"createdAt" <= ${period.to}`);
  if (actor.role === UserRole.CUSTOMER) durationConditions.push(Prisma.sql`"customerId" = ${actor.userId}::uuid`);
  if (actor.role === UserRole.AGENT) durationConditions.push(Prisma.sql`"assignedAgentId" = ${actor.userId}::uuid`);
  const trendConditions = [
    Prisma.sql`"createdAt" >= ${trendFrom}`,
    Prisma.sql`"createdAt" <= ${trendTo}`,
    Prisma.sql`"rating" BETWEEN 1 AND 5`,
  ];
  if (actor.role === UserRole.CUSTOMER) trendConditions.push(Prisma.sql`"customerId" = ${actor.userId}::uuid`);
  if (actor.role === UserRole.AGENT) trendConditions.push(Prisma.sql`"agentId" = ${actor.userId}::uuid`);

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
    ratingGroups,
    agentRatingGroups,
    recentFeedback,
    activeSlaTickets,
    completedSlaByAgent,
    trendRows,
  ] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({ where: { ...where, status: { in: [TicketStatus.OPEN, TicketStatus.WAITING_FOR_CUSTOMER] } } }),
    prisma.ticket.count({ where: { ...where, status: TicketStatus.IN_PROGRESS } }),
    prisma.ticket.count({ where: { ...where, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } } }),
    prisma.sLARecord.count({ where: { ticket: where, resolvedAt: { not: null } } }),
    prisma.sLARecord.count({
      where: {
        ticket: where,
        resolvedAt: { not: null },
        OR: [{ firstResponseBreached: true }, { resolutionBreached: true }],
      },
    }),
    prisma.ticket.groupBy({ by: ["category"], where, _count: { _all: true }, orderBy: { _count: { category: "desc" } } }),
    prisma.ticket.groupBy({ by: ["priority"], where, _count: { _all: true } }),
    actor.role === UserRole.ADMIN ? getAgentWorkloads() : Promise.resolve([]),
    prisma.ticketFeedback.aggregate({
      where: feedbackWhere,
      _avg: { rating: true, agentRating: true, communicationRating: true, resolutionRating: true },
      _count: { _all: true },
    }),
    prisma.ticketFeedback.groupBy({
      by: ["rating"],
      where: feedbackWhere,
      _count: { _all: true },
    }),
    actor.role === UserRole.ADMIN
      ? prisma.ticketFeedback.groupBy({
        by: ["agentId"],
        where: { ...feedbackWhere, agentId: { not: null } },
        _avg: { rating: true, agentRating: true },
        _count: { _all: true },
      })
      : Promise.resolve([]),
    prisma.ticketFeedback.findMany({
      where: feedbackWhere,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        rating: true,
        agentRating: true,
        communicationRating: true,
        resolutionRating: true,
        comment: true,
        suggestions: true,
        createdAt: true,
        ticket: { select: { id: true, ticketCode: true } },
        agent: { select: { id: true, fullName: true } },
      },
    }),
    prisma.ticket.findMany({
      where: {
        ...where,
        status: { in: activeTicketStatuses() },
        slaRecord: { isNot: null },
      },
      select: {
        status: true,
        slaRecord: {
          select: {
            firstResponseAt: true,
            firstResponseDueAt: true,
            resolutionDueAt: true,
            firstResponseBreached: true,
            resolutionBreached: true,
          },
        },
      },
    }),
    actor.role === UserRole.ADMIN
      ? prisma.sLARecord.findMany({
        where: {
          resolvedAt: { not: null },
          ticket: { status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] }, assignedAgentId: { not: null } },
          ...(period.from || period.to ? { resolvedAt: dateFilter } : {}),
        },
        select: {
          firstResponseBreached: true,
          resolutionBreached: true,
          ticket: {
            select: {
              assignedAgent: { select: { id: true, fullName: true } },
            },
          },
        },
      })
      : Promise.resolve([]),
    prisma.$queryRaw<Array<{ day: string; responses: number; positive: number }>>(Prisma.sql`
      SELECT TO_CHAR(DATE("createdAt"), 'YYYY-MM-DD') AS "day",
        COUNT(*)::int AS "responses",
        COUNT(*) FILTER (WHERE "rating" IN (4, 5))::int AS "positive"
      FROM "TicketFeedback"
      WHERE ${Prisma.join(trendConditions, " AND ")}
      GROUP BY DATE("createdAt")
      ORDER BY DATE("createdAt") ASC
    `),
  ]);
  const duration = await prisma.$queryRaw<Array<{ averageHours: number | null }>>(Prisma.sql`
    SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 3600.0)::float AS "averageHours"
    FROM "Ticket"
    WHERE ${Prisma.join(durationConditions, " AND ")}
  `);
  const averageResolutionTimeHours = duration[0]?.averageHours ?? 0;
  const csat = calculateCsatSummary(ratingGroups.map((item) => ({
    rating: item.rating,
    count: item._count._all,
  })));
  const agentIds = agentRatingGroups
    .map((item) => item.agentId)
    .filter((id): id is string => id !== null);
  const agents = agentIds.length
    ? await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, fullName: true },
    })
    : [];
  const agentNames = new Map(agents.map((agent) => [agent.id, agent.fullName]));
  const now = Date.now();
  const activeSla = activeSlaTickets.reduce((result, ticket) => {
    if (!ticket.slaRecord) return result;
    const deadline = ticket.slaRecord.firstResponseAt
      ? ticket.slaRecord.resolutionDueAt
      : ticket.slaRecord.firstResponseDueAt;
    const remaining = deadline.getTime() - now;
    result.activeTimers += 1;
    if (remaining <= 0) result.breached += 1;
    else if (remaining <= 60 * 60_000) {
      result.approaching += 1;
      if (remaining <= 15 * 60_000) result.dueWithin15Minutes += 1;
    }
    return result;
  }, { activeTimers: 0, approaching: 0, dueWithin15Minutes: 0, breached: 0 });
  const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    count: ratingGroups.find((item) => item.rating === rating)?._count._all ?? 0,
  }));
  const slaAgentStats = new Map<string, { name: string; total: number; breached: number }>();
  for (const record of completedSlaByAgent) {
    const agent = record.ticket.assignedAgent;
    if (!agent) continue;
    const current = slaAgentStats.get(agent.id) ?? { name: agent.fullName, total: 0, breached: 0 };
    current.total += 1;
    if (record.firstResponseBreached || record.resolutionBreached) current.breached += 1;
    slaAgentStats.set(agent.id, current);
  }
  const feedbackCount = satisfaction._count._all;

  return {
    totalTickets,
    openTickets,
    inProgressTickets,
    resolvedTickets,
    slaCompliance: slaTotal ? Math.round(((slaTotal - slaBreached) / slaTotal) * 10000) / 100 : null,
    slaBreaches: slaBreached,
    averageResolutionTimeHours: Math.round(averageResolutionTimeHours * 100) / 100,
    categories: categories.map((item) => ({ category: item.category, count: item._count._all })),
    priorities: priorities.map((item) => ({ priority: item.priority, count: item._count._all })),
    agentWorkload,
    customerSatisfaction: {
      averageRating: satisfaction._avg.rating ?? 0,
      averageAgentRating: satisfaction._avg.agentRating ?? 0,
      averageCommunicationRating: satisfaction._avg.communicationRating ?? 0,
      averageResolutionRating: satisfaction._avg.resolutionRating ?? 0,
      feedbackCount,
      positiveCount: csat.positiveCount,
      csatPercent: csat.csatPercent,
      ratingDistribution,
      agentScores: agentRatingGroups.map((item) => ({
        agentId: item.agentId,
        name: item.agentId ? agentNames.get(item.agentId) ?? "Former agent" : "Unassigned",
        averageRating: item._avg.rating ?? 0,
        averageAgentRating: item._avg.agentRating ?? 0,
        feedbackCount: item._count._all,
      })),
      recentFeedback,
      trend: trendRows.map((row) => ({
        day: row.day,
        responses: row.responses,
        positive: row.positive,
        csatPercent: row.responses ? Math.round((row.positive / row.responses) * 10000) / 100 : null,
      })),
    },
    activeSla,
    slaAgentPerformance: [...slaAgentStats.entries()].map(([agentId, item]) => ({
      agentId,
      name: item.name,
      completedTickets: item.total,
      breachedTickets: item.breached,
      compliancePercent: item.total ? Math.round(((item.total - item.breached) / item.total) * 10000) / 100 : null,
    })),
    period: {
      ...(period.from ? { from: period.from } : {}),
      ...(period.to ? { to: period.to } : {}),
    },
  };
}
