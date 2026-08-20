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
  // RecruiterAccount has no relation back to User/Tenant (recruiters are not applicants), so it
  // cascades from nothing the rest of this cleanup deletes — it must be marked and swept
  // explicitly or every regression run touching the public-portal recruiter flow leaks one row.
  | "RecruiterAccount"
  // RecruiterAccessRequest.graduate cascades from GraduateProfile/User (Prisma onDelete: Cascade)
  // — but only when the request happens to be attached to a graduate *this run itself created*.
  // The real request-access route attaches every submission to "the first public graduate
  // profile" in the whole database (apps/applicant/app/api/graduates/request-access/route.ts),
  // not necessarily one this run owns, so relying on that cascade alone leaves the row orphaned
  // forever whenever some other fixture's graduate happens to be "first" (found live, v0.20.5).
  | "RecruiterAccessRequest"
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
  "Tenant",
  // Independent of the User/Tenant chain above — order relative to it doesn't matter. Deleted by
  // explicit marked ID, not cascade, so its own order relative to RecruiterAccount doesn't matter
  // either (RecruiterAccessRequest.recruiter is onDelete: SetNull, not a blocking FK either way).
  "RecruiterAccount",
  "RecruiterAccessRequest"
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
    case "RecruiterAccount":
      return (await tx.recruiterAccount.deleteMany({ where: { id: { in: ids } } })).count;
    case "RecruiterAccessRequest":
      return (await tx.recruiterAccessRequest.deleteMany({ where: { id: { in: ids } } })).count;
  }
}
