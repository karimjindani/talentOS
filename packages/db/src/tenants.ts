import { prisma } from "./client";

/** Resolve a tenant by its slug (the slug comes from host-based tenant resolution). */
export function getTenantBySlug(slug: string) {
  return prisma.tenant.findUnique({ where: { slug } });
}
