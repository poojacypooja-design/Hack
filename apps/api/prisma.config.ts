import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

const workingDirectory = process.cwd();
if (existsSync(path.resolve(workingDirectory, "prisma", "schema.prisma"))) {
  const rootEnvPath = path.resolve(workingDirectory, "..", "..", ".env");
  if (existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
}

const schemaOnlyCommands = new Set(["generate", "validate", "format"]);
if (!process.env.DATABASE_URL && process.argv.some((argument) => schemaOnlyCommands.has(argument))) {
  const examplePath = path.resolve(workingDirectory, ".env.example");
  if (!existsSync(examplePath)) {
    throw new Error("DATABASE_URL is required. Copy apps/api/.env.example to apps/api/.env and configure PostgreSQL.");
  }
  const exampleEnvironment = dotenv.parse(readFileSync(examplePath));
  if (!exampleEnvironment.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from apps/api/.env.example.");
  }
  process.env.DATABASE_URL = exampleEnvironment.DATABASE_URL;
  console.warn("DATABASE_URL is not configured; using the example placeholder for this schema-only Prisma command. This does not connect to PostgreSQL.");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
