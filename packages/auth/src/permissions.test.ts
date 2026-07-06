import { describe, expect, it } from "vitest";
import { tenantRolesGrant } from "./permissions";

// Tenant-scoped authority: does a set of TenantMembership roles (held in the resolved tenant)
// grant the capability? This is the check that closed the cross-tenant gap (D-051): a realm-wide
// role no longer authorizes an action unless the actor is a member of *this* tenant.
describe("tenantRolesGrant", () => {
  it("ORG_ADMIN grants program, review, settings and user management", () => {
    expect(tenantRolesGrant("managePrograms", ["ORG_ADMIN"])).toBe(true);
    expect(tenantRolesGrant("manageMissions", ["ORG_ADMIN"])).toBe(true);
    expect(tenantRolesGrant("reviewApplications", ["ORG_ADMIN"])).toBe(true);
    expect(tenantRolesGrant("manageTenantSettings", ["ORG_ADMIN"])).toBe(true);
    expect(tenantRolesGrant("manageTenantUsers", ["ORG_ADMIN"])).toBe(true);
  });

  it("HR grants only reviewApplications", () => {
    expect(tenantRolesGrant("reviewApplications", ["HR"])).toBe(true);
    expect(tenantRolesGrant("managePrograms", ["HR"])).toBe(false);
    expect(tenantRolesGrant("manageMissions", ["HR"])).toBe(false);
    expect(tenantRolesGrant("manageTenantSettings", ["HR"])).toBe(false);
  });

  it("TECH_LEAD may evaluate but not review or manage settings", () => {
    expect(tenantRolesGrant("evaluateTechnical", ["TECH_LEAD"])).toBe(true);
    expect(tenantRolesGrant("reviewApplications", ["TECH_LEAD"])).toBe(false);
    expect(tenantRolesGrant("manageMissions", ["TECH_LEAD"])).toBe(false);
    expect(tenantRolesGrant("manageTenantSettings", ["TECH_LEAD"])).toBe(false);
  });

  it("APPLICANT grants no admin capability", () => {
    expect(tenantRolesGrant("managePrograms", ["APPLICANT"])).toBe(false);
    expect(tenantRolesGrant("manageMissions", ["APPLICANT"])).toBe(false);
    expect(tenantRolesGrant("reviewApplications", ["APPLICANT"])).toBe(false);
    expect(tenantRolesGrant("manageTenantSettings", ["APPLICANT"])).toBe(false);
  });

  it("no roles denies everything (a cross-tenant actor with no membership here)", () => {
    expect(tenantRolesGrant("managePrograms", [])).toBe(false);
    expect(tenantRolesGrant("manageMissions", [])).toBe(false);
    expect(tenantRolesGrant("reviewApplications", [])).toBe(false);
    expect(tenantRolesGrant("manageTenantSettings", [])).toBe(false);
  });

  it("unions capabilities across multiple roles", () => {
    expect(tenantRolesGrant("reviewApplications", ["HR", "TECH_LEAD"])).toBe(true);
    expect(tenantRolesGrant("evaluateTechnical", ["HR", "TECH_LEAD"])).toBe(true);
    expect(tenantRolesGrant("managePrograms", ["HR", "TECH_LEAD"])).toBe(false);
    expect(tenantRolesGrant("manageMissions", ["HR", "TECH_LEAD"])).toBe(false);
  });
});

// Mission-submission review authority (v0.15.0, D-067): staff review the engineering work —
// ORG_ADMIN and TECH_LEAD hold reviewSubmissions; HR is read-only; participants never review
// each other (Graduate Profile: graduates are not expected to review code).
describe("reviewSubmissions capability", () => {
  it("is granted to ORG_ADMIN and TECH_LEAD", () => {
    expect(tenantRolesGrant("reviewSubmissions", ["ORG_ADMIN"])).toBe(true);
    expect(tenantRolesGrant("reviewSubmissions", ["TECH_LEAD"])).toBe(true);
  });

  it("is denied to HR and APPLICANT", () => {
    expect(tenantRolesGrant("reviewSubmissions", ["HR"])).toBe(false);
    expect(tenantRolesGrant("reviewSubmissions", ["APPLICANT"])).toBe(false);
  });

  it("is denied to a cross-tenant actor with no membership roles", () => {
    expect(tenantRolesGrant("reviewSubmissions", [])).toBe(false);
  });
});
