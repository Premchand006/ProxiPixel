"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "./db";
import { insertShare, selectJobById } from "./queries";
import { SHARE_TTL_SECONDS, slugFromBytes } from "./output-helpers";
import { uuidSchema } from "./validation";
import { allow } from "./rate-limit";

/**
 * Create an expiring public share for a *saved* output. Owner-only; the share
 * resolves to a short-lived signed URL in /s/[slug]. Returns the slug.
 */
export async function createShare(
  jobId: string,
): Promise<{ ok: boolean; slug?: string; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!(await allow(`share:${user.id}`, 20)))
    return { ok: false, error: "Too many requests — slow down." };

  const parsed = uuidSchema.safeParse(jobId);
  if (!parsed.success) return { ok: false, error: "Invalid id" };

  const db = getDb();
  const job = await selectJobById(db, parsed.data, user.id);
  if (!job) return { ok: false, error: "Job not found" };
  if (!job.outputPath) return { ok: false, error: "Save the output first" };

  const slug = slugFromBytes(randomBytes(9));
  const expiresAt = new Date(Date.now() + SHARE_TTL_SECONDS * 1000);
  await insertShare(db, { jobId: parsed.data, slug, expiresAt });
  return { ok: true, slug };
}
