import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prefer a direct database connection for schema changes. The application
    // can continue using an Accelerate URL through POSTGRES_URL at runtime.
    url: process.env.DIRECT_DATABASE_URL || env("POSTGRES_URL"),
  },
});
