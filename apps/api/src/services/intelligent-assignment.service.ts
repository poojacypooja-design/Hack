import {
  AssignmentSource,
  AssignmentStatus,
  NotificationType,
  Prisma,
  TicketHistoryAction,
  TicketPriority,
  TicketStatus,
  UserRole,
} from "@prisma/client";
import { prisma } from "../config/database.js";
import {
  emitToAdministrators,
  emitToTicket,
  emitToUser,
  retainAssignedAgentInTicketRoom,
} from "../sockets/realtime.js";
import { ApiError } from "../utils/api-response.js";
import { createNotification, notifyAdministrators } from "./notification.service.js";
import { activeTicketStatuses, type TicketActor } from "./ticket-access.service.js";

type WeightSet = {
  skillWeight: number;
  workloadWeight: number;
  similarIssueWeight: number;
  availabilityWeight: number;
  slaPerformanceWeight: number;
};
type AssignmentDbClient = typeof prisma | Prisma.TransactionClient;

const defaultWeights: WeightSet = {
  skillWeight: 35,
  workloadWeight: 25,
  similarIssueWeight: 15,
  availabilityWeight: 15,
  slaPerformanceWeight: 10,
};

type CandidateInput = {
  skillLevel: number;
  skillTags: string[];
  requiredSkills: string[];
  activeTickets: number;
  urgentTickets: number;
  similarTickets: number;
  maximumSimilarTickets: number;
  slaCompliance: number | null;
  available: boolean;
  weights: WeightSet;
};

export function scoreAssignmentCandidate(input: CandidateInput) {
  const normalizedTags = new Set(input.skillTags.map((tag) => tag.trim().toLowerCase()));
  const requiredTagMatches = input.requiredSkills
    .filter((skill) => normalizedTags.has(skill.trim().toLowerCase())).length;
  const skillScore = Math.min(100, input.skillLevel * 15 + (requiredTagMatches / Math.max(input.requiredSkills.length, 1)) * 25);
  const workloadScore = Math.max(0, 100 / (1 + input.activeTickets * 0.25 + input.urgentTickets * 0.5));
  const similarScore = input.maximumSimilarTickets
    ? (input.similarTickets / input.maximumSimilarTickets) * 100
    : null;

  const components: Array<{ value: number | null; weight: number }> = [
    { value: skillScore, weight: input.weights.skillWeight },
    { value: workloadScore, weight: input.weights.workloadWeight },
    { value: similarScore, weight: input.weights.similarIssueWeight },
    { value: input.available ? 100 : 0, weight: input.weights.availabilityWeight },
    { value: input.slaCompliance, weight: input.weights.slaPerformanceWeight },
  ];
  const included = components.filter((component): component is { value: number; weight: number } =>
    component.value !== null && component.weight > 0);
  const weightTotal = included.reduce((sum, component) => sum + component.weight, 0);
  const score = weightTotal
    ? Math.round(included.reduce((sum, component) => sum + component.value * component.weight, 0) / weightTotal)
    : 0;
  return { score, skillScore: Math.round(skillScore), workloadScore: Math.round(workloadScore), similarScore };
}

async function loadWeights(client: AssignmentDbClient) {
  const settings = await client.assignmentSettings.findUnique({ where: { id: "global" } });
  return settings ?? defaultWeights;
}

