import {
  NotificationType,
  TicketPriority,
  TicketStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-response.js";
import { logger } from "../utils/logger.js";
import { emitToAdministrators, emitToUser } from "../sockets/realtime.js";
import { createNotification, notifyAdministrators } from "./notification.service.js";
import { activeTicketStatuses, assertTicketAccess, authorizedUnassignedWhere, type TicketActor } from "./ticket-access.service.js";

export type SlaRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const priorityWeight: Record<TicketPriority, number> = {
  LOW: 0,
  MEDIUM: 8,
  HIGH: 18,
  CRITICAL: 25,
};

export function calculateSlaRisk(
  ticket: {
    createdAt: Date;
    priority: TicketPriority;
    assignedAgentId: string | null;
    slaRecord: {
      firstResponseAt: Date | null;
      firstResponseDueAt: Date;
      resolutionDueAt: Date;
    } | null;
  },
  activeAgentLoad: number,
  now = new Date(),
) {
  const sla = ticket.slaRecord;
  if (!sla) throw new ApiError(503, "SLA_POLICY_MISSING", "This ticket has no configured SLA record.");
  const deadline = sla.firstResponseAt ? sla.resolutionDueAt : sla.firstResponseDueAt;
  const targetMs = sla.firstResponseAt
    ? Math.max(1, sla.resolutionDueAt.getTime() - ticket.createdAt.getTime())
    : Math.max(1, sla.firstResponseDueAt.getTime() - ticket.createdAt.getTime());
  const remainingMs = deadline.getTime() - now.getTime();
  const remainingRatio = remainingMs / targetMs;
  const timeScore = remainingMs <= 0 ? 70
    : remainingRatio <= 0.1 ? 58
      : remainingRatio <= 0.25 ? 44
        : remainingRatio <= 0.5 ? 30
          : 10;
  const ageHours = Math.max(0, (now.getTime() - ticket.createdAt.getTime()) / 3_600_000);
  const ageScore = Math.min(12, Math.floor(ageHours / 4));
  const workloadScore = ticket.assignedAgentId ? Math.min(15, activeAgentLoad * 2) : 0;
  const score = Math.min(100, timeScore + priorityWeight[ticket.priority] + ageScore + workloadScore);
  const level: SlaRiskLevel = score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 38 ? "MEDIUM" : "LOW";
  const recommendedAction = level === "CRITICAL"
    ? ticket.assignedAgentId ? "Escalate immediately and consider reassignment to an available specialist." : "Assign an available specialist immediately."
    : level === "HIGH"
      ? ticket.assignedAgentId ? "Ask the assigned agent for an update and review workload." : "Prioritize assignment to a matching specialist."
      : level === "MEDIUM" ? "Monitor the deadline and schedule a progress update." : "Continue normal monitoring.";

  return {
    level,
    score,
    remainingMs,
    deadline,
    recommendedAction,
    factors: {
      timeRemaining: Math.round(timeScore),
      priority: priorityWeight[ticket.priority],
      ticketAge: ageScore,
      agentWorkload: workloadScore,
      activeAgentLoad,
    },
  };
}

async function getActiveLoad(agentId: string | null) {
  if (!agentId) return 0;
  return prisma.ticket.count({
    where: {
      assignedAgentId: agentId,
      status: { in: activeTicketStatuses() },
    },
  });
}

export async function getTicketRisk(ticketId: string, actor: TicketActor) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { slaRecord: { include: { policy: true } } },
  });
  if (!ticket) throw new ApiError(404, "TICKET_NOT_FOUND", "The ticket was not found.");
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "SLA risk details are available to agents and administrators.");
  }
  await assertTicketAccess(ticketId, actor);
  const risk = calculateSlaRisk(ticket, await getActiveLoad(ticket.assignedAgentId));
  return { ticketId, ticketCode: ticket.ticketCode, ...risk };
}

