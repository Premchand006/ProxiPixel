"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "./db";
import {
  countSavedOutputs,
  selectJobById,
  setJobOutputPath,
} from "./queries";
import {
  canSaveMore,
  extForTarget,
  savedOutputPath,
  withinSizeCap,
} from "./output-helpers";
import { uuidSchema } from "./validation";
import { allow } from "./rate-limit";

/**
 * Gatekeeper for "Save to my library". Verifies ownership and enforces the
 * per-user size + count caps BEFORE the client uploads, then returns the
 * server-computed storage path (identity comes from the session, not the
 * client). The binary upload happens client-side under Storage RLS; this never
 * touches the bytes.
 */
const prepareSchema = z.object({
  jobId: uuidSchema,
  size: z.number().int().positive(),
});

export async function prepareSavedOutput(
  raw: unknown,
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!(await allow(`save:${user.id}`, 40)))
    return { ok: false, error: "Too many requests — slow down." };

  const parsed = prepareSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { jobId, size } = parsed.data;

  if (!withinSizeCap(size))
    return { ok: false, error: "Output is too large to save" };

  const db = getDb();
  const job = await selectJobById(db, jobId, user.id);
  if (!job) return { ok: false, error: "Job not found" };
  if (job.outputPath) return { ok: false, error: "Already saved" };

  if (!canSaveMore(await countSavedOutputs(db, user.id)))
    return { ok: false, error: "Saved-output limit reached" };

  const ext = extForTarget(job.targetFormat);
  return { ok: true, path: savedOutputPath(user.id, jobId, ext) };
}

/**
 * Record the storage path on the job once the client upload succeeds. The path
 * is recomputed server-side from the job (never trusted from the client), so a
 * caller cannot attach an arbitrary object key or bypass the save caps.
 */
const attachSchema = z.object({ jobId: uuidSchema });

export async function attachSavedOutput(
  raw: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const parsed = attachSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  const { jobId } = parsed.data;

  const db = getDb();
  const job = await selectJobById(db, jobId, user.id);
  if (!job) return { ok: false, error: "Job not found" };

  const path = savedOutputPath(user.id, jobId, extForTarget(job.targetFormat));
  const count = await setJobOutputPath(db, jobId, user.id, path);
  return { ok: count > 0 };
}
