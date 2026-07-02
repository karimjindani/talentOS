import type { TenantRole, User } from "@prisma/client";
import { prisma } from "./client";

/** Canonical form for a user email — trimmed and lowercased so the case-sensitive unique index
 *  never yields duplicate identities for the same address. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

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
  const normalizedEmail = normalizeEmail(email);
  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {
      ...(name ? { name } : {}),
      ...(keycloakSubjectId ? { keycloakSubjectId } : {})
    },
    create: {
      email: normalizedEmail,
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

/** Resolve a DB User by email (e.g. the signed-in reviewer for audit attribution).
 *  Case-insensitive so a casing difference between the Keycloak token and the stored row
 *  cannot orphan the lookup (e.g. the applicant status page). */
export function getUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
}

/**
 * Backfill the Keycloak subject on an existing DB User at login time (server-side only — never
 * called from the edge-imported auth callbacks). Matches case-insensitively and updates only when a
 * row exists and its `keycloakSubjectId` is missing or has changed; it never creates a row, so
 * applicant rows are still born on first apply. Also backfills a missing display name. Best-effort:
 * returns the linked user or null if none exists for the email.
 */
export async function linkKeycloakIdentity({
  email,
  keycloakSubjectId,
  name
}: {
  email: string;
  keycloakSubjectId?: string | null;
  name?: string | null;
}): Promise<User | null> {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } }
  });
  if (!user) return null;

  const nextSubject =
    keycloakSubjectId && keycloakSubjectId !== user.keycloakSubjectId ? keycloakSubjectId : undefined;
  const nextName = !user.name && name ? name : undefined;
  if (nextSubject === undefined && nextName === undefined) return user;

  return prisma.user.update({
    where: { id: user.id },
    data: {
      ...(nextSubject !== undefined ? { keycloakSubjectId: nextSubject } : {}),
      ...(nextName !== undefined ? { name: nextName } : {})
    }
  });
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
