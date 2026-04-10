type RateLimitStore = Map<string, { count: number; resetAt: number }>;

const store: RateLimitStore = new Map();

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}

/**
 * Simple in-memory rate limiter. Returns true if the request is allowed.
 * windowMs: window size in milliseconds
 * max: max requests per window per key
 */
export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  pruneExpired();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= max) {
    return false;
  }

  entry.count++;
  return true;
}
