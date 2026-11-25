import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const workingDirectory = process.cwd();
const envPaths = [
  path.resolve(workingDirectory, ".env"),
  ...(existsSync(path.resolve(workingDirectory, "prisma", "schema.prisma"))
    ? [path.resolve(workingDirectory, "..", "..", ".env")]
    : []),
];
for (const envPath of envPaths) {
  if (existsSync(envPath)) dotenv.config({ path: envPath });
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must use the PostgreSQL protocol",
  ),
  SESSION_COOKIE_NAME: z.string().min(1).max(80).default("solvex.sid"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  UPLOAD_DIR: z.string().min(1).default("./storage/uploads"),
  NO_SILENCE_DEFAULT_HOURS: z.coerce.number().int().min(1).max(168).default(4),
  SEED_ADMIN_EMAIL: z.preprocess((value) => value === "" ? undefined : value, z.string().email().optional()),
  SEED_ADMIN_NAME: z.preprocess((value) => value === "" ? undefined : value, z.string().min(2).max(120).optional()),
  SEED_ADMIN_PASSWORD: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().min(12).refine((value) => Buffer.byteLength(value, "utf8") <= 72).optional(),
  ),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const missingDatabaseUrl = parsedEnvironment.error.issues.some((issue) => issue.path[0] === "DATABASE_URL");
  const setupHint = missingDatabaseUrl
    ? " Copy apps/api/.env.example to apps/api/.env (or configure the repository-root .env) and set DATABASE_URL."
    : "";
  throw new Error(`Invalid SOLVEX API environment configuration: ${issues.join("; ")}.${setupHint}`);
}

export const env = parsedEnvironment.data;
