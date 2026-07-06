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
