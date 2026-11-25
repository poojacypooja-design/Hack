function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "::1"
    || normalized === "0.0.0.0"
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const baseUrl = configuredUrl || (process.env.NODE_ENV === "development" ? "http://localhost:4000/api" : "");
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_URL must be configured outside development.");
  }
  const parsedUrl = new URL(baseUrl);
  if (process.env.NODE_ENV === "production" && (parsedUrl.protocol !== "https:" || isLocalHostname(parsedUrl.hostname))) {
    throw new Error("Production NEXT_PUBLIC_API_URL must use HTTPS and a non-localhost hostname.");
  }
  return baseUrl.replace(/\/+$/, "");
}

type ApiEnvelope<T> = {
  success: true;
  data: T;
};

type ApiFailure = {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json");

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(`The API returned an invalid response (HTTP ${response.status}).`, response.status);
  }

  if (!response.ok) {
    const failure = payload as ApiFailure;
    throw new ApiError(
      failure.error?.message ?? `The request failed (HTTP ${response.status}).`,
      response.status,
      failure.error?.code,
      failure.error?.details,
    );
  }

  if (!isRecord(payload) || payload.success !== true || !("data" in payload)) {
    throw new ApiError("The API returned an unexpected response.", response.status);
  }

  return (payload as ApiEnvelope<T>).data;
}

export function apiJson<T>(path: string, method: "POST" | "PATCH" | "PUT", body: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method,
    body: JSON.stringify(body),
  });
}

export type ApiRole = "CUSTOMER" | "AGENT" | "ADMIN";

export type ApiUser = {
  id: string;
  email: string;
  fullName: string;
  role: ApiRole;
  phone: string | null;
  company: string | null;
  preferredDomain: "HEALTH" | "LOGISTICS" | "SMART_OPERATIONS" | null;
  isActive?: boolean;
  createdAt: string;
};

export type ApiTicket = {
  id: string;
  ticketCode: string;
  subject: string;
  description: string;
  category: string;
  domain: "HEALTH" | "LOGISTICS" | "SMART_OPERATIONS";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "WAITING_FOR_CUSTOMER" | "RESOLVED" | "CLOSED";
  customer: { id: string; fullName: string; email?: string; company?: string | null };
  assignedAgent: { id: string; fullName: string; email?: string } | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  slaRecord?: {
    firstResponseDueAt: string;
    resolutionDueAt: string;
    firstResponseAt: string | null;
    resolvedAt: string | null;
    firstResponseBreached?: boolean;
    resolutionBreached?: boolean;
    policy?: { updateIntervalHours: number } | null;
  } | null;
  messages?: ApiTicketMessage[];
  internalNotes?: ApiTicketMessage[];
  history?: ApiTicketHistory[];
  attachments?: ApiAttachment[];
  feedback?: { rating: number; comment: string | null } | null;
  _count?: { messages: number; attachments: number };
};

export type ApiTicketMessage = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; fullName: string; role: ApiRole };
};

export type ApiTicketHistory = {
  id: string;
  action: string;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; fullName: string; role: ApiRole } | null;
};

export type ApiAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ApiAnalytics = {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  slaCompliance: number;
  slaBreaches: number;
  averageResolutionTimeHours: number;
  categories: Array<{ category: string; count: number }>;
  priorities: Array<{ priority: ApiTicket["priority"]; count: number }>;
  agentWorkload: Array<{
    agentId: string;
    name: string;
    activeTickets: number;
    urgentTickets: number;
    skills: Array<{ domain: ApiTicket["domain"]; category: string; skillLevel: number }>;
  }>;
  customerSatisfaction: { averageRating: number; feedbackCount: number };
};

export type ApiSlaRisk = {
  ticketId: string;
  ticketCode: string;
  subject?: string;
  priority?: ApiTicket["priority"];
  status?: ApiTicket["status"];
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
  remainingMs: number;
  deadline: string;
  recommendedAction: string;
  factors: {
    timeRemaining: number;
    priority: number;
    ticketAge: number;
    agentWorkload: number;
    activeAgentLoad: number;
  };
};

export function roleHome(role: ApiRole) {
  return role === "CUSTOMER" ? "/customer" : role === "AGENT" ? "/agent" : "/admin";
}

export function displayStatus(status: ApiTicket["status"]): "Open" | "In progress" | "Waiting" | "Resolved" | "Closed" {
  const labels: Record<ApiTicket["status"], "Open" | "In progress" | "Waiting" | "Resolved" | "Closed"> = {
    OPEN: "Open",
    IN_PROGRESS: "In progress",
    WAITING_FOR_CUSTOMER: "Waiting",
    RESOLVED: "Resolved",
    CLOSED: "Closed",
  };
  return labels[status];
}

export function displayPriority(priority: ApiTicket["priority"]) {
  return `${priority[0]}${priority.slice(1).toLowerCase()}` as "Low" | "Medium" | "High" | "Critical";
}

export function displayDomain(domain: ApiTicket["domain"]) {
  return domain === "SMART_OPERATIONS" ? "Smart Operations" : domain[0] + domain.slice(1).toLowerCase();
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError && Array.isArray(error.details)) {
    const details = error.details
      .filter((item): item is { field: string; message: string } =>
        isRecord(item) && typeof item.field === "string" && typeof item.message === "string")
      .map((item) => `${item.field}: ${item.message}`);
    if (details.length) return `${error.message} ${details.join(" ")}`;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
