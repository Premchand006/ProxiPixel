import { describe, expect, it } from "vitest";
import { allow, createRateState, rateLimit, sweep } from "@/server/rate-limit";

describe("rateLimit", () => {
  it("allows up to the limit within a window, then blocks", () => {
    const s = createRateState();
    const at = (n: number) => rateLimit(s, "u1", 1000 + n, 3, 60_000);
    expect(at(0).allowed).toBe(true); // 1
    expect(at(1).allowed).toBe(true); // 2
    expect(at(2)).toMatchObject({ allowed: true, remaining: 0 }); // 3
    expect(at(3).allowed).toBe(false); // blocked
  });

  it("resets after the window elapses", () => {
    const s = createRateState();
    expect(rateLimit(s, "u1", 0, 1, 1000).allowed).toBe(true);
    expect(rateLimit(s, "u1", 500, 1, 1000).allowed).toBe(false);
    // window passed
    expect(rateLimit(s, "u1", 1000, 1, 1000).allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const s = createRateState();
    expect(rateLimit(s, "a", 0, 1, 1000).allowed).toBe(true);
    expect(rateLimit(s, "a", 1, 1, 1000).allowed).toBe(false);
    expect(rateLimit(s, "b", 1, 1, 1000).allowed).toBe(true);
  });

  it("sweep drops expired buckets", () => {
    const s = createRateState();
    rateLimit(s, "a", 0, 1, 1000);
    rateLimit(s, "b", 0, 1, 5000);
    sweep(s, 2000);
    expect(s.buckets.has("a")).toBe(false);
    expect(s.buckets.has("b")).toBe(true);
  });
});

describe("allow", () => {
  // No UPSTASH_REDIS_REST_URL/TOKEN in the test env, so this exercises the
  // in-memory fallback path — same one a local dev or single-instance deploy
  // without Upstash configured actually runs.
  it("enforces the limit and blocks over it, keyed independently", async () => {
    const key = `test:${Math.random()}`;
    expect(await allow(key, 2)).toBe(true);
    expect(await allow(key, 2)).toBe(true);
    expect(await allow(key, 2)).toBe(false);
    expect(await allow(`other:${key}`, 2)).toBe(true);
  });
});
