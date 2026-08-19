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
  missionId: string;
  adminUserId: string;
  adminEmail: string;
};

/**
 * Creates a tenant owned by this run, with one published program and one published Week 1 mission.
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

  const mission = await createMission({
    tenantId,
    programId: program.id,
    title: "Journey Week 1 Mission",
    difficulty: "BEGINNER",
    status: "PUBLISHED",
    weekNumber: 1,
    order: 1,
    brief: "Build and ship the Week 1 deliverable.",
    objective: "Demonstrate the end-to-end submission workflow.",
    acceptanceCriteria: "A deployed URL, a repository URL and a walkthrough recording.",
    deliverables: "Repository, deployment, recording.",
    evaluationCriteria: "Completeness, clarity, working deployment.",
    competencyTags: ["delivery"],
    tutorialUrl: null,
    actorUserId: adminUserId
  });

  // Registered newest-first is unnecessary: cleanup walks REGRESSION_CLEANUP_ORDER, not insert order.
  for (const [entityType, entityId] of [
    ["Mission", mission.id],
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
    missionId: mission.id,
    adminUserId,
    adminEmail
  };
}

export { prisma };
