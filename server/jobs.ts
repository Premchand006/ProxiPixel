"use server";

import { createClient } from "@/lib/supabase/server";
import { getDb } from "./db";
import {
  insertJobRow,
  selectJobsForUser,
  type JobRecord,
} from "./queries";
import { buildJobRow, jobInputSchema } from "./validation";
import { allow } from "./rate-limit";

/**
 * Persist metadata for a locally-completed job. Identity comes from the
 * server-verified session (never the client). No-ops silently when signed out
 * so the signed-out tool experience is never disrupted.
 */
export async function recordJob(
  raw: unknown,
): Promise<{ recorded: boolean; id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { recorded: false };
  // Generous: a batch run records one row per item.
  if (!allow(`job:${user.id}`, 120)) return { recorded: false };

  const parsed = jobInputSchema.safeParse(raw);
  if (!parsed.success) return { recorded: false };

  const { id } = await insertJobRow(getDb(), buildJobRow(user.id, parsed.data));
  return { recorded: true, id };
}

/** The signed-in user's job history (most recent first). */
export async function listJobs(): Promise<JobRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return selectJobsForUser(getDb(), user.id);
}
