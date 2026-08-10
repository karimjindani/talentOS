type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, options: { limit: number; windowMs: number }, now = Date.now()) {
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + options.windowMs }; buckets.set(key, bucket);
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0, resetAt: bucket.resetAt };
  }
  if (current.count >= options.limit) return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)), resetAt: current.resetAt };
  current.count += 1;
  return { allowed: true, remaining: options.limit - current.count, retryAfterSeconds: 0, resetAt: current.resetAt };
}

export function requestIp(request: Request) { return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"; }
export function clearRateLimitsForTests() { buckets.clear(); }
