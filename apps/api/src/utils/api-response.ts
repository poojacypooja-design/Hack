import type { Response } from "express";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function success<T>(response: Response, data: T, statusCode = 200) {
  return response.status(statusCode).json({ success: true, data });
}

export function getPublicUser(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  company: string | null;
  preferredDomain: string | null;
  isActive?: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    company: user.company,
    preferredDomain: user.preferredDomain,
    ...(user.isActive === undefined ? {} : { isActive: user.isActive }),
    createdAt: user.createdAt,
  };
}
