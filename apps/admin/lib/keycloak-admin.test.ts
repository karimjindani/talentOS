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
    expect(adminBaseFromIssuer("http://host.docker.internal:8080/realms/talentos")).toBe(
      "http://host.docker.internal:8080"
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
    // create-user call carries emailVerified + required actions
    const createBody = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(createBody.emailVerified).toBe(true);
    expect(createBody.requiredActions).toContain("CONFIGURE_TOTP");
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
      clients: {
        clientId: string;
        serviceAccountsEnabled?: boolean;
        serviceAccountClientRoles?: Record<string, string[]>;
      }[];
    };
    const provisioner = realm.clients.find((c) => c.clientId === "talentos-provisioner");
    expect(provisioner).toBeDefined();
    expect(provisioner?.serviceAccountsEnabled).toBe(true);
    expect(provisioner?.serviceAccountClientRoles?.["realm-management"]).toContain("manage-users");
  });
});
