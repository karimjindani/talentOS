import { prisma } from "./client";

/** Published programs a tenant currently accepts applications for. */
export function listPublishedPrograms(tenantId: string) {
  return prisma.program.findMany({
    where: { tenantId, status: "PUBLISHED" },
    orderBy: { name: "asc" }
  });
}
