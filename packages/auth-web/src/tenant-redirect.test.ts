import { describe, expect, it } from "vitest";
import { isSameBaseDomain, resolveTenantRedirect } from "./tenant-redirect";

// Guards the post-login/logout redirect boundary (v0.12.1, D-060): a user may be returned to their
// own tenant subdomain, but never to an attacker-controlled host (open-redirect).
describe("isSameBaseDomain", () => {
  it("matches the apex and any subdomain of the base domain", () => {
    expect(isSameBaseDomain("lvh.me", "lvh.me")).toBe(true);
    expect(isSameBaseDomain("sbp.lvh.me", "lvh.me")).toBe(true);
    expect(isSameBaseDomain("a.b.lvh.me", "lvh.me")).toBe(true);
  });

  it("rejects look-alike suffixes and foreign hosts", () => {
    expect(isSameBaseDomain("evil.com", "lvh.me")).toBe(false);
    expect(isSameBaseDomain("notlvh.me", "lvh.me")).toBe(false); // suffix without the dot boundary
    expect(isSameBaseDomain("lvh.me.evil.com", "lvh.me")).toBe(false);
  });
});

describe("resolveTenantRedirect", () => {
  const canonical = "http://lvh.me:3200";

  it("allows the canonical AUTH_URL origin", () => {
    expect(resolveTenantRedirect("http://lvh.me:3200/programs", canonical, "lvh.me")).toBe(
      "http://lvh.me:3200/programs"
    );
  });

  it("resolves relative callback paths against the canonical origin", () => {
    expect(resolveTenantRedirect("/applications", canonical, "lvh.me")).toBe(
      "http://lvh.me:3200/applications"
    );
  });

  it("allows returning to a tenant subdomain of the base domain", () => {
    expect(resolveTenantRedirect("http://sbp.lvh.me:3200/", canonical, "lvh.me")).toBe(
      "http://sbp.lvh.me:3200/"
    );
  });

  it("collapses a foreign host to the canonical base (no open redirect)", () => {
    expect(resolveTenantRedirect("http://evil.com/steal", canonical, "lvh.me")).toBe(canonical);
    expect(resolveTenantRedirect("http://sbp.lvh.me.evil.com/", canonical, "lvh.me")).toBe(canonical);
  });

  it("falls back to host-only behaviour when no base domain is configured", () => {
    // Single-host deployment (APP_BASE_DOMAIN unset or "localhost"): only the AUTH_URL origin is allowed.
    expect(resolveTenantRedirect("http://sbp.localhost:3200/", "http://localhost:3200", "localhost")).toBe(
      "http://localhost:3200"
    );
    expect(resolveTenantRedirect("http://other.host/", "http://localhost:3200", undefined)).toBe(
      "http://localhost:3200"
    );
  });

  it("returns the base URL on a malformed target", () => {
    expect(resolveTenantRedirect("http://[bad", canonical, "lvh.me")).toBe(canonical);
  });
});
