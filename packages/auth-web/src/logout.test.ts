import { describe, expect, it } from "vitest";
import { buildEndSessionUrl, buildTenantLogoutUrl } from "./logout";

const ISSUER = "http://keycloak.lvh.me:8080/realms/talentos";
const REDIRECT = "http://localhost:3200/";

describe("buildEndSessionUrl", () => {
  it("uses id_token_hint when an id token is present", () => {
    const url = new URL(
      buildEndSessionUrl({ issuer: ISSUER, idToken: "the-id-token", postLogoutRedirectUri: REDIRECT })
    );
    expect(url.pathname).toBe("/realms/talentos/protocol/openid-connect/logout");
    expect(url.searchParams.get("id_token_hint")).toBe("the-id-token");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(REDIRECT);
    expect(url.searchParams.get("client_id")).toBeNull();
  });

  it("falls back to client_id when no id token is available", () => {
    const url = new URL(
      buildEndSessionUrl({
        issuer: ISSUER,
        clientId: "talentos-admin",
        postLogoutRedirectUri: REDIRECT
      })
    );
    expect(url.searchParams.get("client_id")).toBe("talentos-admin");
    expect(url.searchParams.get("id_token_hint")).toBeNull();
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(REDIRECT);
  });

  it("normalizes a trailing slash on the issuer", () => {
    const url = buildEndSessionUrl({
      issuer: `${ISSUER}/`,
      idToken: "t",
      postLogoutRedirectUri: REDIRECT
    });
    expect(url).toContain("/realms/talentos/protocol/openid-connect/logout?");
    expect(url).not.toContain("talentos//protocol");
  });

  it("includes state only when provided", () => {
    const withState = new URL(
      buildEndSessionUrl({ issuer: ISSUER, idToken: "t", postLogoutRedirectUri: REDIRECT, state: "s-1" })
    );
    expect(withState.searchParams.get("state")).toBe("s-1");
    const withoutState = new URL(
      buildEndSessionUrl({ issuer: ISSUER, idToken: "t", postLogoutRedirectUri: REDIRECT })
    );
    expect(withoutState.searchParams.get("state")).toBeNull();
  });
});

describe("buildTenantLogoutUrl (v0.14.3, D-066)", () => {
  it("always targets the canonical AUTH_URL /logged-out route, never the tenant host", () => {
    // Keycloak cannot validate hostname wildcards (http://*.lvh.me:3100/* never matches), so a
    // Host-derived post_logout_redirect_uri fails with "Invalid redirect uri" on tenant subdomains.
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        idToken: "t",
        authUrl: "http://lvh.me:3100",
        requestOrigin: "http://demo.lvh.me:3100"
      })
    );
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://lvh.me:3100/logged-out");
  });

  it("carries the tenant origin in state so /logged-out can bounce the user back", () => {
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        idToken: "t",
        authUrl: "http://lvh.me:3100",
        requestOrigin: "http://sbp.lvh.me:3100"
      })
    );
    expect(url.searchParams.get("state")).toBe("http://sbp.lvh.me:3100/");
  });

  it("normalizes an AUTH_URL with a path down to its origin", () => {
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        idToken: "t",
        authUrl: "http://lvh.me:3200/some/path",
        requestOrigin: "http://lvh.me:3200"
      })
    );
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://lvh.me:3200/logged-out");
  });

  it("works on the canonical host itself (state round-trips the same origin)", () => {
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        clientId: "talentos-applicant",
        authUrl: "http://lvh.me:3100",
        requestOrigin: "http://lvh.me:3100"
      })
    );
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://lvh.me:3100/logged-out");
    expect(url.searchParams.get("state")).toBe("http://lvh.me:3100/");
    expect(url.searchParams.get("client_id")).toBe("talentos-applicant");
  });
});

