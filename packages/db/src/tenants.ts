import { Prisma } from "@prisma/client";
import { prisma } from "./client";
import { normalizeEmail } from "./users";

/** Resolve a tenant by its slug (the slug comes from host-based tenant resolution). */
export function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({ where: { slug } });
}

/** Platform-wide tenant list for the SUPER_ADMIN Organizations console. */
export function listTenants() {
  return prisma.tenant.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { memberships: true, programs: true } } }
  });
}

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  adminEmail: string;
  adminName?: string | null;
  actorUserId: string | null;
};

/**
 * Create a new tenant (organization) and assign its first ORG_ADMIN by email.
 * The admin User is upserted by email; their Keycloak account is linked on first login.
 * The Keycloak ORG_ADMIN realm role must be granted separately (see D-035/D-048).
 */
export function createOrganization({
  name,
  slug,
  primaryColor,
  secondaryColor,
  adminEmail,
  adminName,
  actorUserId
}: CreateOrganizationInput) {
  return prisma.$transaction(async (tx) => {
    let tenant;
    try {
      tenant = await tx.tenant.create({
        data: { name, slug, primaryColor, secondaryColor }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error(`A tenant with slug "${slug}" already exists.`);
      }
      throw error;
    }

    const normalizedAdminEmail = normalizeEmail(adminEmail);
    const admin = await tx.user.upsert({
      where: { email: normalizedAdminEmail },
      update: adminName ? { name: adminName } : {},
      create: { email: normalizedAdminEmail, name: adminName ?? null }
    });

    await tx.tenantMembership.upsert({
      where: {
        tenantId_userId_role: { tenantId: tenant.id, userId: admin.id, role: "ORG_ADMIN" }
      },
      update: {},
      create: { tenantId: tenant.id, userId: admin.id, role: "ORG_ADMIN" }
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        actorUserId,
        action: "organization.created",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: { slug, adminEmail }
      }
    });

    return tenant;
  });
}

export type UpdateTenantBrandingInput = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logoFileId?: string | null;
  actorUserId: string | null;
};

export function updateTenantBranding({
  id,
  name,
  primaryColor,
  secondaryColor,
  logoFileId,
  actorUserId
}: UpdateTenantBrandingInput) {
  return prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({
      where: { id },
      data: {
        name,
        primaryColor,
        secondaryColor,
        ...(logoFileId !== undefined && { logoFileId })
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: id,
        actorUserId,
        action: "tenant.branding_updated",
        entityType: "Tenant",
        entityId: id,
        metadata: { name, primaryColor, secondaryColor }
      }
    });

    return tenant;
  });
}
