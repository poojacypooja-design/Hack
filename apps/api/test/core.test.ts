import assert from "node:assert/strict";
import test from "node:test";
import { TicketPriority } from "@prisma/client";
import { getPublicUser } from "../src/utils/api-response.js";
import { hashPassword, verifyPassword } from "../src/utils/password.js";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://solvex:placeholder@localhost:5432/solvex?schema=public";
}

const { ticketTextSimilarity, normalizeTicketText } = await import("../src/services/issue-dna.service.js");
const { calculateSlaRisk } = await import("../src/services/sla.service.js");
const { calculateCsatSummary } = await import("../src/services/analytics.service.js");
const { feedbackSchema, loginSchema, registerSchema } = await import("../src/utils/schemas.js");
const { parseEnvironmentSettings, parseSeedAdminSettings } = await import("../src/config/env.js");

test("Issue DNA normalizes punctuation and diacritics before comparing tokens", () => {
  assert.deepEqual(normalizeTicketText("Café GPS — not tracking!"), ["cafe", "gps", "tracking"]);
  assert.equal(ticketTextSimilarity("GPS tracker stopped", "GPS tracker stopped"), 1);
  assert.equal(ticketTextSimilarity("GPS tracker stopped", "billing invoice missing"), 0);
});

test("SLA risk marks expired urgent deadlines critical and explains the factors", () => {
  const now = new Date("2026-01-01T12:00:00.000Z");
  const result = calculateSlaRisk({
    createdAt: new Date("2026-01-01T06:00:00.000Z"),
    priority: TicketPriority.CRITICAL,
    assignedAgentId: "agent-1",
    slaRecord: {
      firstResponseAt: null,
      firstResponseDueAt: new Date("2026-01-01T11:00:00.000Z"),
      resolutionDueAt: new Date("2026-01-01T14:00:00.000Z"),
    },
  }, 4, now);

  assert.equal(result.level, "CRITICAL");
  assert.equal(result.remainingMs, -3_600_000);
  assert.equal(result.factors.priority, 25);
  assert.equal(result.targetMs, 5 * 60 * 60_000);
  assert.equal(result.remainingRatio, 0);
  assert.match(result.recommendedAction, /Escalate immediately/);
});

test("SLA remaining ratio uses the actual active deadline duration", () => {
  const createdAt = new Date("2026-01-01T12:00:00.000Z");
  const result = calculateSlaRisk({
    createdAt,
    priority: TicketPriority.MEDIUM,
    assignedAgentId: null,
    slaRecord: {
      firstResponseAt: null,
      firstResponseDueAt: new Date("2026-01-01T13:00:00.000Z"),
      resolutionDueAt: new Date("2026-01-01T15:00:00.000Z"),
    },
  }, 0, new Date("2026-01-01T12:30:00.000Z"));
  assert.equal(result.remainingMs, 30 * 60_000);
  assert.equal(result.targetMs, 60 * 60_000);
  assert.equal(result.remainingRatio, 0.5);
});

test("CSAT counts only 4- and 5-star responses as positive", () => {
  assert.deepEqual(calculateCsatSummary([
    { rating: 1, count: 2 },
    { rating: 3, count: 1 },
    { rating: 4, count: 3 },
    { rating: 5, count: 4 },
  ]), { feedbackCount: 10, positiveCount: 7, csatPercent: 70 });
  assert.deepEqual(calculateCsatSummary([]), { feedbackCount: 0, positiveCount: 0, csatPercent: null });
});

test("feedback requires every rating to be between one and five", () => {
  const submission = {
    rating: 5,
    agentRating: 4,
    communicationRating: 5,
    resolutionRating: 4,
    comment: "Helpful response",
    suggestions: "Keep it up",
  };
  assert.equal(feedbackSchema.safeParse(submission).success, true);
  assert.equal(feedbackSchema.safeParse({ ...submission, resolutionRating: 0 }).success, false);
  assert.equal(feedbackSchema.safeParse({ ...submission, agentRating: 6 }).success, false);
});

test("password schemas enforce bcrypt's UTF-8 byte limit", () => {
  const input = {
    fullName: "Example Customer",
    email: "customer@example.com",
    phone: undefined,
    company: undefined,
    preferredDomain: undefined,
  };
  assert.equal(registerSchema.safeParse({ ...input, password: `${"a".repeat(71)}é` }).success, false);
  assert.equal(registerSchema.safeParse({ ...input, password: `${"a".repeat(68)}😀` }).success, true);
  assert.equal(loginSchema.safeParse({ email: input.email, password: `${"a".repeat(71)}é` }).success, false);
});

test("customer registration normalizes email and rejects caller-selected roles", () => {
  const input = {
    fullName: "Example Customer",
    email: " CUSTOMER@EXAMPLE.COM ",
    password: "A-unique-test-password-2026",
  };
  const valid = registerSchema.safeParse(input);
  assert.equal(valid.success, true);
  if (valid.success) assert.equal(valid.data.email, "customer@example.com");
  assert.equal(registerSchema.safeParse({ ...input, role: "ADMIN" }).success, false);
});

test("seed-only admin credentials validate when the seed runs, not during API startup", () => {
  assert.equal(parseSeedAdminSettings({ SEED_ADMIN_EMAIL: undefined, SEED_ADMIN_NAME: undefined, SEED_ADMIN_PASSWORD: undefined }), undefined);
  assert.throws(
    () => parseSeedAdminSettings({
      SEED_ADMIN_EMAIL: "admin@example.invalid",
      SEED_ADMIN_NAME: "Test Admin",
      SEED_ADMIN_PASSWORD: "short",
    }),
    /at least 12 characters/,
  );
  assert.throws(
    () => parseSeedAdminSettings({
      SEED_ADMIN_EMAIL: "admin@example.invalid",
      SEED_ADMIN_NAME: "Test Admin",
      SEED_ADMIN_PASSWORD: "x".repeat(71) + "é",
    }),
    /72 UTF-8 bytes/,
  );
  assert.equal(parseSeedAdminSettings({
    SEED_ADMIN_EMAIL: "admin@example.invalid",
    SEED_ADMIN_NAME: "Test Admin",
    SEED_ADMIN_PASSWORD: "A-strong-test-password",
  })?.email, "admin@example.invalid");
});

test("production environment rejects localhost origins and database hosts", () => {
  const validProduction = {
    NODE_ENV: "production",
    FRONTEND_URL: "https://support.example.com",
    DATABASE_URL: "postgresql://solvex:placeholder@db.example.com:5432/solvex",
  };
  assert.equal(parseEnvironmentSettings(validProduction).success, true);
  assert.equal(parseEnvironmentSettings({
    ...validProduction,
    FRONTEND_URL: "http://localhost:3000",
  }).success, false);
  assert.equal(parseEnvironmentSettings({
    ...validProduction,
    DATABASE_URL: "postgresql://solvex:placeholder@localhost:5432/solvex",
  }).success, false);
  assert.equal(parseEnvironmentSettings({
    NODE_ENV: "production",
    DATABASE_URL: validProduction.DATABASE_URL,
  }).success, false);
});

test("password hashes verify without appearing in public user data", async () => {
  const password = "A-unique-test-password-2026";
  const passwordHash = await hashPassword(password);
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("incorrect-password", passwordHash), false);

  const user = getPublicUser({
    id: "user-id",
    email: "customer@example.com",
    fullName: "Example Customer",
    role: "CUSTOMER",
    phone: null,
    company: null,
    preferredDomain: null,
    createdAt: new Date(),
    passwordHash,
  });
  assert.equal("passwordHash" in user, false);
});
