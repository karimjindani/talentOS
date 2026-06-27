import { describe, expect, it } from "vitest";
import {
  canEnterAdminPortal,
  extractRealmRoles,
  extractSuperAdmin,
  mapKeycloakRolesToTenantRoles,
  primaryOrgRole
} from "./roles";

function fakeAccessToken(roles: string[]): string {
  const payload = Buffer.from(JSON.stringify({ realm_access: { roles } })).toString("base64url");
  return `header.${payload}.signature`;
}

describe("keycloak role mapping", () => {
  it("keeps only known org roles", () => {
    expect(mapKeycloakRolesToTenantRoles(["ORG_ADMIN", "HR", "offline_access", "uma_authorization"])).toEqual([
      "ORG_ADMIN",
      "HR"
    ]);
  });

  it("ignores unknown roles and empty input", () => {
    expect(mapKeycloakRolesToTenantRoles(["nonsense"])).toEqual([]);
    expect(mapKeycloakRolesToTenantRoles(null)).toEqual([]);
  });

  it("picks the highest-priority org role", () => {
    expect(primaryOrgRole(["APPLICANT", "HR", "ORG_ADMIN"])).toBe("ORG_ADMIN");
    expect(primaryOrgRole(["TECH_LEAD", "APPLICANT"])).toBe("TECH_LEAD");
    expect(primaryOrgRole([])).toBeNull();
  });

  it("detects the platform super admin", () => {
    expect(extractSuperAdmin(["SUPER_ADMIN", "ORG_ADMIN"])).toBe("SUPER_ADMIN");
    expect(extractSuperAdmin(["ORG_ADMIN"])).toBeNull();
  });
});

describe("admin portal access", () => {
  it("allows super admin and admin-capable org roles, denies applicants", () => {
    expect(canEnterAdminPortal("SUPER_ADMIN", null)).toBe(true);
    expect(canEnterAdminPortal(null, "ORG_ADMIN")).toBe(true);
    expect(canEnterAdminPortal(null, "HR")).toBe(true);
    expect(canEnterAdminPortal(null, "TECH_LEAD")).toBe(true);
    expect(canEnterAdminPortal(null, "APPLICANT")).toBe(false);
    expect(canEnterAdminPortal(null, null)).toBe(false);
  });
});

describe("access token decoding", () => {
  it("extracts realm roles from a Keycloak access token", () => {
    expect(extractRealmRoles(fakeAccessToken(["ORG_ADMIN", "APPLICANT"]))).toEqual(["ORG_ADMIN", "APPLICANT"]);
    expect(extractRealmRoles(null)).toEqual([]);
    expect(extractRealmRoles("not-a-jwt")).toEqual([]);
  });
});
