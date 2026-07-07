import { isSuperAdmin, type PlatformRole, type TenantRole } from "./rbac";

// Capabilities derived from the codex.md role/permission matrix (v0.3.0 foundation).
export type Capability =
  | "createOrganization"
  | "createOrgAdmin"
  | "manageTenantUsers"
  | "assignOrgRoles"
  | "managePrograms"
  | "manageMissions"
  | "manageProgramContent"
  | "reviewApplications"
  | "reviewSubmissions"
  | "evaluateTechnical"
  | "accessApplicantPortal"
  | "manageTenantSettings";

// Org-role → capabilities. SUPER_ADMIN is handled separately (platform-level, all capabilities).
const ROLE_CAPABILITIES: Record<TenantRole, readonly Capability[]> = {
  ORG_ADMIN: [
    "manageTenantUsers",
    "assignOrgRoles",
    "managePrograms",
    "manageMissions",
    // Program content (video resources, weekly tasks, calendar events) is curriculum
    // administration (v0.16.0, D-069) — same owners as programs/missions.
    "manageProgramContent",
    "reviewApplications",
    "reviewSubmissions",
    "evaluateTechnical",
    "manageTenantSettings"
  ],
  HR: ["reviewApplications"],
  // Tech leads review mission submissions (v0.15.0, D-067): staff review the engineering work —
  // participants never review each other (Graduate Profile: graduates are not code reviewers).
  TECH_LEAD: ["evaluateTechnical", "reviewSubmissions"],
  APPLICANT: ["accessApplicantPortal"]
};

export type ActorRoles = {
  platformRole?: PlatformRole | null;
  orgRole?: TenantRole | null;
};

/** True when the actor may perform the capability. SUPER_ADMIN passes everything. */
export function can(capability: Capability, actor: ActorRoles): boolean {
  if (isSuperAdmin(actor.platformRole)) {
    return true;
  }
  if (!actor.orgRole) {
    return false;
  }
  return ROLE_CAPABILITIES[actor.orgRole].includes(capability);
}

/**
 * True when any of the actor's tenant-scoped roles (from their TenantMembership rows in the
 * resolved tenant) grants the capability. This is the per-tenant authority check that binds
 * a realm-wide role to the specific tenant being acted on.
 */
export function tenantRolesGrant(capability: Capability, roles: readonly TenantRole[]): boolean {
  return roles.some((role) => ROLE_CAPABILITIES[role].includes(capability));
}

export function capabilitiesFor(actor: ActorRoles): Capability[] {
  if (isSuperAdmin(actor.platformRole)) {
    return [
      "createOrganization",
      "createOrgAdmin",
      "manageTenantUsers",
      "assignOrgRoles",
      "managePrograms",
      "manageMissions",
      "manageProgramContent",
      "reviewApplications",
      "reviewSubmissions",
      "evaluateTechnical",
      "manageTenantSettings"
    ];
  }
  return actor.orgRole ? [...ROLE_CAPABILITIES[actor.orgRole]] : [];
}
