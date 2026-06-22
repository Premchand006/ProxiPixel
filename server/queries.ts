import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { jobs, presets, shares } from "@/db/schema";
import type { Db } from "./db";
import type { JobRowInsert, PresetRowInsert } from "./validation";

/**
 * Data-access helpers. Each takes the Drizzle instance explicitly and scopes
 * by `userId`, so they can be exercised in integration tests with a test db.
 * The "use server" actions wrap these with auth + Zod validation.
 */

export async function insertJobRow(
  db: Db,
  row: JobRowInsert,
): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(jobs)
    .values(row)
    .returning({ id: jobs.id });
  return { id: inserted!.id };
}

export type JobRecord = typeof jobs.$inferSelect;

export function selectJobsForUser(
  db: Db,
  userId: string,
  limit = 100,
): Promise<JobRecord[]> {
  return db
    .select()
    .from(jobs)
    .where(eq(jobs.userId, userId))
    .orderBy(desc(jobs.createdAt))
    .limit(limit);
}

export async function insertPresetRow(
  db: Db,
  row: PresetRowInsert,
): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(presets)
    .values(row)
    .returning({ id: presets.id });
  return { id: inserted!.id };
}

export type PresetRecord = typeof presets.$inferSelect;

export function selectPresetsForUser(
  db: Db,
  userId: string,
): Promise<PresetRecord[]> {
  return db
    .select()
    .from(presets)
    .where(eq(presets.userId, userId))
    .orderBy(desc(presets.createdAt));
}

/** Delete scoped to the owner — the `userId` predicate is the guard. */
export async function deletePresetForUser(
  db: Db,
  id: string,
  userId: string,
): Promise<number> {
  const deleted = await db
    .delete(presets)
    .where(and(eq(presets.id, id), eq(presets.userId, userId)))
    .returning({ id: presets.id });
  return deleted.length;
}

// ---- saved outputs ----

export async function selectJobById(
  db: Db,
  id: string,
  userId: string,
): Promise<JobRecord | undefined> {
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .limit(1);
  return row;
}

/** Unscoped lookup — server-only, used for resolving public shares. */
export async function selectJobByIdAny(
  db: Db,
  id: string,
): Promise<JobRecord | undefined> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return row;
}

export async function countSavedOutputs(
  db: Db,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)` })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), isNotNull(jobs.outputPath)));
  return Number(row?.c ?? 0);
}

/** Attach a storage path to a job, scoped to the owner. Returns rows updated. */
export async function setJobOutputPath(
  db: Db,
  id: string,
  userId: string,
  path: string,
): Promise<number> {
  const updated = await db
    .update(jobs)
    .set({ outputPath: path })
    .where(and(eq(jobs.id, id), eq(jobs.userId, userId)))
    .returning({ id: jobs.id });
  return updated.length;
}

// ---- shares ----

export type ShareRecord = typeof shares.$inferSelect;

export async function insertShare(
  db: Db,
  row: { jobId: string; slug: string; expiresAt: Date | null },
): Promise<{ slug: string }> {
  const [inserted] = await db
    .insert(shares)
    .values(row)
    .returning({ slug: shares.slug });
  return { slug: inserted!.slug };
}

export async function selectShareBySlug(
  db: Db,
  slug: string,
): Promise<ShareRecord | undefined> {
  const [row] = await db
    .select()
    .from(shares)
    .where(eq(shares.slug, slug))
    .limit(1);
  return row;
}
