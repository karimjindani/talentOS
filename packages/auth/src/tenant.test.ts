import { describe, expect, it } from "vitest";
import { resolveTenantFromHost, isValidTenantSlug, RESERVED_SLUGS } from "./tenant";

describe("resolveTenantFromHost — edge cases", () => {
  it("returns default for null host", () => {
    expect(resolveTenantFromHost(null, "lvh.me", "demo")).toEqual({
      tenantSlug: "demo",
      source: "default"
    });
  });

  it("returns default for undefined host", () => {
    expect(resolveTenantFromHost(undefined, "lvh.me", "demo")).toEqual({
      tenantSlug: "demo",
      source: "default"
    });
  });

  it("returns default for empty string", () => {
    expect(resolveTenantFromHost("", "lvh.me", "demo")).toEqual({
      tenantSlug: "demo",
      source: "default"
    });
  });

  it("strips port from host header", () => {
    expect(resolveTenantFromHost("paysyslabs.lvh.me:3100", "lvh.me", "demo")).toEqual({
      tenantSlug: "paysyslabs",
      source: "subdomain"
    });
  });

  it("strips protocol from host header", () => {
    expect(resolveTenantFromHost("https://paysyslabs.lvh.me:3100", "lvh.me", "demo")).toEqual({
      tenantSlug: "paysyslabs",
      source: "subdomain"
    });
  });

  it("lowercases the hostname before resolving", () => {
    expect(resolveTenantFromHost("PaySysLabs.lvh.me:3100", "lvh.me", "demo")).toEqual({
      tenantSlug: "paysyslabs",
      source: "subdomain"
    });
  });

  it("extracts the last subdomain label for multi-level subdomains", () => {
    expect(resolveTenantFromHost("app.demo.lvh.me", "lvh.me", "demo")).toEqual({
      tenantSlug: "demo",
      source: "subdomain"
    });
  });

  it("resolves localhost subdomains", () => {
    expect(resolveTenantFromHost("acme.localhost:3000", "lvh.me", "demo")).toEqual({
      tenantSlug: "acme",
      source: "subdomain"
    });
  });

  it("falls back to default for apex domain (no subdomain)", () => {
    expect(resolveTenantFromHost("lvh.me", "lvh.me", "demo")).toEqual({
      tenantSlug: "demo",
      source: "default"
    });
  });

  it("falls back to default for a foreign domain", () => {
    expect(resolveTenantFromHost("evil.com", "lvh.me", "demo")).toEqual({
      tenantSlug: "demo",
      source: "default"
    });
  });

  it("does not match look-alike domains (suffix but not subdomain)", () => {
    expect(resolveTenantFromHost("evillvh.me", "lvh.me", "demo")).toEqual({
      tenantSlug: "demo",
      source: "default"
    });
  });
});

describe("isValidTenantSlug — edge cases", () => {
  it("accepts a simple lowercase slug", () => {
    expect(isValidTenantSlug("acme")).toBe(true);
  });

  it("accepts a slug with numbers", () => {
    expect(isValidTenantSlug("acme123")).toBe(true);
  });

  it("accepts a slug with hyphens", () => {
    expect(isValidTenantSlug("acme-corp")).toBe(true);
  });

  it("accepts a single-character slug", () => {
    expect(isValidTenantSlug("a")).toBe(true);
  });

  it("accepts a two-character slug", () => {
    expect(isValidTenantSlug("ab")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidTenantSlug("")).toBe(false);
  });

  it("rejects uppercase letters", () => {
    expect(isValidTenantSlug("Acme")).toBe(false);
  });

  it("rejects a leading hyphen", () => {
    expect(isValidTenantSlug("-acme")).toBe(false);
  });

  it("rejects a trailing hyphen", () => {
    expect(isValidTenantSlug("acme-")).toBe(false);
  });

  it("rejects spaces", () => {
    expect(isValidTenantSlug("ac me")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(isValidTenantSlug("acme!")).toBe(false);
  });

  it("rejects all reserved slugs", () => {
    // Test a representative sample of reserved slugs
    for (const slug of ["www", "admin", "api", "demo", "keycloak", "ops", "s3", "minio"]) {
      expect(isValidTenantSlug(slug)).toBe(false);
      expect(RESERVED_SLUGS.has(slug)).toBe(true);
    }
  });

  it("rejects slugs that exceed 40 characters", () => {
    expect(isValidTenantSlug("a".repeat(41))).toBe(false);
  });

  it("accepts a slug of exactly 40 characters", () => {
    expect(isValidTenantSlug("a".repeat(40))).toBe(true);
  });
});
