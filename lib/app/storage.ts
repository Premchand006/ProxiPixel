import { createClient } from "@/lib/supabase/client";

const BUCKET = "outputs";

/**
 * Upload a saved output to Storage from the browser, under the user's session.
 * Storage RLS restricts writes to the user's own `{user_id}/…` folder, so the
 * server-computed path is authoritative. Throws on failure.
 */
export async function uploadOutput(path: string, blob: Blob): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || "application/octet-stream",
    upsert: true,
  });
  if (error) throw new Error(error.message);
}