describe("buildTenantLogoutUrl — post_logout_redirect_uri must be Keycloak-valid (regression: invalid redirect uri)", () => {
  // Keycloak's post.logout.redirect.uris for talentos-applicant:
  //   http://localhost:3100/*##http://lvh.me:3100/*##http://demo.lvh.me:3100/*##http://*.lvh.me:3100/*
  // The wildcard * only matches at the END of a URI — it is NOT a hostname substitution.
  // So http://paysyslabs.lvh.me:3100/logged-out does NOT match http://*.lvh.me:3100/*.
  //
  // The bug: logout-action.ts fell back to `http://${host}` (the request host) when AUTH_URL was
  // unset, producing a tenant-subdomain post_logout_redirect_uri that Keycloak rejected.
  // The fix: fall back to NEXTAUTH_URL (the canonical auth origin) before the request host.

  const KEYCLOAK_VALID_POST_LOGOUT_ORIGINS = [
    "http://localhost:3100",
    "http://lvh.me:3100",
    "http://demo.lvh.me:3100"
  ];

  /**
   * Simulates the resolved authUrl from the fixed logout-action.ts:
   *   process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? `http://${host}`
   */
  function resolveAuthUrl(authUrl: string | undefined, nextauthUrl: string | undefined, host: string): string {
    return authUrl ?? nextauthUrl ?? `http://${host}`;
  }

  it("uses NEXTAUTH_URL fallback when AUTH_URL is unset, even on a tenant subdomain request", () => {
    // Simulates: user on paysyslabs.lvh.me:3100, AUTH_URL unset, NEXTAUTH_URL=http://demo.lvh.me:3100
    const authUrl = resolveAuthUrl(undefined, "http://demo.lvh.me:3100", "paysyslabs.lvh.me:3100");
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        idToken: "t",
        authUrl,
        requestOrigin: "http://paysyslabs.lvh.me:3100"
      })
    );
    const redirectUri = url.searchParams.get("post_logout_redirect_uri")!;
    const redirectOrigin = new URL(redirectUri).origin;
    expect(KEYCLOAK_VALID_POST_LOGOUT_ORIGINS).toContain(redirectOrigin);
    expect(redirectUri).toBe("http://demo.lvh.me:3100/logged-out");
  });

  it("uses AUTH_URL when set, taking precedence over NEXTAUTH_URL", () => {
    const authUrl = resolveAuthUrl("http://lvh.me:3100", "http://demo.lvh.me:3100", "paysyslabs.lvh.me:3100");
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        idToken: "t",
        authUrl,
        requestOrigin: "http://paysyslabs.lvh.me:3100"
      })
    );
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://lvh.me:3100/logged-out");
  });

  it("never produces a tenant-subdomain post_logout_redirect_uri when NEXTAUTH_URL is set", () => {
    // Even if the request comes from an arbitrary tenant subdomain, the redirect URI must
    // always be the canonical origin — never the tenant host.
    const tenantSubdomains = ["paysyslabs", "acme", "sbp", "globex", "initech"];
    for (const subdomain of tenantSubdomains) {
      const authUrl = resolveAuthUrl(undefined, "http://demo.lvh.me:3100", `${subdomain}.lvh.me:3100`);
      const url = new URL(
        buildTenantLogoutUrl({
          issuer: ISSUER,
          idToken: "t",
          authUrl,
          requestOrigin: `http://${subdomain}.lvh.me:3100`
        })
      );
      const redirectUri = url.searchParams.get("post_logout_redirect_uri")!;
      const redirectOrigin = new URL(redirectUri).origin;
      expect(redirectOrigin).toBe("http://demo.lvh.me:3100");
      expect(KEYCLOAK_VALID_POST_LOGOUT_ORIGINS).toContain(redirectOrigin);
    }
  });

  it("still carries the tenant origin in state for the /logged-out bounce", () => {
    const authUrl = resolveAuthUrl(undefined, "http://demo.lvh.me:3100", "paysyslabs.lvh.me:3100");
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        idToken: "t",
        authUrl,
        requestOrigin: "http://paysyslabs.lvh.me:3100"
      })
    );
    expect(url.searchParams.get("state")).toBe("http://paysyslabs.lvh.me:3100/");
  });

  it("admin portal: uses NEXTAUTH_URL fallback on port 3200", () => {
    const authUrl = resolveAuthUrl(undefined, "http://demo.lvh.me:3200", "paysyslabs.lvh.me:3200");
    const url = new URL(
      buildTenantLogoutUrl({
        issuer: ISSUER,
        idToken: "t",
        authUrl,
        requestOrigin: "http://paysyslabs.lvh.me:3200"
      })
    );
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("http://demo.lvh.me:3200/logged-out");
  });
});
