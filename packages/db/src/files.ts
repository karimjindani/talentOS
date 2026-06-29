import { prisma } from "./client";

export type CreateStoredFileInput = {
  tenantId: string;
  ownerUserId: string | null;
  bucket: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  size: number;
  category: string;
  actorUserId: string | null;
};

/** Record file metadata (PENDING) and an audit entry; bytes are uploaded separately via presigned URL. */
export function createStoredFile({
  tenantId,
  ownerUserId,
  bucket,
  storageKey,
  originalName,
  contentType,
  size,
  category,
  actorUserId
}: CreateStoredFileInput) {
  return prisma.$transaction(async (tx) => {
    const file = await tx.storedFile.create({
      data: { tenantId, ownerUserId, bucket, storageKey, originalName, contentType, size, category }
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "file.created",
        entityType: "StoredFile",
        entityId: file.id,
        metadata: { category, contentType, size }
      }
    });

    return file;
  });
}

/** Mark a tenant-scoped file READY once the client confirms the upload completed. */
export async function markStoredFileReady(id: string, tenantId: string) {
  await prisma.storedFile.updateMany({ where: { id, tenantId }, data: { status: "READY" } });
  return getStoredFile(id, tenantId);
}

/** A single tenant-scoped file (metadata only). */
export function getStoredFile(id: string, tenantId: string) {
  return prisma.storedFile.findFirst({ where: { id, tenantId } });
}

/** Files for a tenant, optionally filtered by category. */
export function listStoredFiles(tenantId: string, category?: string) {
  return prisma.storedFile.findMany({
    where: { tenantId, ...(category ? { category } : {}) },
    orderBy: { createdAt: "desc" }
  });
}

/** Delete a tenant-scoped file row + audit; the object itself is removed by the caller. */
export function deleteStoredFile(id: string, tenantId: string, actorUserId: string | null) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.storedFile.deleteMany({ where: { id, tenantId } });
    if (count > 0) {
      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId,
          action: "file.deleted",
          entityType: "StoredFile",
          entityId: id
        }
      });
    }
    return count > 0;
  });
}