async function getRecommendations(ticketId: string, client: AssignmentDbClient = prisma) {
  const ticket = await client.ticket.findUnique({
    where: { id: ticketId },
    include: { analysis: true },
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (ticket.assignedAgentId) {
    throw new ApiError(409, "TICKET_ALREADY_ASSIGNED", "Recommendations are available for unassigned tickets.");
  }
  if (!activeTicketStatuses().includes(ticket.status)) {
    throw new ApiError(409, "TICKET_NOT_ACTIVE", "Only active tickets can be automatically assigned.");
  }

  const activeStatuses = activeTicketStatuses();
  const [agents, assigned, similarAssignments, history, weights] = await Promise.all([
    client.user.findMany({
      where: {
        role: UserRole.AGENT,
        isActive: true,
        isAvailable: true,
        skills: { some: { domain: ticket.domain, category: ticket.category } },
      },
      select: {
        id: true,
        fullName: true,
        skills: {
          where: { domain: ticket.domain, category: ticket.category },
          select: { skillLevel: true, skillTags: true },
        },
      },
    }),
    client.ticket.groupBy({
      by: ["assignedAgentId", "priority"],
      where: { assignedAgentId: { not: null }, status: { in: activeStatuses } },
      _count: { _all: true },
    }),
    ticket.analysis?.similarTicketIds.length
      ? client.ticketAssignment.findMany({
        where: { ticketId: { in: ticket.analysis.similarTicketIds } },
        select: { assignedToId: true },
      })
      : Promise.resolve([]),
    client.ticket.findMany({
      where: {
        status: TicketStatus.RESOLVED,
        assignedAgentId: { not: null },
        updatedAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60_000) },
        slaRecord: { isNot: null },
      },
      select: {
        assignedAgentId: true,
        slaRecord: { select: { resolutionBreached: true } },
      },
    }),
    loadWeights(client),
  ]);

  const workload = new Map<string, { active: number; urgent: number }>();
  for (const row of assigned) {
    if (!row.assignedAgentId) continue;
    const current = workload.get(row.assignedAgentId) ?? { active: 0, urgent: 0 };
    current.active += row._count._all;
    if (row.priority === TicketPriority.HIGH || row.priority === TicketPriority.CRITICAL) {
      current.urgent += row._count._all;
    }
    workload.set(row.assignedAgentId, current);
  }
  const similarCounts = new Map<string, number>();
  for (const row of similarAssignments) {
    similarCounts.set(row.assignedToId, (similarCounts.get(row.assignedToId) ?? 0) + 1);
  }
  const slaSamples = new Map<string, { count: number; met: number }>();
  for (const row of history) {
    if (!row.assignedAgentId || !row.slaRecord) continue;
    const current = slaSamples.get(row.assignedAgentId) ?? { count: 0, met: 0 };
    current.count += 1;
    if (!row.slaRecord.resolutionBreached) current.met += 1;
    slaSamples.set(row.assignedAgentId, current);
  }
  const maximumSimilarTickets = Math.max(0, ...similarCounts.values());
  const recommendations = agents.map((agent) => {
    const load = workload.get(agent.id) ?? { active: 0, urgent: 0 };
    const skill = agent.skills[0];
    const sample = slaSamples.get(agent.id);
    const slaCompliance = sample && sample.count >= 10 ? (sample.met / sample.count) * 100 : null;
    const scored = scoreAssignmentCandidate({
      skillLevel: skill?.skillLevel ?? 0,
      skillTags: skill?.skillTags ?? [],
      requiredSkills: ticket.analysis?.requiredSkills ?? [ticket.category],
      activeTickets: load.active,
      urgentTickets: load.urgent,
      similarTickets: similarCounts.get(agent.id) ?? 0,
      maximumSimilarTickets,
      slaCompliance,
      available: true,
      weights,
    });
    const reasons = [
      `Exact ${ticket.category} skill match (level ${skill?.skillLevel ?? 0}/5)`,
      `${load.active} active tickets, including ${load.urgent} high/critical`,
      "Agent is active and marked available",
      ...(maximumSimilarTickets ? [`Resolved ${similarCounts.get(agent.id) ?? 0} similar issue(s)`] : []),
      ...(slaCompliance === null ? [] : [`${Math.round(slaCompliance)}% resolution-SLA compliance from ${sample?.count} resolved tickets`]),
    ];
    const reason = `Assigned by transparent rules score: ${reasons.join("; ")}.`;
    return {
      agentId: agent.id,
      name: agent.fullName,
      activeTickets: load.active,
      urgentTickets: load.urgent,
      skillLevel: skill?.skillLevel ?? 0,
      score: scored.score,
      reasons,
      reason,
    };
  }).sort((left, right) =>
    right.score - left.score
    || left.activeTickets - right.activeTickets
    || left.name.localeCompare(right.name));

  return { ticket, weights, recommendations };
}

