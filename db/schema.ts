// db/schema.ts — source of truth for the database (Drizzle ORM, Postgres).
// RLS policies live in db/policies.sql and MUST be applied alongside this schema.

import {
  pgTable, uuid, text, bigint, jsonb, timestamp, pgEnum,
} from "drizzle-orm/pg-core";

export const jobKind = pgEnum("job_kind", ["convert", "upscale", "optimize", "watermark", "video"]);
export const jobStatus = pgEnum("job_status", ["done", "failed"]);

// Mirrors auth.users (Supabase). One profile per user, created via trigger on signup.
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),                 // references auth.users(id)
  displayName: text("display_name"),
  plan: text("plan").default("free").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per locally-completed job. Metadata only — never raw media.
export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),           // = auth.uid()
  kind: jobKind("kind").notNull(),
  sourceName: text("source_name").notNull(),
  sourceFormat: text("source_format"),
  sourceSize: bigint("source_size", { mode: "number" }),
  targetFormat: text("target_format"),
  options: jsonb("options").$type<Record<string, unknown>>().default({}).notNull(),
  outputSize: bigint("output_size", { mode: "number" }),
  outputPath: text("output_path"),             // Supabase Storage path, null unless saved
  status: jobStatus("status").default("done").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Saved tool settings, loadable back into a tab.
export const presets = pgTable("presets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  tool: text("tool").notNull(),                // 'convert' | 'upscale' | 'optimize' | 'video'
  name: text("name").notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Optional: public shareable links to a saved output.
export const shares = pgTable("shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").notNull(),
  slug: text("slug").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
