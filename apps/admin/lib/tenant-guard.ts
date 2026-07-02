import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTenantContext } from "@talentos/ui";
import { isSuperAdmin, tenantRolesGrant, type Capability } from "@talentos/auth";
import { getActorTenantRoles, getTenantBySlug, linkKeycloakIdentity, type Tenant } from "@talentos/db";

export type TenantAccess =
  | { ok: true; tenant: Tenant; actorUserId: string | null; isSuperAdmin: boolean }
  | { ok: false; reason: "unauthenticated" | "unknown-tenant" | "forbidden" };

/**
 * The single tenant-authorization gate for the admin portal. It binds *who you are* (the session)
 * to *which tenant you are acting on* (resolved from the Host header) via the DB TenantMembership —
 * closing the gap where a realm-wide role leaked across tenants by subdomain switching (D-051).
 *
 * SUPER_ADMIN (platform role) bypasses the membership check on every tenant. For everyone else the
 * actor must hold a TenantMembership in the resolved tenant, and — when a capability is supplied —
 * one of those tenant roles must grant it. Returns a discriminated result (no redirect) so both
 * server components and route handlers can consume it.
 */
export async function resolveTenantAccess(capability?: Capability): Promise<TenantAccess> {
  const session = await auth();
  if (!session?.user) return { ok: false, reason: "unauthenticated" };

  const { tenantSlug } = await getTenantContext();
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { ok: false, reason: "unknown-tenant" };

  const email = session.user.email;

  // Backfill the Keycloak subject on the existing DB User at login time — admin/reviewer/super-admin
  // rows were never linked before (only applicants, on first apply). Best-effort: never blocks the
  // request, never creates a row. Server-side only (kept out of the edge-imported auth callbacks).
  if (email) {
    try {
      await linkKeycloakIdentity({
        email,
        keycloakSubjectId: session.user.keycloakSubjectId,
        name: session.user.name ?? null
      });
    } catch {
      // linking is non-critical; authorization proceeds regardless
    }
  }

  const actor = email ? await getActorTenantRoles(email, tenant.id) : null;

  // Platform super admin may act on any tenant; keep their user id for audit attribution if present.
  if (isSuperAdmin(session.user.platformRole ?? null)) {
    return { ok: true, tenant, actorUserId: actor?.userId ?? null, isSuperAdmin: true };
  }

  if (!actor || actor.roles.length === 0) return { ok: false, reason: "forbidden" };
  if (capability && !tenantRolesGrant(capability, actor.roles)) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, tenant, actorUserId: actor.userId, isSuperAdmin: false };
}

/**
 * Server-component / server-action variant: redirects on failure and returns the resolved tenant on
 * success. (Route handlers should call `resolveTenantAccess` directly and return JSON status codes.)
 */
export async function requireTenantAccess(
  capability?: Capability
): Promise<{ tenant: Tenant; actorUserId: string | null; isSuperAdmin: boolean }> {
  const access = await resolveTenantAccess(capability);
  if (!access.ok) {
    if (access.reason === "unauthenticated") redirect("/api/auth/signin");
    redirect("/forbidden");
  }
  return { tenant: access.tenant, actorUserId: access.actorUserId, isSuperAdmin: access.isSuperAdmin };
}
