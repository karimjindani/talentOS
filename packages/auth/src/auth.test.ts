import { describe, expect, it } from "vitest";
import {
  assertApplicationStatusTransition,
  assertTenantScopedAccess,
  canAccessAdminPortal,
  canTransitionApplicationStatus,
  createTotpEnrollment,
  hashPassword,
  hasRoleAtLeast,
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

describe("role authorization", () => {
  it("allows owners and admins into the admin portal", () => {
    expect(canAccessAdminPortal("OWNER")).toBe(true);
    expect(canAccessAdminPortal("ADMIN")).toBe(true);
    expect(canAccessAdminPortal("APPLICANT")).toBe(false);
  });

  it("compares role rank", () => {
    expect(hasRoleAtLeast("OWNER", "ADMIN")).toBe(true);
    expect(hasRoleAtLeast("ADMIN", "OWNER")).toBe(false);
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
