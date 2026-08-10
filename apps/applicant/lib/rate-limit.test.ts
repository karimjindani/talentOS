import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimitsForTests, requestIp } from "./rate-limit";

describe("public portal rate limiting", () => {
  beforeEach(clearRateLimitsForTests);
  it("allows requests until the configured limit", () => {
    expect(checkRateLimit("contact:r1", { limit: 2, windowMs: 60_000 }, 1000).allowed).toBe(true);
    expect(checkRateLimit("contact:r1", { limit: 2, windowMs: 60_000 }, 2000).allowed).toBe(true);
    const blocked = checkRateLimit("contact:r1", { limit: 2, windowMs: 60_000 }, 3000);
    expect(blocked.allowed).toBe(false); expect(blocked.retryAfterSeconds).toBe(58);
  });
  it("resets a bucket when its window expires", () => {
    checkRateLimit("verify:ip", { limit: 1, windowMs: 1000 }, 1000);
    expect(checkRateLimit("verify:ip", { limit: 1, windowMs: 1000 }, 1999).allowed).toBe(false);
    expect(checkRateLimit("verify:ip", { limit: 1, windowMs: 1000 }, 2000).allowed).toBe(true);
  });
  it("keeps independent identities separate", () => {
    checkRateLimit("contact:a", { limit: 1, windowMs: 1000 }, 1000);
    expect(checkRateLimit("contact:b", { limit: 1, windowMs: 1000 }, 1000).allowed).toBe(true);
  });
  it("uses the first forwarded IP address", () => {
    expect(requestIp(new Request("https://example.com", { headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.1" } }))).toBe("203.0.113.8");
  });
});
