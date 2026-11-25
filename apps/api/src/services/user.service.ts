import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { ApiError, getPublicUser } from "../utils/api-response.js";
import { hashPassword } from "../utils/password.js";
import { disconnectUser } from "../sockets/realtime.js";

export async function listUsers(page: number, limit: number, role?: UserRole, search?: string) {
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(search ? {
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        phone: true,
        company: true,
        preferredDomain: true,
        isActive: true,
        createdAt: true,
        _count: { select: { customerTickets: true, assignedTickets: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total, page, limit };
}

export async function provisionAgent(input: {
  fullName: string;
  email: string;
  password: string;
  skills: { domain: "HEALTH" | "LOGISTICS" | "SMART_OPERATIONS"; category: string; skillLevel: number }[];
}) {
  const passwordHash = await hashPassword(input.password);
  const agent = await prisma.user.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      passwordHash,
      role: UserRole.AGENT,
      skills: {
        create: input.skills,
      },
    },
  });
  return getPublicUser(agent);
}

export async function setUserActive(userId: string, isActive: boolean) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new ApiError(404, "USER_NOT_FOUND", "The user account was not found.");
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive,
      ...(isActive ? {} : { sessions: { deleteMany: {} } }),
    },
  });
  if (!isActive) disconnectUser(userId);
  return getPublicUser(updated);
}
