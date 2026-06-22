/**
 * Pure helpers for saved outputs + shares. No DB / no "use server", so they are
 * unit-testable and safe to import from server actions and pages alike.
 */

export const STORAGE_BUCKET = "outputs";

/** Per-user caps on saved outputs (defense against storage abuse). */
export const MAX_SAVED_OUTPUTS = 50;
export const MAX_OUTPUT_BYTES = 25 * 1024 * 1024; // 25 MB

/** Public share links expire after this long. */
export const SHARE_TTL_SECONDS = 24 * 60 * 60;

/** Signed-URL lifetime for downloads. */
export const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** File extension for a stored output, derived from the job's target format. */
export function extForTarget(fmt: string | null | undefined): string {
  if (!fmt) return "bin";
  const f = fmt.toLowerCase();
  return f === "jpeg" ? "jpg" : f;
}

/** Storage path convention: `{user_id}/{job_id}.{ext}` (RLS keys off folder 1). */
export function savedOutputPath(
  userId: string,
  jobId: string,
  ext: string,
): string {
  return `${userId}/${jobId}.${ext}`;
}

export function withinSizeCap(size: number): boolean {
  return size > 0 && size <= MAX_OUTPUT_BYTES;
}

export function canSaveMore(savedCount: number): boolean {
  return savedCount < MAX_SAVED_OUTPUTS;
}

/** A path belongs to the user iff it sits under their `{user_id}/` folder. */
export function ownsPath(userId: string, path: string): boolean {
  return path.startsWith(`${userId}/`);
}

export function isShareExpired(
  expiresAt: Date | string | null,
  now: Date,
): boolean {
  if (!expiresAt) return false; // null = never expires
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return d.getTime() <= now.getTime();
}

/** Whole seconds until `expiresAt` (0 if past; Infinity if null). */
export function secondsUntil(
  expiresAt: Date | string | null,
  now: Date,
): number {
  if (!expiresAt) return Infinity;
  const d = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return Math.max(0, Math.floor((d.getTime() - now.getTime()) / 1000));
}

/** URL-safe slug from random bytes (base64url, no padding). */
export function slugFromBytes(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}
