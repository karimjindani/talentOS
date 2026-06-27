import { isSuperAdmin, type PlatformRole, type TenantRole } from "./rbac";

// Capabilities derived from the codex.md role/permission matrix (v0.3.0 foundation).
export type Capability =
  | "createOrganization"
  | "createOrgAdmin"
  | "manageTenantUsers"
  | "assignOrgRoles"
  | "managePrograms"
  | "reviewApplications"
  | "evaluateTechnical"
  | "accessApplicantPortal";

// Org-role → capabilities. SUPER_ADMIN is handled separately (platform-level, all capabilities).
const ROLE_CAPABILITIES: Record<TenantRole, readonly Capability[]> = {
  ORG_ADMIN: [
    "manageTenantUsers",
    "assignOrgRoles",
    "managePrograms",
    "reviewApplications",
    "evaluateTechnical"
  ],
  HR: ["reviewApplications"],
  TECH_LEAD: ["evaluateTechnical"],
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

export function capabilitiesFor(actor: ActorRoles): Capability[] {
  if (isSuperAdmin(actor.platformRole)) {
    return [
      "createOrganization",
      "createOrgAdmin",
      "manageTenantUsers",
      "assignOrgRoles",
      "managePrograms",
      "reviewApplications",
      "evaluateTechnical"
    ];
  }
  return actor.orgRole ? [...ROLE_CAPABILITIES[actor.orgRole]] : [];
}
