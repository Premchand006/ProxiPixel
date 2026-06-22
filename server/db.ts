import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

/**
 * Drizzle client over the Supabase Postgres connection. Server-only — this
 * connects with DATABASE_URL (full privileges, bypasses RLS), so every caller
 * MUST scope queries by the authenticated user id. RLS in db/policies.sql is
 * defense-in-depth for any direct anon-key access.
 *
 * Lazily created so the build (and signed-out code paths) never require a DB.
 */
export type Db = PostgresJsDatabase<typeof schema>;

let db: Db | undefined;

export function getDb(): Db {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // `prepare: false` is required for Supabase's transaction-mode pooler.
    const client = postgres(url, { prepare: false });
    db = drizzle(client, { schema });
  }
  return db;
}
