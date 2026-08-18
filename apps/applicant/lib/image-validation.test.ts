import { describe, expect, it } from "vitest";
import { hasValidImageSignature } from "./image-validation";

describe("graduate photo signature validation", () => {
  it("accepts matching JPEG, PNG, and WebP headers", () => {
    expect(hasValidImageSignature("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe(true);
    expect(hasValidImageSignature("image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(hasValidImageSignature("image/webp", new TextEncoder().encode("RIFF1234WEBP"))).toBe(true);
  });
  it("rejects spoofed and unsupported files", () => {
    expect(hasValidImageSignature("image/png", new TextEncoder().encode("not an image"))).toBe(false);
    expect(hasValidImageSignature("image/svg+xml", new TextEncoder().encode("<svg>"))).toBe(false);
  });
});
