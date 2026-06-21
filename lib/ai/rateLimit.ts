// SIMPLICITY NOTE: module-scope in-memory map, no Redis/edge-config dependency.
// Resets on server restart and doesn't share state across instances — acceptable
// for a single-instance personal/small-scale deployment per PRD Section 6.5;
// revisit only if this app gets multi-instance traffic.

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(ip: string, now: number = Date.now()): RateLimitResult {
  const bucket = buckets.get(ip);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (bucket.count < MAX_REQUESTS_PER_WINDOW) {
    bucket.count += 1;
    return { allowed: true, retryAfterMs: 0 };
  }

  return { allowed: false, retryAfterMs: WINDOW_MS - (now - bucket.windowStart) };
}

// Test-only: clears all buckets so rateLimit.test.ts cases don't bleed into each other.
export function _resetRateLimitForTests(): void {
  buckets.clear();
}
