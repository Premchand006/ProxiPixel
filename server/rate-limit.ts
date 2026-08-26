import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter for server actions. Backed by Upstash Redis when configured
 * (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) so limits hold
 * across Vercel's multiple/ephemeral function instances; falls back to an
 * in-memory fixed-window limiter otherwise — a sensible default for local
 * dev or a single-instance deploy, but it resets on every redeploy and
 * doesn't share state across instances. The in-memory core (`rateLimit`) is
 * pure (time injected) so it stays unit-testable regardless of which backend
 * `allow()` picks.
 */
export interface RateBucket {
  count: number;
  resetAt: number;
}
export interface RateState {
  buckets: Map<string, RateBucket>;
}
export interface RateResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function createRateState(): RateState {
  return { buckets: new Map() };
}

export function rateLimit(
  state: RateState,
  key: string,
  now: number,
  limit: number,
  windowMs: number,
): RateResult {
  const b = state.buckets.get(key);
  if (!b || now >= b.resetAt) {
    const resetAt = now + windowMs;
    state.buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  if (b.count < limit) {
    b.count += 1;
    return { allowed: true, remaining: limit - b.count, resetAt: b.resetAt };
  }
  return { allowed: false, remaining: 0, resetAt: b.resetAt };
}

/** Drop expired buckets so the map can't grow without bound. */
export function sweep(state: RateState, now: number): void {
  for (const [k, b] of state.buckets) {
    if (now >= b.resetAt) state.buckets.delete(k);
  }
}

// ---- in-memory fallback (process-wide singleton) ----
const state = createRateState();
let lastSweep = 0;

function allowInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (now - lastSweep > windowMs) {
    sweep(state, now);
    lastSweep = now;
  }
  return rateLimit(state, key, now, limit, windowMs).allowed;
}

// ---- Redis-backed limiter (used when Upstash is configured) ----
const REDIS_CONFIGURED =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) redis = Redis.fromEnv();
  return redis;
}

// One Ratelimit instance per distinct (limit, window) pair — its algorithm
// parameters are fixed at construction, and reusing instances lets the
// Upstash client reuse its connection instead of reconnecting per call.
const limiters = new Map<string, Ratelimit>();
function getLimiter(limit: number, windowMs: number): Ratelimit {
  const cacheKey = `${limit}:${windowMs}`;
  let rl = limiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: "proxipixel:ratelimit",
      analytics: false,
    });
    limiters.set(cacheKey, rl);
  }
  return rl;
}

/**
 * Returns true if the call is within the limit for `key`. Prefers Redis when
 * configured; on a Redis error (network blip, Upstash outage) it fails open
 * to the in-memory limiter rather than blocking every mutating action — a
 * rate limiter going briefly soft under its own store's failure is a better
 * trade than an outage in a dependency taking the app down.
 */
export async function allow(
  key: string,
  limit: number,
  windowMs = 60_000,
): Promise<boolean> {
  if (REDIS_CONFIGURED) {
    try {
      const { success } = await getLimiter(limit, windowMs).limit(key);
      return success;
    } catch (err) {
      console.error("rate-limit: Redis error, falling back to in-memory", err);
    }
  }
  return allowInMemory(key, limit, windowMs);
}
