import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { adminBaseFromIssuer, generateTempPassword, provisionOrgAdmin } from "./keycloak-admin";

function mockRes({
  status = 200,
  json = {},
  location
}: {
  status?: number;
  json?: unknown;
  location?: string;
}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    headers: { get: (h: string) => (h.toLowerCase() === "location" ? location ?? null : null) }
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("adminBaseFromIssuer", () => {
  it("strips the realm path from the issuer", () => {
    expect(adminBaseFromIssuer("http://keycloak.lvh.me:8080/realms/talentos")).toBe(
      "http://keycloak.lvh.me:8080"
    );
    expect(adminBaseFromIssuer("http://host:8080/realms/talentos/")).toBe("http://host:8080");
  });
});

describe("generateTempPassword", () => {
  it("satisfies the realm password policy (length ≥ 12, upper, lower, digit, special)", () => {
    for (let i = 0; i < 25; i++) {
      const p = generateTempPassword();
      expect(p.length).toBeGreaterThanOrEqual(12);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[0-9]/);
      expect(p).toMatch(/[!@#$%^&*\-_]/);
    }
  });

  it("is effectively unique across calls", () => {
    const set = new Set(Array.from({ length: 50 }, () => generateTempPassword()));
    expect(set.size).toBe(50);
  });
});

describe("provisionOrgAdmin", () => {
  it("creates a new user, sets a temp password, and grants ORG_ADMIN", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRes({ json: { access_token: "tok" } })) // admin token
      .mockResolvedValueOnce(mockRes({ json: [] })) // findUserByEmail → none
      .mockResolvedValueOnce(mockRes({ status: 201, location: "/admin/realms/talentos/users/uid-1" })) // createUser
      .mockResolvedValueOnce(mockRes({ status: 204 })) // setTemporaryPassword
      .mockResolvedValueOnce(mockRes({ json: { id: "role-1", name: "ORG_ADMIN" } })) // role lookup
      .mockResolvedValueOnce(mockRes({ status: 204 })); // assign role
    vi.stubGlobal("fetch", fetchMock);

    const result = await provisionOrgAdmin({ email: "New@Acme.test", name: "New Admin" });

    expect(result.created).toBe(true);
    expect(result.keycloakUserId).toBe("uid-1");
    expect(result.tempPassword).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    // create-user call carries emailVerified + required actions. 2FA is disabled platform-wide,
    // so a new org admin is only asked to set a password — never CONFIGURE_TOTP (avoids the
    // Keycloak TOTP-setup "/ by zero" internal error hit during OTP login).
    const createBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(createBody.emailVerified).toBe(true);
    expect(createBody.requiredActions).toContain("UPDATE_PASSWORD");
    expect(createBody.requiredActions).not.toContain("CONFIGURE_TOTP");
  });

  it("skips password for an existing user and only ensures the role", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRes({ json: { access_token: "tok" } })) // admin token
      .mockResolvedValueOnce(mockRes({ json: [{ id: "uid-2", email: "owner@acme.test" }] })) // exists
      .mockResolvedValueOnce(mockRes({ json: { id: "role-1", name: "ORG_ADMIN" } })) // role lookup
      .mockResolvedValueOnce(mockRes({ status: 204 })); // assign role
    vi.stubGlobal("fetch", fetchMock);

    const result = await provisionOrgAdmin({ email: "owner@acme.test", name: "Acme Owner" });

    expect(result.created).toBe(false);
    expect(result.tempPassword).toBeNull();
    expect(result.keycloakUserId).toBe("uid-2");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("realm import", () => {
  it("declares the talentos-provisioner service-account client with manage-users", () => {
    const realmPath = fileURLToPath(
      new URL("../../../keycloak/import/talentos-realm.json", import.meta.url)
    );
    const realm = JSON.parse(readFileSync(realmPath, "utf8")) as {
      registrationAllowed?: boolean;
      registrationEmailAsUsername?: boolean;
      clients: {
        clientId: string;
        redirectUris?: string[];
        webOrigins?: string[];
        serviceAccountsEnabled?: boolean;
      }[];
      users: {
        username: string;
        serviceAccountClientId?: string;
        clientRoles?: Record<string, string[]>;
      }[];
    };

    // Self-service applicant registration must stay enabled — a fresh realm import is the only
    // place this is guaranteed (a drifted live realm silently disabled it, breaking "Create account").
    expect(realm.registrationAllowed).toBe(true);
    expect(realm.registrationEmailAsUsername).toBe(true);
    const provisioner = realm.clients.find((c) => c.clientId === "talentos-provisioner");
    expect(provisioner).toBeDefined();
    expect(provisioner?.serviceAccountsEnabled).toBe(true);

    // Realm-management roles are granted via the service-account user (the canonical Keycloak
    // realm-import representation), NOT a serviceAccountClientRoles field on the client — that field
    // is not valid in the import schema and aborts the import (D-057).
    const serviceAccountUser = realm.users.find(
      (u) => u.serviceAccountClientId === "talentos-provisioner"
    );
    expect(serviceAccountUser).toBeDefined();
    expect(serviceAccountUser?.clientRoles?.["realm-management"]).toContain("manage-users");

    const adminClient = realm.clients.find((c) => c.clientId === "talentos-admin");
    const applicantClient = realm.clients.find((c) => c.clientId === "talentos-applicant");
    expect(adminClient?.redirectUris).toContain("http://lvh.me:3200/api/auth/callback/keycloak");
    expect(adminClient?.redirectUris).toContain("http://*.lvh.me:3200/*");
    expect(applicantClient?.redirectUris).toContain("http://lvh.me:3100/api/auth/callback/keycloak");
    expect(applicantClient?.redirectUris).toContain("http://*.lvh.me:3100/*");
  });
});
