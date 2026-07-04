import { describe, expect, it } from "vitest";
import { buildLoginRedirect, selectOpsClient } from "./auth";
import type { OpsConfig } from "./config";

const config: OpsConfig = {
  host: "127.0.0.1",
  port: 3300,
  repoRoot: "/repo",
  baseUrl: "http://127.0.0.1:3300",
  sessionSecret: "test-secret",
  sessionCookieName: "session",
  loginCookieName: "login",
  sessionMaxAgeSeconds: 3600,
  allowedRoles: ["SUPER_ADMIN", "ORG_ADMIN"],
  keycloak: {
    issuer: "http://keycloak.lvh.me:8080/realms/talentos",
    browserIssuer: "http://keycloak.lvh.me:8080/realms/talentos",
    redirectUri: "http://127.0.0.1:3300/auth/callback",
    normalClient: { clientId: "talentos-ops", clientSecret: "normal-secret" },
    mfaClient: { clientId: "talentos-ops-mfa", clientSecret: "mfa-secret" }
  }
};

describe("ops Keycloak login selection", () => {
  it("uses the normal client when 2FA is off", () => {
    expect(selectOpsClient(config, false).clientId).toBe("talentos-ops");
  });

  it("uses the MFA client and prompt=login when 2FA is on", async () => {
    expect(selectOpsClient(config, true).clientId).toBe("talentos-ops-mfa");

    const { url, loginState } = await buildLoginRedirect(config, true);
    expect(loginState.clientId).toBe("talentos-ops-mfa");
    expect(loginState.mfaRequired).toBe(true);
    expect(url.searchParams.get("client_id")).toBe("talentos-ops-mfa");
    expect(url.searchParams.get("prompt")).toBe("login");
  });
});
