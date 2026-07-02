import { describe, expect, it } from "vitest";
import { normalizeEmail } from "./users";

// Email is the identity join key and the unique index is case-sensitive, so every write path must
// normalize to one canonical form (v0.10.4). These guard against duplicate/orphaned User rows.
describe("normalizeEmail", () => {
  it("lowercases and trims surrounding whitespace", () => {
    expect(normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
  });

  it("is idempotent", () => {
    expect(normalizeEmail(normalizeEmail("Bob@X.io"))).toBe("bob@x.io");
  });

  it("collapses casing variants to a single identity", () => {
    expect(normalizeEmail("OWNER@acme.test")).toBe(normalizeEmail("owner@ACME.test"));
  });
});
