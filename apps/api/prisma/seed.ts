import { PrismaClient, TicketPriority, UserRole } from "@prisma/client";
import { env } from "../src/config/env.js";
import { hashPassword } from "../src/utils/password.js";
import { logger } from "../src/utils/logger.js";

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

const policies = [
  { priority: TicketPriority.LOW, firstResponseMinutes: 480, resolutionMinutes: 4320 },
  { priority: TicketPriority.MEDIUM, firstResponseMinutes: 240, resolutionMinutes: 1440 },
  { priority: TicketPriority.HIGH, firstResponseMinutes: 60, resolutionMinutes: 480 },
  { priority: TicketPriority.CRITICAL, firstResponseMinutes: 15, resolutionMinutes: 120 },
];
const domains = ["HEALTH", "LOGISTICS", "SMART_OPERATIONS"] as const;

async function seed() {
  for (const domain of domains) {
    for (const policy of policies) {
      await prisma.sLAPolicy.upsert({
        where: { domain_priority: { domain, priority: policy.priority } },
        update: {
          firstResponseMinutes: policy.firstResponseMinutes,
          resolutionMinutes: policy.resolutionMinutes,
          updateIntervalHours: 4,
          isActive: true,
        },
        create: {
          domain,
          ...policy,
          updateIntervalHours: 4,
        },
      });
    }
  }

  const adminSettings = [env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_NAME, env.SEED_ADMIN_PASSWORD];
  if (adminSettings.some(Boolean) && !adminSettings.every(Boolean)) {
    throw new Error("Set all three SEED_ADMIN_* variables to provision the development administrator.");
  }
  if (env.SEED_ADMIN_EMAIL && env.SEED_ADMIN_NAME && env.SEED_ADMIN_PASSWORD) {
    const existing = await prisma.user.findUnique({ where: { email: env.SEED_ADMIN_EMAIL } });
    if (existing && existing.role !== UserRole.ADMIN) {
      throw new Error("The configured seed-admin email belongs to a non-administrator account.");
    }
    if (!existing) {
      await prisma.user.create({
        data: {
          email: env.SEED_ADMIN_EMAIL,
          fullName: env.SEED_ADMIN_NAME,
          passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
          role: UserRole.ADMIN,
        },
      });
    }
  }
  logger.info("database.seed.completed", { slaPolicies: policies.length * domains.length });
}

seed()
  .catch((error: unknown) => {
    logger.error("database.seed.failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
