import { z } from "zod";

/**
 * Zod schemas for the server boundary. Every server action validates its input
 * with these before touching the database. Pure module (no DB / no "use server")
 * so it is unit-testable and safe to import anywhere.
 */

export const toolEnum = z.enum([
  "convert",
  "upscale",
  "optimize",
  "watermark",
  "video",
]);
export const jobStatusEnum = z.enum(["done", "failed"]);

/** Standard result shape for mutating server actions. */
export interface ActionResult {
  ok: boolean;
  error?: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const uuidSchema = z.string().regex(UUID_RE, "invalid id");

const jsonRecord = z.record(z.string(), z.unknown());

/** Metadata recorded after a local job completes. Never includes raw media. */
export const jobInputSchema = z.object({
  kind: toolEnum,
  sourceName: z.string().min(1).max(512),
  sourceFormat: z.string().max(32).nullish(),
  sourceSize: z.number().int().nonnegative().nullish(),
  targetFormat: z.string().max(32).nullish(),
  options: jsonRecord.default({}),
  outputSize: z.number().int().nonnegative().nullish(),
  status: jobStatusEnum.default("done"),
});
export type JobInput = z.infer<typeof jobInputSchema>;

export const presetInputSchema = z.object({
  tool: toolEnum,
  name: z.string().min(1).max(80),
  settings: jsonRecord,
});
export type PresetInput = z.infer<typeof presetInputSchema>;

export interface JobRowInsert {
  userId: string;
  kind: JobInput["kind"];
  sourceName: string;
  sourceFormat: string | null;
  sourceSize: number | null;
  targetFormat: string | null;
  options: Record<string, unknown>;
  outputSize: number | null;
  status: JobInput["status"];
}

/**
 * Build the row to insert, forcing `userId` from the authenticated session.
 * The client can never set or override identity — that always comes from the
 * server-verified user. Kept pure so the enforcement is directly testable.
 */
export function buildJobRow(userId: string, input: JobInput): JobRowInsert {
  return {
    userId,
    kind: input.kind,
    sourceName: input.sourceName,
    sourceFormat: input.sourceFormat ?? null,
    sourceSize: input.sourceSize ?? null,
    targetFormat: input.targetFormat ?? null,
    options: input.options,
    outputSize: input.outputSize ?? null,
    status: input.status,
  };
}

export interface PresetRowInsert {
  userId: string;
  tool: PresetInput["tool"];
  name: string;
  settings: Record<string, unknown>;
}

export function buildPresetRow(
  userId: string,
  input: PresetInput,
): PresetRowInsert {
  return {
    userId,
    tool: input.tool,
    name: input.name,
    settings: input.settings,
  };
}
