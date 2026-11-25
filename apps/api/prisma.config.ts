import "dotenv/config";
import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

const workingDirectory = process.cwd();
if (existsSync(path.resolve(workingDirectory, "prisma", "schema.prisma"))) {
  const rootEnvPath = path.resolve(workingDirectory, "..", "..", ".env");
  if (existsSync(rootEnvPath)) dotenv.config({ path: rootEnvPath });
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
