import { describe, expect, it } from "vitest";
import {
  MAX_OUTPUT_BYTES,
  canSaveMore,
  extForTarget,
  isShareExpired,
  ownsPath,
  savedOutputPath,
  secondsUntil,
  slugFromBytes,
  withinSizeCap,
} from "@/server/output-helpers";

describe("extForTarget", () => {
  it("maps formats to file extensions", () => {
    expect(extForTarget("jpeg")).toBe("jpg");
    expect(extForTarget("png")).toBe("png");
    expect(extForTarget("avif")).toBe("avif");
    expect(extForTarget("mp4")).toBe("mp4");
    expect(extForTarget(null)).toBe("bin");
  });
});

describe("savedOutputPath / ownsPath", () => {
  it("builds a {user}/{job}.{ext} path the owner controls", () => {
    const path = savedOutputPath("user-1", "job-9", "jpg");
    expect(path).toBe("user-1/job-9.jpg");
    expect(ownsPath("user-1", path)).toBe(true);
    expect(ownsPath("user-2", path)).toBe(false);
  });
});

describe("caps", () => {
  it("enforces the size cap", () => {
    expect(withinSizeCap(0)).toBe(false);
    expect(withinSizeCap(1024)).toBe(true);
    expect(withinSizeCap(MAX_OUTPUT_BYTES)).toBe(true);
    expect(withinSizeCap(MAX_OUTPUT_BYTES + 1)).toBe(false);
  });

  it("enforces the count cap", () => {
    expect(canSaveMore(0)).toBe(true);
    expect(canSaveMore(49)).toBe(true);
    expect(canSaveMore(50)).toBe(false);
    expect(canSaveMore(99)).toBe(false);
  });
});

describe("isShareExpired", () => {
  const now = new Date("2026-06-17T12:00:00Z");
  it("treats null as never-expiring", () => {
    expect(isShareExpired(null, now)).toBe(false);
  });
  it("expires past timestamps and honors future ones", () => {
    expect(isShareExpired(new Date("2026-06-17T11:59:59Z"), now)).toBe(true);
    expect(isShareExpired(new Date("2026-06-17T12:00:01Z"), now)).toBe(false);
    expect(isShareExpired("2026-06-16T12:00:00Z", now)).toBe(true);
  });
});

describe("secondsUntil", () => {
  const now = new Date("2026-06-17T12:00:00Z");
  it("returns remaining whole seconds, 0 if past, Infinity if null", () => {
    expect(secondsUntil(new Date("2026-06-17T13:00:00Z"), now)).toBe(3600);
    expect(secondsUntil(new Date("2026-06-17T11:00:00Z"), now)).toBe(0);
    expect(secondsUntil(null, now)).toBe(Infinity);
  });
});

describe("slugFromBytes", () => {
  it("produces a deterministic url-safe slug", () => {
    const slug = slugFromBytes(new Uint8Array([0, 0, 0]));
    expect(slug).toBe("AAAA");
    expect(slug).toMatch(/^[A-Za-z0-9_-]+$/);
  });
  it("encodes 9 bytes into a 12-char slug with no padding", () => {
    const slug = slugFromBytes(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    expect(slug).toHaveLength(12);
    expect(slug).not.toContain("=");
  });
});