export async function assignmentRecommendations(ticketId: string, actor: TicketActor) {
  if (actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Only administrators can view organization-wide assignment recommendations.");
  }
  const { ticket, recommendations } = await getRecommendations(ticketId);
  const complexityWeight = ticket.analysis?.complexity === "CRITICAL" ? 4
    : ticket.analysis?.complexity === "HIGH" ? 3
      : ticket.analysis?.complexity === "MEDIUM" ? 2 : 1;
  return {
    ticketId: ticket.id,
    complexityWeight,
    method: "Weighted rules score using exact skills, workload, availability, and sufficient historical data. Unavailable data dimensions are omitted and weights renormalized.",
    recommendations,
  };
}

export async function getAssignmentSettings() {
  const settings = await prisma.assignmentSettings.findUnique({ where: { id: "global" } });
  return settings ?? { id: "global", automaticEnabled: true, ...defaultWeights };
}

export async function getAssignmentStatistics() {
  const [analysedTickets, automaticallyAssigned, waiting, failed, disabled] = await prisma.$transaction([
    prisma.ticketAnalysis.count(),
    prisma.ticketAssignment.count({ where: { source: AssignmentSource.AUTOMATIC } }),
    prisma.ticketAnalysis.count({ where: { assignmentStatus: AssignmentStatus.WAITING } }),
    prisma.ticketAnalysis.count({ where: { assignmentStatus: AssignmentStatus.FAILED } }),
    prisma.ticketAnalysis.count({ where: { assignmentStatus: AssignmentStatus.DISABLED } }),
  ]);
  return {
    analysedTickets,
    automaticallyAssigned,
    automaticAssignmentRatePercent: analysedTickets
      ? Math.round((automaticallyAssigned / analysedTickets) * 100)
      : null,
    waiting,
    failed,
    disabled,
  };
}

export async function updateAssignmentSettings(input: { automaticEnabled?: boolean } & Partial<WeightSet>) {
  const current = await getAssignmentSettings();
  const data = { ...current, ...input };
  const total = data.skillWeight + data.workloadWeight + data.similarIssueWeight
    + data.availabilityWeight + data.slaPerformanceWeight;
  if (total !== 100) {
    throw new ApiError(400, "INVALID_ASSIGNMENT_WEIGHTS", "Assignment weights must total exactly 100.");
  }
  const updated = await prisma.assignmentSettings.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      automaticEnabled: data.automaticEnabled,
      skillWeight: data.skillWeight,
      workloadWeight: data.workloadWeight,
      similarIssueWeight: data.similarIssueWeight,
      availabilityWeight: data.availabilityWeight,
      slaPerformanceWeight: data.slaPerformanceWeight,
    },
    update: input,
  });
  if (updated.automaticEnabled) await retryPendingAssignments();
  return updated;
}

async function markAssignmentStatus(ticketId: string, status: AssignmentStatus, reason?: string) {
  await prisma.ticketAnalysis.update({
    where: { ticketId },
    data: { assignmentStatus: status, ...(reason ? { assignmentReason: reason } : {}) },
  });
}

async function notifyAssignmentFailure(ticket: { id: string; ticketCode: string }, reason: string) {
  await notifyAdministrators({
    ticketId: ticket.id,
    type: NotificationType.ASSIGNMENT_FAILED,
    title: `Assignment needs attention · ${ticket.ticketCode}`,
    body: reason,
    dedupeKey: `assignment-pending:${ticket.id}`,
  });
  emitToAdministrators("assignment:pending", { ticketId: ticket.id, ticketCode: ticket.ticketCode });
}

