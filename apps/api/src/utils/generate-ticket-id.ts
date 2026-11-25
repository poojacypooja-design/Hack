import { randomBytes } from "node:crypto";

export function generateTicketId(): string {
  const randomPart = randomBytes(4).toString("hex").toUpperCase();
  return `SVX-${Date.now().toString(36).toUpperCase()}-${randomPart}`;
}
