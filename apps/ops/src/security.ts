export function extractRealmRoles(payload: { realm_access?: { roles?: unknown } }): string[] {
  const roles = payload.realm_access?.roles;
  return Array.isArray(roles) ? roles.filter((role): role is string => typeof role === "string") : [];
}

export function canAccessOpsConsole(roles: readonly string[], allowedRoles: readonly string[]): boolean {
  return roles.some((role) => allowedRoles.includes(role));
}

export function primaryOpsRole(roles: readonly string[], allowedRoles: readonly string[]): string | null {
  return allowedRoles.find((role) => roles.includes(role)) ?? null;
}
