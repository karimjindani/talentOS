import { beforeEach, describe, expect, it, vi } from "vitest";

// logoutAction performs the tenant-aware RP-initiated Keycloak logout shared by PortalHeader, the
// dashboard ApplicantShell and the access-denied page (v0.14.3 / D-066). We mock the session source
// (@/auth), the Next request headers, the redirect sink and the logout-URL builder (the builder's own
// logic is unit-tested in packages/auth-web/src/logout.test.ts), and assert the ordering contract:
// the app session is cleared BEFORE the browser is sent to Keycloak's end_session_endpoint.
const { authMock, signOutMock, headersMock, redirectMock, buildTenantLogoutUrlMock, callOrder } = vi.hoisted(() => {
  const callOrder: string[] = [];
  return {
    authMock: vi.fn(),
    signOutMock: vi.fn(async () => {
      callOrder.push("signOut");
    }),
    headersMock: vi.fn(),
    redirectMock: vi.fn((url: string) => {
      callOrder.push(`redirect:${url}`);
    }),
    buildTenantLogoutUrlMock: vi.fn(
      () => "http://keycloak.lvh.me:8080/realms/talentos/protocol/openid-connect/logout?built=1"
    ),
    callOrder
  };
});

vi.mock("@/auth", () => ({ auth: authMock, signOut: signOutMock }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@talentos/auth-web", () => ({ buildTenantLogoutUrl: buildTenantLogoutUrlMock }));

import { logoutAction } from "./logout-action";

function withHeaders(entries: Record<string, string>) {
  headersMock.mockResolvedValue(new Headers(entries));
}

beforeEach(() => {
  vi.clearAllMocks();
  callOrder.length = 0;
  authMock.mockResolvedValue({ idToken: "id-token-123" });
  withHeaders({ host: "demo.lvh.me:3100" });
  process.env.AUTH_URL = "http://lvh.me:3100";
});

describe("logoutAction (shared applicant logout, D-066)", () => {
  it("builds the logout URL from the session id_token, canonical AUTH_URL and request origin", async () => {
    await logoutAction();
    expect(buildTenantLogoutUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({
        idToken: "id-token-123",
        authUrl: "http://lvh.me:3100",
        requestOrigin: "http://demo.lvh.me:3100"
      })
    );
  });

  it("derives the request origin from the tenant subdomain the user is actually on (D-060)", async () => {
    withHeaders({ host: "sbp.lvh.me:3100", "x-forwarded-proto": "https" });
    await logoutAction();
    expect(buildTenantLogoutUrlMock).toHaveBeenCalledWith(
      expect.objectContaining({ requestOrigin: "https://sbp.lvh.me:3100" })
    );
  });

  it("clears the app session cookie before redirecting to Keycloak (v0.10.2 ordering)", async () => {
    await logoutAction();
    expect(signOutMock).toHaveBeenCalledWith({ redirect: false });
    expect(callOrder).toEqual([
      "signOut",
      "redirect:http://keycloak.lvh.me:8080/realms/talentos/protocol/openid-connect/logout?built=1"
    ]);
  });

  it("still logs out when the session has no id_token (defensive path)", async () => {
    authMock.mockResolvedValue(null);
    await logoutAction();
    expect(buildTenantLogoutUrlMock).toHaveBeenCalledWith(expect.objectContaining({ idToken: undefined }));
    expect(signOutMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalled();
  });
});
