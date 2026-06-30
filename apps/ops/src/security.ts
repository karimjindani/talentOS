import { timingSafeEqual } from "node:crypto";

export function extractBearerToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1] : null;
}

export function isAuthorized(header: string | string[] | undefined, expectedToken: string): boolean {
  const receivedToken = extractBearerToken(header);
  if (!receivedToken || !expectedToken) return false;

  const received = Buffer.from(receivedToken);
  const expected = Buffer.from(expectedToken);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
