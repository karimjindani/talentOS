import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type RegressionEntityType =
  | "ApplicationAnswer"
  | "Application"
  | "StoredFile"
  | "Submission"
  | "MissionAssignment"
  | "Mission"
  | "Program"
  | "TenantMembership"
  | "User";

export type RegressionMarkerInput = {
  runId: string;
  entityType: RegressionEntityType;
  entityId: string;
};

export const REGRESSION_CLEANUP_ORDER: readonly RegressionEntityType[] = [
  "ApplicationAnswer",
  "Application",
  "StoredFile",
  // Submissions reference missions/users, so they are removed before both (v0.15.0, D-067).
  "Submission",
  "MissionAssignment",
  "Mission",
  "Program",
  "TenantMembership",
  "User"
];

export function markRegressionData(input: RegressionMarkerInput) {
  return prisma.regressionDataMarker.upsert({
    where: {
      entityType_entityId: {
        entityType: input.entityType,
        entityId: input.entityId
      }
    },
    update: { runId: input.runId },
    create: input
  });
}

export type RegressionCleanupSummary = {
  runId: string | null;
  marked: number;
  deletedByType: Partial<Record<RegressionEntityType, number>>;
};

export async function cleanupRegressionData(runId?: string): Promise<RegressionCleanupSummary> {
  const where = runId ? { runId } : {};
  const markers = await prisma.regressionDataMarker.findMany({ where });
  const deletedByType: Partial<Record<RegressionEntityType, number>> = {};

  if (markers.length === 0) {
    return { runId: runId ?? null, marked: 0, deletedByType };
  }

  await prisma.$transaction(async (tx) => {
    for (const entityType of REGRESSION_CLEANUP_ORDER) {
      const ids = markers.filter((marker) => marker.entityType === entityType).map((marker) => marker.entityId);
      if (ids.length === 0) continue;

      const deleted = await deleteMarkedEntities(tx, entityType, ids);
      deletedByType[entityType] = deleted;
    }

    await tx.regressionDataMarker.deleteMany({ where: { id: { in: markers.map((marker) => marker.id) } } });
  });

  return { runId: runId ?? null, marked: markers.length, deletedByType };
}

async function deleteMarkedEntities(
  tx: Prisma.TransactionClient,
  entityType: RegressionEntityType,
  ids: string[]
): Promise<number> {
  switch (entityType) {
    case "ApplicationAnswer":
      return (await tx.applicationAnswer.deleteMany({ where: { id: { in: ids } } })).count;
    case "Application":
      return (await tx.application.deleteMany({ where: { id: { in: ids } } })).count;
    case "StoredFile":
      return (await tx.storedFile.deleteMany({ where: { id: { in: ids } } })).count;
    case "Submission":
      return (await tx.submission.deleteMany({ where: { id: { in: ids } } })).count;
    case "MissionAssignment":
      return (await tx.missionAssignment.deleteMany({ where: { id: { in: ids } } })).count;
    case "Mission":
      return (await tx.mission.deleteMany({ where: { id: { in: ids } } })).count;
    case "Program":
      return (await tx.program.deleteMany({ where: { id: { in: ids } } })).count;
    case "TenantMembership":
      return (await tx.tenantMembership.deleteMany({ where: { id: { in: ids } } })).count;
    case "User":
      return (await tx.user.deleteMany({ where: { id: { in: ids } } })).count;
  }
}
