// Counts failures only, so a classroom sharing one IP isn't locked out by successful joins.
export function createFailureLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, { count: number; expiresAt: number }>();
  const active = (key: string, now: number) => {
    const entry = windows.get(key);
    if (entry && entry.expiresAt > now) return entry;
    windows.delete(key);
    return null;
  };
  return {
    isBlocked: (key: string, now = Date.now()) => (active(key, now)?.count ?? 0) >= limit,
    recordFailure: (key: string, now = Date.now()) => {
      const entry = active(key, now);
      if (entry) entry.count += 1; else windows.set(key, { count: 1, expiresAt: now + windowMs });
    },
    reset: (key: string) => { windows.delete(key); },
  };
}

// In-memory and per-instance: slows guessing on one server, not a hard guarantee on serverless.
export function createRateLimiter(limit: number, windowMs: number) {
  const windows = new Map<string, { count: number; expiresAt: number }>();
  return (key: string, now = Date.now()) => {
    const current = windows.get(key);
    if (!current || current.expiresAt <= now) {
      windows.set(key, { count: 1, expiresAt: now + windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}