type AutomaticOutcome =
  | { kind: "DISABLED" }
  | { kind: "ALREADY_ASSIGNED" }
  | { kind: "WAITING"; ticket: { id: string; ticketCode: string }; reason: string }
  | {
    kind: "ASSIGNED";
    ticket: { id: string; ticketCode: string; subject: string; customerId: string; updatedAt: Date };
    selected: NonNullable<Awaited<ReturnType<typeof getRecommendations>>["recommendations"][number]>;
  };

async function tryAssignAutomatically(ticketId: string) {
  const outcome = await prisma.$transaction(async (transaction): Promise<AutomaticOutcome> => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(915102, 41)`;
    const settings = await transaction.assignmentSettings.findUnique({ where: { id: "global" } });
    if (settings && !settings.automaticEnabled) {
      await transaction.ticketAnalysis.update({
        where: { ticketId },
        data: { assignmentStatus: AssignmentStatus.DISABLED },
      });
      return { kind: "DISABLED" };
    }

    const { ticket, recommendations } = await getRecommendations(ticketId, transaction);
    const selected = recommendations[0];
    if (!selected) {
      const reason = "No active, available agent has an exact skill for this ticket. It remains in the admin assignment queue.";
      await transaction.ticketAnalysis.update({
        where: { ticketId },
        data: { assignmentStatus: AssignmentStatus.WAITING, assignmentReason: reason },
      });
      return { kind: "WAITING", ticket, reason };
    }

    const agentStillEligible = await transaction.user.findFirst({
      where: {
        id: selected.agentId,
        role: UserRole.AGENT,
        isActive: true,
        isAvailable: true,
        skills: { some: { domain: ticket.domain, category: ticket.category } },
      },
      select: { id: true },
    });
    if (!agentStillEligible) {
      const reason = "The selected agent became unavailable before assignment. The ticket remains in the admin queue.";
      await transaction.ticketAnalysis.update({
        where: { ticketId },
        data: { assignmentStatus: AssignmentStatus.WAITING, assignmentReason: reason },
      });
      return { kind: "WAITING", ticket, reason };
    }
    const update = await transaction.ticket.updateMany({
      where: { id: ticketId, assignedAgentId: null },
      data: { assignedAgentId: selected.agentId },
    });
    if (!update.count) return { kind: "ALREADY_ASSIGNED" };
    await transaction.ticketAssignment.create({
      data: {
        ticketId,
        assignedToId: selected.agentId,
        assignedById: null,
        score: selected.score,
        reason: selected.reason,
        source: AssignmentSource.AUTOMATIC,
        note: "Automatically assigned using rule-based analysis and workload matching.",
      },
    });
    await transaction.ticketHistory.create({
      data: {
        ticketId,
        actorId: null,
        action: TicketHistoryAction.ASSIGNED,
        metadata: { source: "AUTOMATIC" },
      },
    });
    await transaction.ticketAnalysis.update({
      where: { ticketId },
      data: { assignmentStatus: AssignmentStatus.ASSIGNED, assignmentReason: selected.reason },
    });
    const assignedTicket = await transaction.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      select: { id: true, ticketCode: true, subject: true, customerId: true, updatedAt: true },
    });
    return { kind: "ASSIGNED", ticket: assignedTicket, selected };
  });

  if (outcome.kind === "DISABLED") return { status: AssignmentStatus.DISABLED };
  if (outcome.kind === "ALREADY_ASSIGNED") return { status: AssignmentStatus.ASSIGNED };
  if (outcome.kind === "WAITING") {
    await notifyAssignmentFailure(outcome.ticket, outcome.reason);
    return { status: AssignmentStatus.WAITING };
  }

  const { ticket: assigned, selected } = outcome;
  await createNotification({
    userId: selected.agentId,
    ticketId,
    type: NotificationType.TICKET_ASSIGNED,
    title: `New ticket assigned · ${assigned.ticketCode}`,
    body: assigned.subject,
  });
  await createNotification({
    userId: assigned.customerId,
    ticketId,
    type: NotificationType.TICKET_ASSIGNED,
    title: `Support specialist assigned · ${assigned.ticketCode}`,
    body: `Your ticket is now assigned to ${selected.name}.`,
  });
  const event = {
    ticketId,
    ticketCode: assigned.ticketCode,
    agentId: selected.agentId,
    agentName: selected.name,
    updatedAt: assigned.updatedAt,
  };
  retainAssignedAgentInTicketRoom(ticketId, selected.agentId);
  emitToTicket(ticketId, "ticket:assigned", event);
  emitToUser(selected.agentId, "assignment:new", event);
  emitToAdministrators("ticket:assigned", event);
  return { status: AssignmentStatus.ASSIGNED, ...event, score: selected.score };
}

export async function assignAutomatically(ticketId: string) {
  try {
    return await tryAssignAutomatically(ticketId);
  } catch (error) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, ticketCode: true, assignedAgentId: true },
    });
    if (!ticket) throw error;
    if (ticket.assignedAgentId) {
      console.error("Automatic assignment failed after the ticket was already assigned.", { ticketId, error });
      return { status: AssignmentStatus.ASSIGNED };
    }
    const reason = "Automatic assignment failed and requires administrator review.";
    await markAssignmentStatus(ticketId, AssignmentStatus.FAILED, reason);
    await notifyAssignmentFailure(ticket, reason);
    return { status: AssignmentStatus.FAILED };
  }
}

export async function retryPendingAssignments() {
  let cursor: string | undefined;
  let attempted = 0;
  let assigned = 0;
  while (true) {
    const tickets = await prisma.ticketAnalysis.findMany({
        where: {
          assignmentStatus: { in: [AssignmentStatus.PENDING, AssignmentStatus.WAITING, AssignmentStatus.DISABLED, AssignmentStatus.FAILED] },
          ticket: { is: { status: { in: activeTicketStatuses() } } },
        },
      select: { ticketId: true },
      orderBy: [{ createdAt: "asc" }, { ticketId: "asc" }],
      take: 50,
      ...(cursor ? { cursor: { ticketId: cursor }, skip: 1 } : {}),
    });
    if (!tickets.length) break;
    const results = await Promise.all(tickets.map(({ ticketId }) => assignAutomatically(ticketId)));
    attempted += results.length;
    assigned += results.filter((result) => result.status === AssignmentStatus.ASSIGNED).length;
    cursor = tickets[tickets.length - 1]?.ticketId;
    if (tickets.length < 50 || !cursor) break;
  }
  return { attempted, assigned };
}

export async function getAssignmentHistory(ticketId: string, actor: TicketActor) {
  if (actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Only administrators can view assignment history.");
  }
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          assignedTo: { select: { id: true, fullName: true } },
          assignedBy: { select: { id: true, fullName: true } },
          previousAgent: { select: { id: true, fullName: true } },
        },
      },
    },
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  return ticket.assignments;
}

export async function retryAssignment(ticketId: string, actor: TicketActor) {
  if (actor.role !== UserRole.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Only administrators can retry automatic assignment.");
  }
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { assignedAgentId: true, analysis: true, status: true } });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (ticket.assignedAgentId) throw new ApiError(409, "TICKET_ALREADY_ASSIGNED", "The ticket is already assigned.");
  if (!activeTicketStatuses().includes(ticket.status)) throw new ApiError(409, "TICKET_NOT_ACTIVE", "Only active tickets can be automatically assigned.");
  if (!ticket.analysis) throw new ApiError(409, "ANALYSIS_UNAVAILABLE", "Ticket analysis is not available for retry.");
  return assignAutomatically(ticketId);
}

export async function updateAutomaticAssignmentSetting(input: { automaticEnabled: boolean }) {
  const settings = await updateAssignmentSettings(input);
  if (!settings.automaticEnabled) {
    await prisma.ticketAnalysis.updateMany({
      where: { assignmentStatus: { in: [AssignmentStatus.PENDING, AssignmentStatus.WAITING] } },
      data: { assignmentStatus: AssignmentStatus.DISABLED },
    });
  }
  return settings;
}
