import { prisma } from "./client";

/** Resolve a tenant by its slug (the slug comes from host-based tenant resolution). */
export function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({ where: { slug } });
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
