import type { Config } from "drizzle-kit";

// Phase 0 placeholder: db/schema.ts is the source of truth (fleshed out in
// Phase 4). DATABASE_URL / DIRECT_URL come from .env.local (see .env.example).
export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
