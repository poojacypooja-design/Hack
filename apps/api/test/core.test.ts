import assert from "node:assert/strict";
import test from "node:test";
import { TicketPriority } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://solvex:placeholder@localhost:5432/solvex?schema=public";
}

const { ticketTextSimilarity, normalizeTicketText } = await import("../src/services/issue-dna.service.js");
const { calculateSlaRisk } = await import("../src/services/sla.service.js");
const { loginSchema, registerSchema } = await import("../src/utils/schemas.js");

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
  assert.match(result.recommendedAction, /Escalate immediately/);
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
