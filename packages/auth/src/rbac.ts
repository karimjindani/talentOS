export type TenantRole = "OWNER" | "ADMIN" | "APPLICANT";

const ROLE_RANK: Record<TenantRole, number> = {
  APPLICANT: 1,
  ADMIN: 2,
  OWNER: 3
};

export function canAccessAdminPortal(role: TenantRole): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function hasRoleAtLeast(actual: TenantRole, required: TenantRole): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function assertTenantScopedAccess(resourceTenantId: string, actorTenantId: string): void {
  if (resourceTenantId !== actorTenantId) {
    throw new Error("Cross-tenant access denied.");
  }
}
