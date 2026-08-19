/**
 * Token Generation for Recruiter Access
 * Generates secure, verifiable tokens for email links
 */

import crypto from "crypto";

/**
 * Generate a secure random token
 * Returns a 32-byte random token in URL-safe base64 format
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Hash a token for storage in database
 * Never store plain tokens, always hash them
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a token against its hash
 */
export function verifyToken(token: string, hash: string): boolean {
  const tokenHash = hashToken(token);
  const tokenBuffer = Buffer.from(tokenHash);
  const hashBuffer = Buffer.from(hash);
  return tokenBuffer.length === hashBuffer.length && crypto.timingSafeEqual(tokenBuffer, hashBuffer);
}

/**
 * Generate a verification URL
 */
export function generateVerificationUrl(
  baseUrl: string,
  token: string
): string {
  const url = new URL("/graduates/verify", baseUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Calculate token expiry (7 days from now)
 */
export function calculateTokenExpiry(daysFromNow: number = 7): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + daysFromNow);
  return expiry;
}

export default {
  generateSecureToken,
  hashToken,
  verifyToken,
  generateVerificationUrl,
  calculateTokenExpiry,
};
