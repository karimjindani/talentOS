// Organization-scoped roles (stored on TenantMembership in the DB and as Keycloak realm roles).
export type TenantRole = "ORG_ADMIN" | "HR" | "TECH_LEAD" | "APPLICANT";

// Platform-scoped role (stored on User.platformRole and as a Keycloak realm role).
export type PlatformRole = "SUPER_ADMIN";

export const ORG_ROLES: readonly TenantRole[] = ["ORG_ADMIN", "HR", "TECH_LEAD", "APPLICANT"];

// Roles permitted to reach the admin portal at all. APPLICANT is excluded by design.
const ADMIN_PORTAL_ROLES: readonly TenantRole[] = ["ORG_ADMIN", "HR", "TECH_LEAD"];

export function canAccessAdminPortal(role: TenantRole): boolean {
  return ADMIN_PORTAL_ROLES.includes(role);
}

export function isSuperAdmin(platformRole: PlatformRole | null | undefined): boolean {
  return platformRole === "SUPER_ADMIN";
}

export function assertTenantScopedAccess(resourceTenantId: string, actorTenantId: string): void {
  if (resourceTenantId !== actorTenantId) {
    throw new Error("Cross-tenant access denied.");
  }
}
