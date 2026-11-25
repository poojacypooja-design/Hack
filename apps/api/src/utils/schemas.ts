import { z } from "zod";

const uuid = z.string().uuid();
const email = z.string().trim().email().max(320).transform((value) => value.toLowerCase());
const password = z.string().min(12).max(128).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "Password must not exceed 72 UTF-8 bytes.",
);
const loginPassword = z.string().min(1).max(128).refine(
  (value) => Buffer.byteLength(value, "utf8") <= 72,
  "Password must not exceed 72 UTF-8 bytes.",
);
const domain = z.enum(["HEALTH", "LOGISTICS", "SMART_OPERATIONS"]);
const priority = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
const status = z.enum(["OPEN", "IN_PROGRESS", "WAITING_FOR_CUSTOMER", "RESOLVED", "CLOSED"]);

export const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email,
  password,
  phone: z.string().trim().max(32).optional(),
  company: z.string().trim().max(160).optional(),
  preferredDomain: domain.optional(),
}).strict();

export const loginSchema = z.object({
  email,
  password: loginPassword,
}).strict();

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  preferredDomain: domain.nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const provisionAgentSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email,
  password,
  skills: z.array(z.object({
    domain,
    category: z.string().trim().min(2).max(100),
    skillLevel: z.number().int().min(1).max(5).default(1),
  }).strict()).max(50).default([]),
}).strict();

export const createTicketSchema = z.object({
  subject: z.string().trim().min(6).max(180),
  description: z.string().trim().min(15).max(5000),
  category: z.string().trim().min(2).max(100),
  domain,
  priority: priority.default("MEDIUM"),
}).strict();

export const updateTicketSchema = z.object({
  subject: z.string().trim().min(6).max(180).optional(),
  description: z.string().trim().min(15).max(5000).optional(),
  category: z.string().trim().min(2).max(100).optional(),
  priority: priority.optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");

export const updateStatusSchema = z.object({
  status,
  note: z.string().trim().max(500).optional(),
}).strict();

export const ticketParamsSchema = z.object({ ticketId: uuid }).strict();
export const attachmentParamsSchema = z.object({ ticketId: uuid, attachmentId: uuid }).strict();
export const userParamsSchema = z.object({ userId: uuid }).strict();
export const notificationParamsSchema = z.object({ notificationId: uuid }).strict();
export const incidentParamsSchema = z.object({ incidentId: uuid }).strict();

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: status.optional(),
  priority: priority.optional(),
  domain: domain.optional(),
  search: z.string().trim().max(120).optional(),
  assigned: z.enum(["me", "unassigned", "all"]).optional(),
}).strict();

export const messageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
}).strict();

export const assignmentSchema = z.object({
  agentId: uuid,
  note: z.string().trim().max(500).optional(),
}).strict();

export const escalationSchema = z.object({
  note: z.string().trim().min(3).max(500),
}).strict();

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  agentRating: z.number().int().min(1).max(5),
  communicationRating: z.number().int().min(1).max(5),
  resolutionRating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
  suggestions: z.string().trim().max(2000).optional(),
}).strict();

export const resolutionSchema = z.object({
  title: z.string().trim().min(4).max(180),
  issueSummary: z.string().trim().min(10).max(2000),
  solution: z.string().trim().min(10).max(10000),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
}).strict();

export const incidentReviewSchema = z.object({
  status: z.enum(["CONFIRMED", "RESOLVED"]),
}).strict();

export const incidentGroupSchema = z.object({
  ticketIds: z.array(uuid).min(2).max(30).refine((ids) => new Set(ids).size === ids.length, "Ticket IDs must be unique."),
  title: z.string().trim().min(4).max(180),
  summary: z.string().trim().min(10).max(1000),
}).strict();

export const policySchema = z.object({
  domain,
  priority,
  firstResponseMinutes: z.number().int().min(1).max(100800),
  resolutionMinutes: z.number().int().min(1).max(100800),
  updateIntervalHours: z.number().int().min(1).max(168).default(4),
  isActive: z.boolean().default(true),
}).strict();

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  unreadOnly: z.enum(["true", "false"]).optional(),
}).strict();

export const analyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().refine((value) => !value.from || !value.to || value.from <= value.to, "from must be earlier than to.");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export const notificationReadSchema = z.object({
  read: z.boolean().default(true),
}).strict();

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  role: z.enum(["CUSTOMER", "AGENT", "ADMIN"]).optional(),
  search: z.string().trim().max(120).optional(),
}).strict();

export const userStatusSchema = z.object({
  isActive: z.boolean(),
}).strict();

export const ticketFeedbackParamsSchema = z.object({ ticketId: uuid }).strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
