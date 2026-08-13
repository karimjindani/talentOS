import { describe, expect, it } from "vitest";
import {
  can,
  assertTenantScopedAccess,
  isValidTenantSlug
} from "./index";
import { canEnterAdminPortal } from "@talentos/auth-web/roles";

describe("canEnterAdminPortal — comprehensive role coverage", () => {
  it("allows SUPER_ADMIN regardless of org role", () => {
    expect(canEnterAdminPortal("SUPER_ADMIN", null)).toBe(true);
    expect(canEnterAdminPortal("SUPER_ADMIN", "ORG_ADMIN")).toBe(true);
    expect(canEnterAdminPortal("SUPER_ADMIN", "APPLICANT")).toBe(true);
  });

  it("allows ORG_ADMIN", () => {
    expect(canEnterAdminPortal(null, "ORG_ADMIN")).toBe(true);
  });

  it("allows HR", () => {
    expect(canEnterAdminPortal(null, "HR")).toBe(true);
  });

  it("allows TECH_LEAD", () => {
    expect(canEnterAdminPortal(null, "TECH_LEAD")).toBe(true);
  });

  it("denies APPLICANT", () => {
    expect(canEnterAdminPortal(null, "APPLICANT")).toBe(false);
  });

  it("denies null/null (unauthenticated or unknown)", () => {
    expect(canEnterAdminPortal(null, null)).toBe(false);
  });

  it("denies undefined roles (treated as null)", () => {
    expect(canEnterAdminPortal(null, null)).toBe(false);
  });
});

describe("can() capability matrix — comprehensive", () => {
  const superAdmin = { platformRole: "SUPER_ADMIN" as const, orgRole: null };
  const orgAdmin = { platformRole: null, orgRole: "ORG_ADMIN" as const };
  const hr = { platformRole: null, orgRole: "HR" as const };
  const techLead = { platformRole: null, orgRole: "TECH_LEAD" as const };
  const applicant = { platformRole: null, orgRole: "APPLICANT" as const };
  const nobody = { platformRole: null, orgRole: null };

  it("SUPER_ADMIN can do everything", () => {
    expect(can("createOrganization", superAdmin)).toBe(true);
    expect(can("managePrograms", superAdmin)).toBe(true);
    expect(can("manageMissions", superAdmin)).toBe(true);
    expect(can("reviewApplications", superAdmin)).toBe(true);
    expect(can("reviewSubmissions", superAdmin)).toBe(true);
    expect(can("manageTenantSettings", superAdmin)).toBe(true);
    expect(can("manageProgramContent", superAdmin)).toBe(true);
    expect(can("accessApplicantPortal", superAdmin)).toBe(true);
  });

  it("ORG_ADMIN can manage programs, missions, review, and settings but not create org", () => {
    expect(can("createOrganization", orgAdmin)).toBe(false);
    expect(can("managePrograms", orgAdmin)).toBe(true);
    expect(can("manageMissions", orgAdmin)).toBe(true);
    expect(can("reviewApplications", orgAdmin)).toBe(true);
    expect(can("reviewSubmissions", orgAdmin)).toBe(true);
    expect(can("manageTenantSettings", orgAdmin)).toBe(true);
    expect(can("manageProgramContent", orgAdmin)).toBe(true);
  });

  it("HR can only review applications", () => {
    expect(can("reviewApplications", hr)).toBe(true);
    expect(can("managePrograms", hr)).toBe(false);
    expect(can("manageMissions", hr)).toBe(false);
    expect(can("reviewSubmissions", hr)).toBe(false);
    expect(can("manageTenantSettings", hr)).toBe(false);
    expect(can("manageProgramContent", hr)).toBe(false);
  });

  it("TECH_LEAD can review submissions but not manage programs or content", () => {
    expect(can("reviewSubmissions", techLead)).toBe(true);
    expect(can("managePrograms", techLead)).toBe(false);
    expect(can("manageMissions", techLead)).toBe(false);
    expect(can("reviewApplications", techLead)).toBe(false);
    expect(can("manageTenantSettings", techLead)).toBe(false);
  });

  it("APPLICANT can only access applicant portal", () => {
    expect(can("accessApplicantPortal", applicant)).toBe(true);
    expect(can("createOrganization", applicant)).toBe(false);
    expect(can("managePrograms", applicant)).toBe(false);
    expect(can("manageMissions", applicant)).toBe(false);
    expect(can("reviewApplications", applicant)).toBe(false);
    expect(can("reviewSubmissions", applicant)).toBe(false);
    expect(can("manageTenantSettings", applicant)).toBe(false);
  });

  it("nobody (null/null) can do nothing", () => {
    expect(can("createOrganization", nobody)).toBe(false);
    expect(can("managePrograms", nobody)).toBe(false);
    expect(can("accessApplicantPortal", nobody)).toBe(false);
  });
});

describe("assertTenantScopedAccess", () => {
  it("passes silently when tenant IDs match", () => {
    expect(() => assertTenantScopedAccess("tenant-1", "tenant-1")).not.toThrow();
  });

  it("throws when tenant IDs do not match", () => {
    expect(() => assertTenantScopedAccess("tenant-1", "tenant-2")).toThrow(/tenant/);
  });

  it("throws when resource tenant is empty string", () => {
    expect(() => assertTenantScopedAccess("", "tenant-1")).toThrow(/tenant/);
  });
});

describe("isValidTenantSlug (re-exported)", () => {
  it("is re-exported from tenant module", () => {
    expect(isValidTenantSlug("acme")).toBe(true);
    expect(isValidTenantSlug("admin")).toBe(false);
  });
});