export async function listSlaRisks(actor: TicketActor) {
  if (actor.role === UserRole.CUSTOMER) {
    throw new ApiError(403, "FORBIDDEN", "SLA risk monitoring is restricted to agents and administrators.");
  }
  const skills = actor.role === UserRole.AGENT ? await authorizedUnassignedWhere(actor.userId) : [];
  const ticketWhere: Prisma.TicketWhereInput = {
    status: { in: activeTicketStatuses() },
    ...(actor.role === UserRole.AGENT ? {
      OR: [
        { assignedAgentId: actor.userId },
        ...(skills.length ? [{ assignedAgentId: null, OR: skills }] : []),
      ],
    } : {}),
  };
  const tickets = await prisma.ticket.findMany({
    where: ticketWhere,
    include: { slaRecord: { include: { policy: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  const loads = new Map<string, number>();
  const rows = await Promise.all(tickets.filter((ticket) => ticket.slaRecord).map(async (ticket) => {
    const load = ticket.assignedAgentId
      ? loads.get(ticket.assignedAgentId) ?? await getActiveLoad(ticket.assignedAgentId)
      : 0;
    if (ticket.assignedAgentId) loads.set(ticket.assignedAgentId, load);
    return {
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      subject: ticket.subject,
      priority: ticket.priority,
      status: ticket.status,
      assignedAgentId: ticket.assignedAgentId,
      ...calculateSlaRisk(ticket, load),
    };
  }));
  return rows.sort((a, b) => b.score - a.score || a.deadline.getTime() - b.deadline.getTime());
}

export async function listPolicies() {
  return prisma.sLAPolicy.findMany({ orderBy: [{ domain: "asc" }, { priority: "desc" }] });
}

export async function savePolicy(input: {
  domain: "HEALTH" | "LOGISTICS" | "SMART_OPERATIONS";
  priority: TicketPriority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  updateIntervalHours: number;
  isActive: boolean;
}) {
  if (input.resolutionMinutes < input.firstResponseMinutes) {
    throw new ApiError(400, "INVALID_SLA_TARGET", "Resolution time must be at least as long as first response time.");
  }
  return prisma.sLAPolicy.upsert({
    where: { domain_priority: { domain: input.domain, priority: input.priority } },
    update: input,
    create: input,
  });
}

export async function runSlaMonitoringSweep(now = new Date()) {
  const activeStatuses = activeTicketStatuses();
  const tickets = await prisma.ticket.findMany({
    where: { status: { in: activeStatuses }, slaRecord: { isNot: null } },
    include: {
      slaRecord: { include: { policy: true } },
      assignedAgent: { select: { id: true } },
    },
  });
  let warnings = 0;
  let silenceAlerts = 0;
  for (const ticket of tickets) {
    if (!ticket.slaRecord) continue;
    const firstResponseBreached = !ticket.slaRecord.firstResponseAt
      && now > ticket.slaRecord.firstResponseDueAt;
    const resolutionBreached = now > ticket.slaRecord.resolutionDueAt;
    if (
      (firstResponseBreached && !ticket.slaRecord.firstResponseBreached)
      || (resolutionBreached && !ticket.slaRecord.resolutionBreached)
    ) {
      await prisma.sLARecord.update({
        where: { ticketId: ticket.id },
        data: {
          ...(firstResponseBreached ? { firstResponseBreached: true } : {}),
          ...(resolutionBreached ? { resolutionBreached: true } : {}),
        },
      });
    }
    const activeLoad = await getActiveLoad(ticket.assignedAgentId);
    const risk = calculateSlaRisk(ticket, activeLoad, now);
    if (risk.level === "HIGH" || risk.level === "CRITICAL") {
      const notice = {
        ticketId: ticket.id,
        type: NotificationType.SLA_WARNING,
        title: `${risk.level} SLA risk · ${ticket.ticketCode}`,
        body: risk.recommendedAction,
        dedupeKey: `sla:${ticket.id}:${risk.level}`,
      };
      if (ticket.assignedAgentId) await createNotification({ ...notice, userId: ticket.assignedAgentId });
      await notifyAdministrators(notice);
      const riskEvent = { ticketId: ticket.id, ticketCode: ticket.ticketCode, ...risk };
      if (ticket.assignedAgentId) emitToUser(ticket.assignedAgentId, "sla:warning", riskEvent);
      emitToAdministrators("sla:warning", riskEvent);
      warnings += 1;
    }

    const silenceHours = ticket.slaRecord.policy?.updateIntervalHours ?? env.NO_SILENCE_DEFAULT_HOURS;
    const silenceThreshold = new Date(now.getTime() - silenceHours * 3_600_000);
    if (ticket.updatedAt <= silenceThreshold) {
      const notice = {
        ticketId: ticket.id,
        type: NotificationType.NO_SILENCE,
        title: `Customer update needed · ${ticket.ticketCode}`,
        body: `No ticket activity has been recorded for ${silenceHours} hours. Review the case and send a genuine progress update if appropriate.`,
        dedupeKey: `no-silence:${ticket.id}:${ticket.updatedAt.toISOString()}`,
      };
      if (ticket.assignedAgentId) {
        await createNotification({ ...notice, userId: ticket.assignedAgentId });
      }
      if (
        !ticket.assignedAgentId
        || now.getTime() - ticket.updatedAt.getTime() >= silenceHours * 2 * 3_600_000
      ) {
        await notifyAdministrators(notice);
      }
      silenceAlerts += 1;
    }
  }
  if (warnings || silenceAlerts) {
    logger.info("sla.monitoring.completed", { warnings, silenceAlerts });
  }
}

export function startSlaMonitoring(intervalMs = 60_000) {
  const timer = setInterval(() => {
    void runSlaMonitoringSweep().catch((error: unknown) => {
      logger.error("sla.monitoring.failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    });
  }, intervalMs);
  timer.unref();
  void runSlaMonitoringSweep().catch((error: unknown) => {
    logger.error("sla.monitoring.failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  });
  return timer;
}
