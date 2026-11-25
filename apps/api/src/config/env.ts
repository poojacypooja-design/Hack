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

function isLocalHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost"
    || normalized.endsWith(".localhost")
    || normalized === "::1"
    || normalized === "0.0.0.0"
    || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  FRONTEND_URL: z.string().url().optional(),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must use the PostgreSQL protocol",
  ),
  SESSION_COOKIE_NAME: z.string().min(1).max(80).default("solvex.sid"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  UPLOAD_DIR: z.string().min(1).default("./storage/uploads"),
  NO_SILENCE_DEFAULT_HOURS: z.coerce.number().int().min(1).max(168).default(4),
  SEED_ADMIN_EMAIL: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  SEED_ADMIN_NAME: z.preprocess((value) => value === "" ? undefined : value, z.string().optional()),
  SEED_ADMIN_PASSWORD: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().optional(),
  ),
}).superRefine((settings, context) => {
  if (settings.NODE_ENV !== "production") return;
  if (!settings.FRONTEND_URL) {
    context.addIssue({
      code: "custom",
      path: ["FRONTEND_URL"],
      message: "FRONTEND_URL must be configured for production.",
    });
  } else {
    const frontendUrl = new URL(settings.FRONTEND_URL);
    if (frontendUrl.protocol !== "https:" || isLocalHostname(frontendUrl.hostname)) {
      context.addIssue({
        code: "custom",
        path: ["FRONTEND_URL"],
        message: "Production FRONTEND_URL must use HTTPS and a non-localhost hostname.",
      });
    }
  }
  if (URL.canParse(settings.DATABASE_URL) && isLocalHostname(new URL(settings.DATABASE_URL).hostname)) {
    context.addIssue({
      code: "custom",
      path: ["DATABASE_URL"],
      message: "Production DATABASE_URL must use a non-localhost database host.",
    });
  }
});

export function parseEnvironmentSettings(settings: NodeJS.ProcessEnv) {
  return environmentSchema.safeParse(settings);
}

const parsedEnvironment = parseEnvironmentSettings(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  const missingDatabaseUrl = parsedEnvironment.error.issues.some((issue) => issue.path[0] === "DATABASE_URL");
  const setupHint = missingDatabaseUrl
    ? " Copy apps/api/.env.example to apps/api/.env (or configure the repository-root .env) and set DATABASE_URL."
    : "";
  throw new Error(`Invalid SOLVEX API environment configuration: ${issues.join("; ")}.${setupHint}`);
}

export const env = parsedEnvironment.data;

export function parseSeedAdminSettings(
  settings: Pick<typeof env, "SEED_ADMIN_EMAIL" | "SEED_ADMIN_NAME" | "SEED_ADMIN_PASSWORD">,
) {
  const { SEED_ADMIN_EMAIL: email, SEED_ADMIN_NAME: name, SEED_ADMIN_PASSWORD: password } = settings;
  const configuredValues = [email, name, password].filter((value) => value !== undefined);

  if (configuredValues.length === 0) return undefined;
  if (configuredValues.length !== 3 || !email || !name || !password) {
    throw new Error("Set all three SEED_ADMIN_* variables to provision the development administrator.");
  }
  if (!z.string().email().safeParse(email).success) {
    throw new Error("SEED_ADMIN_EMAIL must be a valid email address.");
  }
  if (name.length < 2 || name.length > 120) {
    throw new Error("SEED_ADMIN_NAME must be between 2 and 120 characters.");
  }
  if (password.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters.");
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("SEED_ADMIN_PASSWORD must be at most 72 UTF-8 bytes.");
  }

  return { email, name, password };
}
