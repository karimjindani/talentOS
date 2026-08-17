import type { Prisma } from "@prisma/client";
import { prisma } from "./client";

export type RegressionEntityType =
  | "ApplicationAnswer"
  | "Application"
  | "StoredFile"
  | "EngineeringJournalEntry"
  | "Submission"
  | "MissionAssignment"
  | "Mission"
  | "Program"
  | "TenantMembership"
  | "User"
  | "Tenant"
  // Reaped over Keycloak's Admin REST API after the Prisma transaction commits — it cannot
  // participate in that transaction (v0.20.3, D-103).
  | "KeycloakUser";

export type RegressionMarkerInput = {
  runId: string;
  entityType: RegressionEntityType;
  entityId: string;
};

// Not annotated as `readonly RegressionEntityType[]`: that would widen every element to the full
// (now 12-member) union and break the exhaustiveness check in deleteMarkedEntities below.
// `satisfies` keeps each literal narrow while still checking membership in RegressionEntityType.
export const REGRESSION_CLEANUP_ORDER = [
  "ApplicationAnswer",
  "Application",
  "StoredFile",
  // Submissions reference missions/users, so they are removed before both (v0.15.0, D-067).
  "Submission",
  // Journal entries reference tenant/applicant/program/mission/assignment, so they are removed first.
  "EngineeringJournalEntry",
  "MissionAssignment",
  "Mission",
  "Program",
  "TenantMembership",
  "User",
  "Tenant"
] as const satisfies readonly RegressionEntityType[];

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
  // Narrowed to the Prisma-backed subset (REGRESSION_CLEANUP_ORDER's element type) rather than the
  // full RegressionEntityType union: "KeycloakUser" has no Prisma table, and the switch below must
  // stay exhaustive without inventing a case that pretends otherwise.
  entityType: (typeof REGRESSION_CLEANUP_ORDER)[number],
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
    case "EngineeringJournalEntry":
      return (await tx.engineeringJournalEntry.deleteMany({ where: { id: { in: ids } } })).count;
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
    case "Tenant":
      return (await tx.tenant.deleteMany({ where: { id: { in: ids } } })).count;
  }
}
