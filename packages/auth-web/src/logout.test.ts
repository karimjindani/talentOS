import { describe, expect, it } from "vitest";
import { buildEndSessionUrl } from "./logout";

const ISSUER = "http://host.docker.internal:8080/realms/talentos";
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
});
