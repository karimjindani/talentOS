import { beforeEach, describe, expect, it, vi } from "vitest";

// The guard binds a session to the Host-resolved tenant via DB membership. We mock the session
// source (@/auth), the Host→slug resolver (@talentos/ui) and the DB (@talentos/db), but let the
// real RBAC helpers from @talentos/auth (isSuperAdmin, tenantRolesGrant) run. Mocks are created via
// vi.hoisted so they exist when the hoisted vi.mock factories run.
const { authMock, getTenantContextMock, getTenantBySlugMock, getActorTenantRolesMock, linkKeycloakIdentityMock } =
  vi.hoisted(() => ({
    authMock: vi.fn(),
    getTenantContextMock: vi.fn(),
    getTenantBySlugMock: vi.fn(),
    getActorTenantRolesMock: vi.fn(),
    linkKeycloakIdentityMock: vi.fn()
  }));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@talentos/ui", () => ({ getTenantContext: getTenantContextMock }));
vi.mock("@talentos/db", () => ({
  getTenantBySlug: getTenantBySlugMock,
  getActorTenantRoles: getActorTenantRolesMock,
  linkKeycloakIdentity: linkKeycloakIdentityMock
}));

import { resolveTenantAccess } from "./tenant-guard";

const SBITS = { id: "tenant-sbits", slug: "sbits", name: "System bits" };

beforeEach(() => {
  vi.clearAllMocks();
  getTenantContextMock.mockResolvedValue({ tenantSlug: "sbits" });
  getTenantBySlugMock.mockResolvedValue(SBITS);
  linkKeycloakIdentityMock.mockResolvedValue(undefined);
});

describe("resolveTenantAccess (applicant portal)", () => {
  it("rejects an unauthenticated request", async () => {
    authMock.mockResolvedValue(null);
    const res = await resolveTenantAccess("accessApplicantPortal");
    expect(res).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("rejects when the Host-resolved tenant does not exist", async () => {
    authMock.mockResolvedValue({ user: { email: "a@demo.test" } });
    getTenantBySlugMock.mockResolvedValue(null);
    const res = await resolveTenantAccess("accessApplicantPortal");
    expect(res).toEqual({ ok: false, reason: "unknown-tenant" });
  });

  it("DENIES a signed-in user who has no membership in the resolved tenant (the D-051 gap)", async () => {
    // A demo applicant landing on the sbits subdomain — authenticated, but not an sbits member.
    authMock.mockResolvedValue({ user: { email: "applicant@demo.test", platformRole: null } });
    getActorTenantRolesMock.mockResolvedValue(null);
    const res = await resolveTenantAccess("accessApplicantPortal");
    expect(res).toEqual({ ok: false, reason: "forbidden" });
    // Membership was checked against the Host-resolved tenant id, not a realm-wide role.
    expect(getActorTenantRolesMock).toHaveBeenCalledWith("applicant@demo.test", SBITS.id);
  });

  it("DENIES a member whose tenant roles do not grant the capability", async () => {
    authMock.mockResolvedValue({ user: { email: "hr@sbits.test", platformRole: null } });
    getActorTenantRolesMock.mockResolvedValue({ userId: "u-hr", roles: ["HR"] });
    const res = await resolveTenantAccess("accessApplicantPortal");
    expect(res).toEqual({ ok: false, reason: "forbidden" });
  });

  it("ALLOWS an APPLICANT member of the resolved tenant", async () => {
    authMock.mockResolvedValue({ user: { email: "applicant@sbits.test", platformRole: null } });
    getActorTenantRolesMock.mockResolvedValue({ userId: "u-app", roles: ["APPLICANT"] });
    const res = await resolveTenantAccess("accessApplicantPortal");
    expect(res).toMatchObject({ ok: true, tenant: SBITS, actorUserId: "u-app", isSuperAdmin: false });
  });

  it("ALLOWS a SUPER_ADMIN even with no membership in the tenant", async () => {
    authMock.mockResolvedValue({ user: { email: "root@talentos.test", platformRole: "SUPER_ADMIN" } });
    getActorTenantRolesMock.mockResolvedValue(null);
    const res = await resolveTenantAccess("accessApplicantPortal");
    expect(res).toMatchObject({ ok: true, tenant: SBITS, isSuperAdmin: true });
  });
});
