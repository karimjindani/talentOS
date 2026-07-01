import { describe, expect, it } from "vitest";
import { canAccessOpsConsole, extractRealmRoles, primaryOpsRole } from "./security";

describe("ops Keycloak role auth", () => {
  it("extracts Keycloak realm roles", () => {
    expect(extractRealmRoles({ realm_access: { roles: ["ORG_ADMIN", "offline_access", 123] } })).toEqual([
      "ORG_ADMIN",
      "offline_access"
    ]);
    expect(extractRealmRoles({})).toEqual([]);
  });

  it("allows only configured ops roles", () => {
    const allowedRoles = ["SUPER_ADMIN", "ORG_ADMIN"];
    expect(canAccessOpsConsole(["SUPER_ADMIN"], allowedRoles)).toBe(true);
    expect(canAccessOpsConsole(["ORG_ADMIN"], allowedRoles)).toBe(true);
    expect(canAccessOpsConsole(["HR"], allowedRoles)).toBe(false);
    expect(canAccessOpsConsole(["TECH_LEAD"], allowedRoles)).toBe(false);
    expect(canAccessOpsConsole(["APPLICANT"], allowedRoles)).toBe(false);
    expect(primaryOpsRole(["APPLICANT", "ORG_ADMIN"], allowedRoles)).toBe("ORG_ADMIN");
  });
});
