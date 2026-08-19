import { describe, expect, it } from "vitest";
import { calculateTokenExpiry, generateSecureToken, generateVerificationUrl, hashToken, verifyToken } from "./token-generator";

describe("recruiter access tokens", () => {
  it("generates unique URL-safe high-entropy tokens", () => {
    const first = generateSecureToken(); const second = generateSecureToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(second).not.toBe(first);
  });
  it("stores and verifies only a SHA-256 hash", () => {
    const token = generateSecureToken(); const hash = hashToken(token);
    expect(hash).toMatch(/^[a-f0-9]{64}$/); expect(hash).not.toContain(token); expect(verifyToken(token, hash)).toBe(true); expect(verifyToken(`${token}x`, hash)).toBe(false);
  });
  it("encodes the token in a verification URL", () => {
    expect(new URL(generateVerificationUrl("https://talentos.example", "a_b-c")).searchParams.get("token")).toBe("a_b-c");
  });
  it("calculates a future expiry", () => { expect(calculateTokenExpiry(1).getTime()).toBeGreaterThan(Date.now()); });
});
