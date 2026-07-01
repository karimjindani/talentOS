import { describe, expect, it } from "vitest";
import {
  assertApplicationStatusTransition,
  assertTenantScopedAccess,
  can,
  canAccessAdminPortal,
  canTransitionApplicationStatus,
  createTotpEnrollment,
  hashPassword,
  isSuperAdmin,
  isValidTenantSlug,
  resolveTenantFromHost,
  verifyPassword,
  verifyTotpToken
} from "./index";
import { authenticator } from "otplib";

describe("tenant resolution", () => {
  it("resolves local subdomains for development", () => {
    expect(resolveTenantFromHost("demo.localhost:3000").tenantSlug).toBe("demo");
  });

  it("resolves SaaS subdomains against the configured base domain", () => {
    expect(resolveTenantFromHost("acme.talentos.app", "talentos.app").tenantSlug).toBe("acme");
  });

  it("falls back to the default tenant for bare localhost", () => {
    expect(resolveTenantFromHost("localhost:3000", "localhost", "demo").tenantSlug).toBe("demo");
  });
});

describe("tenant slug validation", () => {
  it("accepts dns-safe slugs and rejects unsafe ones", () => {
    expect(isValidTenantSlug("acme")).toBe(true);
    expect(isValidTenantSlug("acme-corp")).toBe(true);
    expect(isValidTenantSlug("Acme")).toBe(false); // uppercase
    expect(isValidTenantSlug("-acme")).toBe(false); // leading dash
    expect(isValidTenantSlug("a c")).toBe(false); // space
    expect(isValidTenantSlug("")).toBe(false);
  });
});

describe("role authorization", () => {
  it("allows org-admin, HR and tech-lead into the admin portal but not applicants", () => {
    expect(canAccessAdminPortal("ORG_ADMIN")).toBe(true);
    expect(canAccessAdminPortal("HR")).toBe(true);
    expect(canAccessAdminPortal("TECH_LEAD")).toBe(true);
    expect(canAccessAdminPortal("APPLICANT")).toBe(false);
  });

  it("recognizes the platform super admin", () => {
    expect(isSuperAdmin("SUPER_ADMIN")).toBe(true);
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe("capability matrix", () => {
  it("grants every capability to the super admin", () => {
    expect(can("createOrganization", { platformRole: "SUPER_ADMIN" })).toBe(true);
    expect(can("assignOrgRoles", { platformRole: "SUPER_ADMIN" })).toBe(true);
  });

  it("scopes org-admin to tenant user and role management", () => {
    expect(can("manageTenantUsers", { orgRole: "ORG_ADMIN" })).toBe(true);
    expect(can("createOrganization", { orgRole: "ORG_ADMIN" })).toBe(false);
  });

  it("limits HR to application review and tech-lead to technical evaluation", () => {
    expect(can("reviewApplications", { orgRole: "HR" })).toBe(true);
    expect(can("evaluateTechnical", { orgRole: "HR" })).toBe(false);
    expect(can("evaluateTechnical", { orgRole: "TECH_LEAD" })).toBe(true);
    expect(can("reviewApplications", { orgRole: "TECH_LEAD" })).toBe(false);
  });

  it("restricts applicants to the applicant portal", () => {
    expect(can("accessApplicantPortal", { orgRole: "APPLICANT" })).toBe(true);
    expect(can("manageTenantUsers", { orgRole: "APPLICANT" })).toBe(false);
  });

  it("allows only org-admin and super-admin to manage tenant settings", () => {
    expect(can("manageTenantSettings", { platformRole: "SUPER_ADMIN" })).toBe(true);
    expect(can("manageTenantSettings", { orgRole: "ORG_ADMIN" })).toBe(true);
    expect(can("manageTenantSettings", { orgRole: "HR" })).toBe(false);
    expect(can("manageTenantSettings", { orgRole: "TECH_LEAD" })).toBe(false);
    expect(can("manageTenantSettings", { orgRole: "APPLICANT" })).toBe(false);
  });
});

describe("tenant isolation", () => {
  it("rejects cross-tenant access", () => {
    expect(() => assertTenantScopedAccess("tenant-a", "tenant-b")).toThrow("Cross-tenant");
  });
});

describe("password security", () => {
  it("hashes and verifies strong passwords", async () => {
    const hash = await hashPassword("ChangeMe123!");
    expect(hash).not.toBe("ChangeMe123!");
    await expect(verifyPassword("ChangeMe123!", hash)).resolves.toBe(true);
  });
});

describe("totp enrollment", () => {
  it("creates Google Authenticator-compatible TOTP secrets", () => {
    const enrollment = createTotpEnrollment("learner@example.com");
    const token = authenticator.generate(enrollment.secret);
    expect(enrollment.otpauthUrl).toContain("otpauth://totp/");
    expect(verifyTotpToken(token, enrollment.secret)).toBe(true);
  });
});

describe("application workflow", () => {
  it("allows valid review transitions and rejects invalid regression transitions", () => {
    expect(canTransitionApplicationStatus("SUBMITTED", "UNDER_REVIEW")).toBe(true);
    expect(() => assertApplicationStatusTransition("ACCEPTED", "DRAFT")).toThrow("Invalid application status");
  });
});
