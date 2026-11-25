import { createHash, randomBytes } from "node:crypto";
import { UserRole, type Prisma, type User } from "@prisma/client";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { ApiError, getPublicUser } from "../utils/api-response.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import type { LoginInput, RegisterInput } from "../utils/schemas.js";
import { disconnectSession } from "../sockets/realtime.js";

type SessionResult = {
  token: string;
  expiresAt: Date;
  user: ReturnType<typeof getPublicUser>;
};

function sessionToken() {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(user: User, database: Pick<Prisma.TransactionClient, "session"> = prisma): Promise<SessionResult> {
  const token = sessionToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);
  await database.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });
  return { token, expiresAt, user: getPublicUser(user) };
}

export async function registerCustomer(input: RegisterInput): Promise<SessionResult> {
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: UserRole.CUSTOMER,
        phone: input.phone,
        company: input.company,
        preferredDomain: input.preferredDomain,
      },
    });
    return createSession(user, transaction);
  });
}

export async function login(input: LoginInput, expectedRole?: UserRole): Promise<SessionResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const passwordMatches = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!user || !passwordMatches || !user.isActive || (expectedRole && user.role !== expectedRole)) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }
  return createSession(user);
}

export async function revokeSessionToken(token: string | undefined): Promise<void> {
  if (!token || token.length < 32) return;
  const tokenHash = hashToken(token);
  const session = await prisma.session.findUnique({ where: { tokenHash }, select: { id: true } });
  if (!session) return;
  await prisma.session.delete({ where: { id: session.id } });
  disconnectSession(session.id);
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "The user account was not found.");
  return getPublicUser(user);
}

export async function updateProfile(userId: string, input: {
  fullName?: string;
  phone?: string | null;
  company?: string | null;
  preferredDomain?: User["preferredDomain"];
}) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
  });
  return getPublicUser(user);
}
