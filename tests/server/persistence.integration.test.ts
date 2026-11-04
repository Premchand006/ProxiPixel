import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { inArray } from "drizzle-orm";
import * as schema from "@/db/schema";
import { jobs, presets } from "@/db/schema";
import {
  buildJobRow,
  buildPresetRow,
  jobInputSchema,
  presetInputSchema,
} from "@/server/validation";
import {
  deletePresetForUser,
  insertJobRow,
  insertPresetRow,
  selectJobsForUser,
  selectPresetsForUser,
} from "@/server/queries";

/**
 * Integration tests against a real Postgres. Skipped unless TEST_DATABASE_URL
 * is set (so `pnpm verify` stays green without a database). These exercise the
 * data-access helpers and the per-user scoping that server actions rely on.
 *
 * NOTE: policy-level RLS (anon key, two authenticated users via PostgREST) is
 * validated against a live Supabase project per the after-deploy checklist;
 * here we connect with full privileges and assert the in-code scoping instead.
 */
const url = process.env.TEST_DATABASE_URL;
const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

describe.skipIf(!url)("persistence (integration)", () => {
  let db: PostgresJsDatabase<typeof schema>;
  let sql: ReturnType<typeof postgres>;

  beforeAll(() => {
    sql = postgres(url as string, { prepare: false });
    db = drizzle(sql, { schema });
  });

  afterAll(async () => {
    await db.delete(jobs).where(inArray(jobs.userId, [userA, userB]));
    await db.delete(presets).where(inArray(presets.userId, [userA, userB]));
    await sql.end();
  });

  it("inserts a job and reads it back scoped to the owner", async () => {
    await insertJobRow(
      db,
      buildJobRow(
        userA,
        jobInputSchema.parse({
          kind: "convert",
          sourceName: "a.png",
          targetFormat: "jpeg",
          outputSize: 1234,
        }),
      ),
    );
    await insertJobRow(
      db,
      buildJobRow(
        userB,
        jobInputSchema.parse({ kind: "optimize", sourceName: "b.jpg" }),
      ),
    );

    const aRows = await selectJobsForUser(db, userA);
    expect(aRows.length).toBe(1);
    expect(aRows[0]!.sourceName).toBe("a.png");
    // User A never sees User B's rows.
    expect(aRows.every((r) => r.userId === userA)).toBe(true);
  });

  it("round-trips a preset and denies cross-user delete", async () => {
    const { id } = await insertPresetRow(
      db,
      buildPresetRow(
        userA,
        presetInputSchema.parse({
          tool: "upscale",
          name: "Sharp 2x",
          settings: { scale: "2", method: "lanczos" },
        }),
      ),
    );

    const aPresets = await selectPresetsForUser(db, userA);
    expect(aPresets.find((p) => p.id === id)?.settings).toEqual({
      scale: "2",
      method: "lanczos",
    });

    // User B cannot delete User A's preset (predicate guards it).
    expect(await deletePresetForUser(db, id, userB)).toBe(0);
    // The owner can.
    expect(await deletePresetForUser(db, id, userA)).toBe(1);
  });
});
