/**
 * Minimal in-memory fixed-window rate limiter for server actions. Per-process
 * (not distributed) — a sensible first line for a single instance; swap for
 * Redis/Upstash if you scale horizontally. The core `rateLimit` is pure (time
 * injected) so it is unit-testable.
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

// ---- process-wide singleton used by server actions ----
const state = createRateState();
let lastSweep = 0;

/** Returns true if the call is within the limit for `key`. */
export function allow(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  if (now - lastSweep > windowMs) {
    sweep(state, now);
    lastSweep = now;
  }
  return rateLimit(state, key, now, limit, windowMs).allowed;
}
