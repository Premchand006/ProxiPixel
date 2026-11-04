import { describe, expect, it } from "vitest";
import {
  buildJobRow,
  buildPresetRow,
  jobInputSchema,
  presetInputSchema,
  uuidSchema,
} from "@/server/validation";

describe("jobInputSchema", () => {
  it("accepts a valid job and applies defaults", () => {
    const parsed = jobInputSchema.parse({
      kind: "convert",
      sourceName: "photo.png",
      targetFormat: "jpeg",
    });
    expect(parsed.kind).toBe("convert");
    expect(parsed.options).toEqual({});
    expect(parsed.status).toBe("done");
  });

  it("rejects an unknown tool kind and empty source name", () => {
    expect(jobInputSchema.safeParse({ kind: "magic", sourceName: "x" }).success).toBe(false);
    expect(jobInputSchema.safeParse({ kind: "convert", sourceName: "" }).success).toBe(false);
  });

  it("rejects negative sizes", () => {
    expect(
      jobInputSchema.safeParse({
        kind: "optimize",
        sourceName: "a.jpg",
        sourceSize: -1,
      }).success,
    ).toBe(false);
  });
});

describe("buildJobRow", () => {
  it("forces user_id from the session and ignores any client-supplied id", () => {
    const parsed = jobInputSchema.parse({
      kind: "convert",
      sourceName: "a.png",
      // a malicious userId is stripped by the schema (z.object drops unknown keys)
      userId: "attacker",
    } as Record<string, unknown>);
    const row = buildJobRow("real-user-id", parsed);
    expect(row.userId).toBe("real-user-id");
    expect(Object.keys(row)).not.toContain("attacker");
  });

  it("normalizes optional fields to null", () => {
    const row = buildJobRow(
      "u1",
      jobInputSchema.parse({ kind: "video", sourceName: "clip.mov" }),
    );
    expect(row.sourceFormat).toBeNull();
    expect(row.sourceSize).toBeNull();
    expect(row.outputSize).toBeNull();
  });
});

describe("presetInputSchema + buildPresetRow", () => {
  it("accepts a valid preset and scopes it to the user", () => {
    const parsed = presetInputSchema.parse({
      tool: "upscale",
      name: "Sharp 2x",
      settings: { scale: "2", method: "lanczos" },
    });
    const row = buildPresetRow("u9", parsed);
    expect(row).toEqual({
      userId: "u9",
      tool: "upscale",
      name: "Sharp 2x",
      settings: { scale: "2", method: "lanczos" },
    });
  });

  it("rejects bad tool and empty name", () => {
    expect(
      presetInputSchema.safeParse({ tool: "paint", name: "x", settings: {} }).success,
    ).toBe(false);
    expect(
      presetInputSchema.safeParse({ tool: "convert", name: "", settings: {} }).success,
    ).toBe(false);
  });
});

describe("uuidSchema", () => {
  it("accepts a uuid and rejects junk", () => {
    expect(uuidSchema.safeParse("3f2504e0-4f89-41d3-9a0c-0305e82c3301").success).toBe(true);
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});
