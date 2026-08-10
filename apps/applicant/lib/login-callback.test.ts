import { describe, expect, it } from "vitest";
import { resolveCallbackUrl } from "@/lib/login-callback";

// ─────────────────────────────────────────────────────────────────────────────
// Login Callback URL Resolution Tests
//
// Protects against:
// 1. SSR "window is not defined" error — the login page used to access
//    window.location.origin during render, crashing server-side rendering.
// 2. Tenant subdomain loss — the callbackUrl must preserve the tenant's
//    subdomain so the user returns to their own tenant after login, not the
//    canonical AUTH_URL host.
//
// The function is pure and testable without a DOM. In the component, it is
// called at click time (not render time) so `window` is always available.
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveCallbackUrl", () => {
  // ── Positive: relative paths ─────────────────────────────────────────────

  it("prefixes a relative path with the provided origin", () => {
    expect(resolveCallbackUrl("/application", "http://paysyslabs.lvh.me:3100")).toBe(
      "http://paysyslabs.lvh.me:3100/application"
    );
  });

  it("prefixes /dashboard with the tenant origin", () => {
    expect(resolveCallbackUrl("/dashboard", "http://acme.lvh.me:3100")).toBe(
      "http://acme.lvh.me:3100/dashboard"
    );
  });

  it("preserves query strings on relative paths", () => {
    expect(resolveCallbackUrl("/application?step=2", "http://demo.lvh.me:3100")).toBe(
      "http://demo.lvh.me:3100/application?step=2"
    );
  });

  // ── Positive: absolute URLs ──────────────────────────────────────────────

  it("returns an absolute http URL as-is", () => {
    const absolute = "http://paysyslabs.lvh.me:3100/dashboard";
    expect(resolveCallbackUrl(absolute, "http://demo.lvh.me:3100")).toBe(absolute);
  });

  it("returns an absolute https URL as-is", () => {
    const absolute = "https://app.talentos.app/dashboard";
    expect(resolveCallbackUrl(absolute, "http://demo.lvh.me:3100")).toBe(absolute);
  });

  // ── Edge cases ───────────────────────────────────────────────────────────

  it("handles a root-relative path", () => {
    expect(resolveCallbackUrl("/", "http://paysyslabs.lvh.me:3100")).toBe(
      "http://paysyslabs.lvh.me:3100/"
    );
  });

  it("handles an empty origin (SSR fallback) by returning the raw path", () => {
    // When called during SSR (window not defined), origin defaults to "".
    // The function still returns a value — it just won't be absolute.
    // The component must call this at click time, not render time.
    expect(resolveCallbackUrl("/application", "")).toBe("/application");
  });

  it("does not throw when origin is empty and path is absolute", () => {
    expect(resolveCallbackUrl("http://demo.lvh.me:3100/dashboard", "")).toBe(
      "http://demo.lvh.me:3100/dashboard"
    );
  });

  // ── Negative: invalid inputs ─────────────────────────────────────────────

  it("treats a non-http absolute-looking string as relative", () => {
    // "ftp://..." is not http/https, so it's treated as relative and prefixed
    expect(resolveCallbackUrl("ftp://evil.com", "http://demo.lvh.me:3100")).toBe(
      "http://demo.lvh.me:3100ftp://evil.com"
    );
  });

  // ── Regression: tenant subdomain preservation ────────────────────────────

  it("preserves the paysyslabs tenant subdomain in the callback", () => {
    // Issue: Login on paysyslabs.lvh.me:3100 redirected to demo.lvh.me:3100
    // because the callbackUrl was a relative path resolved against AUTH_URL.
    const result = resolveCallbackUrl("/application", "http://paysyslabs.lvh.me:3100");
    expect(result).toContain("paysyslabs.lvh.me");
    expect(result).not.toContain("demo.lvh.me");
  });

  it("preserves the acme tenant subdomain in the callback", () => {
    const result = resolveCallbackUrl("/dashboard", "http://acme.lvh.me:3100");
    expect(result).toContain("acme.lvh.me");
  });
});

// ── SSR safety ──────────────────────────────────────────────────────────────

describe("SSR safety of resolveCallbackUrl", () => {
  it("does not access window when origin is explicitly provided", () => {
    // The function signature accepts an optional origin parameter.
    // When called from tests or SSR with an explicit origin, it must not
    // reference the global `window` object.
    // This test passes because we provide origin explicitly — the function
    // only reads `window.location.origin` as a default parameter, which is
    // evaluated at call time in the browser, not at module load time.
    const result = resolveCallbackUrl("/application", "http://test.lvh.me:3100");
    expect(result).toBe("http://test.lvh.me:3100/application");
  });

  it("can be called without window defined (origin provided)", () => {
    // Simulate SSR by temporarily removing window
    const originalWindow = globalThis.window;
    // @ts-expect-error — intentionally undefined for SSR simulation
    delete globalThis.window;
    try {
      const result = resolveCallbackUrl("/application", "http://ssr.lvh.me:3100");
      expect(result).toBe("http://ssr.lvh.me:3100/application");
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
