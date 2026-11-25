import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../config/database.js";
import { emitToUser } from "../sockets/realtime.js";
import { ApiError } from "../utils/api-response.js";

type CreateNotificationInput = {
  userId: string;
  ticketId?: string;
  type: NotificationType;
  title: string;
  body: string;
  dedupeKey?: string;
};

export async function createNotification(input: CreateNotificationInput) {
  const data = {
    userId: input.userId,
    ticketId: input.ticketId,
    type: input.type,
    title: input.title,
    body: input.body,
    dedupeKey: input.dedupeKey,
  };
  const notification = input.dedupeKey
    ? await prisma.notification.upsert({
      where: { dedupeKey: input.dedupeKey },
      update: {},
      create: data,
    })
    : await prisma.notification.create({ data });
  emitToUser(input.userId, "notification:new", notification);
  return notification;
}

export async function notifyAdministrators(input: Omit<CreateNotificationInput, "userId">) {
  const administrators = await prisma.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });
  await Promise.all(administrators.map((administrator) => createNotification({
    ...input,
    userId: administrator.id,
    dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${administrator.id}` : undefined,
  })));
}

export async function listNotifications(userId: string, page: number, limit: number, unreadOnly: boolean) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(unreadOnly ? { readAt: null } : {}),
  };
  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        ticketId: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { items, total, unreadCount, page, limit };
}

export async function markNotificationRead(userId: string, notificationId: string, read: boolean) {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: read ? new Date() : null },
  });
  if (!result.count) {
    throw new ApiError(404, "NOTIFICATION_NOT_FOUND", "The notification was not found.");
  }
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updatedCount: result.count };
}
