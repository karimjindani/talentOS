import { canAccessAdminPortal, ORG_ROLES, type PlatformRole, type TenantRole } from "@talentos/auth/rbac";

// Priority used to pick a single effective org role when a user holds several.
const ORG_ROLE_PRIORITY: readonly TenantRole[] = ["ORG_ADMIN", "HR", "TECH_LEAD", "APPLICANT"];

/** Keep only the Keycloak realm roles that map to a known org-scoped TenantRole. */
export function mapKeycloakRolesToTenantRoles(roles: readonly string[] | null | undefined): TenantRole[] {
  if (!roles) return [];
  return roles.filter((role): role is TenantRole => (ORG_ROLES as readonly string[]).includes(role));
}

/** The highest-priority org role the user holds, or null. */
export function primaryOrgRole(roles: readonly TenantRole[]): TenantRole | null {
  return ORG_ROLE_PRIORITY.find((role) => roles.includes(role)) ?? null;
}

/** True when the Keycloak realm roles include the platform SUPER_ADMIN role. */
export function extractSuperAdmin(realmRoles: readonly string[] | null | undefined): PlatformRole | null {
  return realmRoles?.includes("SUPER_ADMIN") ? "SUPER_ADMIN" : null;
}

/** Admin-portal access: platform super admin, or an org role that may enter the admin portal. */
export function canEnterAdminPortal(platformRole: PlatformRole | null, orgRole: TenantRole | null): boolean {
  if (platformRole === "SUPER_ADMIN") return true;
  return orgRole != null && canAccessAdminPortal(orgRole);
}

/** Edge-safe base64url decode (no Node Buffer dependency, works in middleware). */
function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  // Node fallback (tests / non-edge runtimes).
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extract Keycloak realm roles (realm_access.roles) from an access token. */
export function extractRealmRoles(accessToken: string | null | undefined): string[] {
  if (!accessToken) return [];
  const payload = decodeJwtPayload(accessToken);
  const realmAccess = payload?.["realm_access"] as { roles?: string[] } | undefined;
  return Array.isArray(realmAccess?.roles) ? realmAccess.roles : [];
}
