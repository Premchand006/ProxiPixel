export interface Sized {
  size: number;
}

/**
 * Binary-search an encoder's quality to land just under a target byte size.
 * The encoder is injected so the search is pure and testable. Mirrors the
 * reference's `optimizeTarget`: 9 probes between q=0.05 and q=0.95, keeping the
 * largest result that still fits; if nothing fits, fall back to q=0.05.
 */
export async function optimizeToTargetSize<T extends Sized>(
  encode: (q: number) => Promise<T>,
  targetBytes: number,
): Promise<{ result: T; q: number }> {
  let lo = 0.05;
  let hi = 0.95;
  let best: { result: T; q: number } | null = null;
  for (let i = 0; i < 9; i++) {
    const q = (lo + hi) / 2;
    const result = await encode(q);
    if (result.size > targetBytes) hi = q;
    else {
      lo = q;
      best = { result, q };
    }
  }
  if (!best) {
    const q = 0.05;
    best = { result: await encode(q), q };
  }
  return best;
}
