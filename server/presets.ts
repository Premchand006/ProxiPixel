"use server";

import { createClient } from "@/lib/supabase/server";
import { getDb } from "./db";
import {
  deletePresetForUser,
  insertPresetRow,
  selectPresetsForUser,
  type PresetRecord,
} from "./queries";
import {
  buildPresetRow,
  presetInputSchema,
  uuidSchema,
  type ActionResult,
} from "./validation";
import { allow } from "./rate-limit";

const TOO_MANY = "Too many requests — slow down.";

/** Save a named preset for the current tool. */
export async function savePreset(
  raw: unknown,
): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!(await allow(`preset-write:${user.id}`, 30))) return { ok: false, error: TOO_MANY };

  const parsed = presetInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid preset" };

  const { id } = await insertPresetRow(
    getDb(),
    buildPresetRow(user.id, parsed.data),
  );
  return { ok: true, id };
}

/** All presets for the signed-in user (most recent first). */
export async function listPresets(): Promise<PresetRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  return selectPresetsForUser(getDb(), user.id);
}

/** Delete one of the user's presets; the user-id predicate prevents cross-user deletes. */
export async function deletePreset(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (!(await allow(`preset-write:${user.id}`, 30))) return { ok: false, error: TOO_MANY };

  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid id" };

  const count = await deletePresetForUser(getDb(), parsed.data, user.id);
  return { ok: count > 0 };
}
