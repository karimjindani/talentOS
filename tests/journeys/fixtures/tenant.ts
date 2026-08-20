// tests/journeys/fixtures/tenant.ts
import {
  createMission,
  createOrganization,
  createProgram,
  markRegressionData,
  normalizeEmail,
  prisma
} from "@talentos/db";
import { journeyEmail } from "./keycloak";

export type JourneyTenant = {
  tenantId: string;
  tenantSlug: string;
  programId: string;
  /** Index 0 = week 1 … index 3 = week 4 (`FINAL_PROGRAM_WEEK`). */
  missionIds: string[];
  adminUserId: string;
  adminEmail: string;
};

const FINAL_PROGRAM_WEEK = 4;
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;

/**
 * Creates a tenant owned by this run, with one published program and all four weekly missions
 * published (v0.20.5: `applicant-arc.spec.ts` drives the full apprenticeship arc through to
 * graduation, not just week 1).
 *
 * Journeys do not share the seeded `demo` tenant: publishing a mission resumes every applicant stuck
 * on a dangling REPEAT across the whole program (D-097), so a journey publishing into `demo` would
 * mutate the seeded applicant that run.ts scenarios and the documentation screenshots depend on.
 */
export async function provisionJourneyTenant(runId: string): Promise<JourneyTenant> {
  const slug = `jrn-${runId}`.toLowerCase();
  const adminEmail = journeyEmail(runId, "admin");

  const tenant = await createOrganization({
    name: `Journey ${runId}`,
    slug,
    primaryColor: "#1f2937",
    secondaryColor: "#6366f1",
    adminEmail,
    adminName: `Journey ${runId} Admin`,
    actorUserId: null
  });

  const tenantId = tenant.id;

  // createOrganization returns the Tenant only (packages/db/src/tenants.ts:33) — it upserts the
  // admin User and their ORG_ADMIN membership inside its transaction but returns neither.
  // Look the admin up by the same normalized email it stored.
  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { email: normalizeEmail(adminEmail) }
  });
  const adminUserId = adminUser.id;

  const program = await createProgram({
    tenantId,
    name: "Journey Program",
    slug: "journey-program",
    description: "Program provisioned for a journey run.",
    status: "PUBLISHED",
    actorUserId: adminUserId
  });

  const missionIds: string[] = [];
  for (let weekNumber = 1; weekNumber <= FINAL_PROGRAM_WEEK; weekNumber += 1) {
    const mission = await createMission({
      tenantId,
      programId: program.id,
      title: `Journey Week ${weekNumber} Mission`,
      difficulty: DIFFICULTIES[weekNumber - 1],
      status: "PUBLISHED",
      weekNumber,
      order: 1,
      brief: `Build and ship the Week ${weekNumber} deliverable.`,
      objective: "Demonstrate the end-to-end submission workflow.",
      acceptanceCriteria: "A deployed URL, a repository URL and a walkthrough recording.",
      deliverables: "Repository, deployment, recording.",
      evaluationCriteria: "Completeness, clarity, working deployment.",
      competencyTags: ["delivery"],
      tutorialUrl: null,
      actorUserId: adminUserId
    });
    missionIds.push(mission.id);
    await markRegressionData({ runId, entityType: "Mission", entityId: mission.id });
  }

  // Registered newest-first is unnecessary: cleanup walks REGRESSION_CLEANUP_ORDER, not insert order.
  for (const [entityType, entityId] of [
    ["Program", program.id],
    ["User", adminUserId],
    ["Tenant", tenantId]
  ] as const) {
    await markRegressionData({ runId, entityType, entityId });
  }

  return {
    tenantId,
    tenantSlug: slug,
    programId: program.id,
    missionIds,
    adminUserId,
    adminEmail
  };
}

export { prisma };
