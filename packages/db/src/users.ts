import type { TenantRole, User } from "@prisma/client";
import { prisma } from "./client";

export type ProvisionApplicantInput = {
  email: string;
  name?: string | null;
  keycloakSubjectId?: string | null;
  tenantId: string;
};

/**
 * Link a Keycloak-authenticated applicant to a DB User on first authenticated action.
 * Upserts the User by email, backfills the Keycloak subject, and ensures an APPLICANT
 * membership for the active tenant. Seed users are matched by email today.
 */
export async function provisionApplicantUser({
  email,
  name,
  keycloakSubjectId,
  tenantId
}: ProvisionApplicantInput): Promise<User> {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      ...(name ? { name } : {}),
      ...(keycloakSubjectId ? { keycloakSubjectId } : {})
    },
    create: {
      email,
      name: name ?? null,
      keycloakSubjectId: keycloakSubjectId ?? null
    }
  });

  await prisma.tenantMembership.upsert({
    where: {
      tenantId_userId_role: { tenantId, userId: user.id, role: "APPLICANT" }
    },
    update: {},
    create: { tenantId, userId: user.id, role: "APPLICANT" }
  });

  return user;
}

/** Resolve a DB User by email (e.g. the signed-in reviewer for audit attribution). */
export function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

/**
 * The tenant-scoped roles an actor actually holds in a given tenant — the authoritative
 * source for admin authorization (the Keycloak realm role only gates portal entry).
 * Email is matched case-insensitively to tolerate casing differences between the Keycloak
 * token and stored users. Returns null when the user has no DB row at all.
 */
export async function getActorTenantRoles(
  email: string,
  tenantId: string
): Promise<{ userId: string; roles: TenantRole[] } | null> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (!user) return null;

  const memberships = await prisma.tenantMembership.findMany({
    where: { userId: user.id, tenantId },
    select: { role: true }
  });
  return { userId: user.id, roles: memberships.map((m) => m.role) };
}
