// tests/journeys/fixtures/graduate.ts
import {
  acceptMissionAssignment,
  applyStatusTransition,
  assignWeekMissionToAcceptedApplicant,
  createMission,
  createOrUpdateGraduateProfile,
  createProgram,
  createSubmittedApplication,
  markMissionTaskComplete,
  markRegressionData,
  prisma,
  reviewSubmission,
  saveSubmissionDraft,
  submitSubmission
} from "@talentos/db";
import { journeyEmail } from "./keycloak";
import type { JourneyTenant } from "./tenant";

export type PublishedGraduate = {
  userId: string;
  slug: string;
  name: string;
};

const GRADUATE_NAME = "Journey Graduate";
const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"] as const;
const RATINGS = [4, 4.5, 5, 4.5];

/**
 * Seeds one applicant with four accepted, rated missions in a dedicated program, then publishes
 * their graduate profile — the shared precondition every recruiter-facing step in the
 * recruiter-access journey needs before it can exercise anything else.
 *
 * Built directly against @talentos/db business-logic functions (the same ones the app itself
 * calls), not by driving the applicant portal in a browser: proving mission completion end-to-end
 * through a real browser session is applicant-arc.spec.ts's job, and the consent UI itself is
 * covered by the public-portal regression scenarios added in v0.20.3. This journey exists to
 * prove the recruiter's experience, not to re-prove graduate eligibility. Mirrors
 * scripts/regression/run.ts's createGraduateEligibleFixture.
 *
 * A dedicated program (not journey.tenant.programId) deliberately avoids colliding with the
 * Week 1 mission provisionJourneyTenant already publishes there for the applicant-arc-shaped
 * tenant fixture — assignWeekMissionToAcceptedApplicant picks among same-week missions by index,
 * and this fixture has no reason to depend on that mission's continued existence or numbering.
 */
export async function provisionPublishedGraduate(tenant: JourneyTenant, runId: string): Promise<PublishedGraduate> {
  const program = await createProgram({
    tenantId: tenant.tenantId,
    name: "Journey Graduate Program",
    slug: `journey-graduate-program-${runId}`.toLowerCase(),
    description: "Program provisioned to seed a published graduate for a recruiter-access journey run.",
    status: "PUBLISHED",
    actorUserId: tenant.adminUserId
  });
  await markRegressionData({ runId, entityType: "Program", entityId: program.id });

  const user = await prisma.user.create({
    data: {
      email: journeyEmail(runId, "graduate"),
      name: GRADUATE_NAME,
      memberships: { create: { tenantId: tenant.tenantId, role: "APPLICANT" } }
    },
    include: { memberships: true }
  });
  await markRegressionData({ runId, entityType: "User", entityId: user.id });
  for (const membership of user.memberships) {
    await markRegressionData({ runId, entityType: "TenantMembership", entityId: membership.id });
  }

  // assignWeekMissionToAcceptedApplicant requires an ACCEPTED Application for this tenant+program
  // (packages/db/src/mission-assignments.ts:187-192) — a TenantMembership alone isn't enough.
  const application = await createSubmittedApplication({
    tenantId: tenant.tenantId,
    programId: program.id,
    applicantId: user.id,
    answers: [{ questionKey: "motivation", questionLabel: "Why do you want to join?", answer: "Journey graduate fixture." }]
  });
  await markRegressionData({ runId, entityType: "Application", entityId: application.id });
  await applyStatusTransition({
    id: application.id,
    tenantId: tenant.tenantId,
    toStatus: "ACCEPTED",
    actorUserId: tenant.adminUserId,
    reviewerNotes: "Accepted for the recruiter-access journey's graduate fixture."
  });

  const missions = [];
  for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
    const mission = await createMission({
      tenantId: tenant.tenantId,
      programId: program.id,
      title: `Journey Graduate Week ${weekNumber} Mission`,
      difficulty: DIFFICULTIES[weekNumber - 1],
      status: "PUBLISHED",
      weekNumber,
      order: 0,
      brief: `Journey-seeded mission for week ${weekNumber}.`,
      objective: "Demonstrate weekly deliverable completion toward graduate eligibility.",
      acceptanceCriteria: "Submitted evidence is complete.",
      deliverables: "Repository, deployment, walkthrough.",
      evaluationCriteria: "Accepted with a reviewer rating from 1 to 5.",
      competencyTags: ["delivery"],
      tutorialUrl: null,
      actorUserId: tenant.adminUserId
    });
    missions.push(mission);
    await markRegressionData({ runId, entityType: "Mission", entityId: mission.id });
  }

  for (let weekNumber = 1; weekNumber <= 4; weekNumber += 1) {
    const assignment = await assignWeekMissionToAcceptedApplicant({
      tenantId: tenant.tenantId,
      programId: program.id,
      applicantId: user.id,
      weekNumber,
      chooseAssignmentIndex: () => 0
    });
    if (!assignment) throw new Error(`Journey graduate fixture: week ${weekNumber} was not assigned.`);
  }
  const assignments = await prisma.missionAssignment.findMany({
    where: { programId: program.id, applicantId: user.id },
    orderBy: { weekNumber: "asc" }
  });
  if (assignments.length !== 4) {
    throw new Error("Journey graduate fixture: applicant did not receive exactly one assignment per week.");
  }
  for (const assignment of assignments) {
    await markRegressionData({ runId, entityType: "MissionAssignment", entityId: assignment.id });
  }

  // A submission gate requires 4 journal entries per assignment attempt (getMissionSubmissionReadiness),
  // enforced server-side by submitSubmission, not just by the applicant portal's own date-picker UI.
  // One counter shared across all 4 missions' entries avoids the one-entry-per-applicant-per-date
  // constraint applicant-arc.spec.ts documents — mirrors ensureMinimumAssignmentJournals in
  // scripts/regression/run.ts, which bypasses the portal UI the same way for the same reason.
  let journalDay = 1;

  for (const [index, mission] of missions.entries()) {
    const assignment = assignments.find((candidate) => candidate.missionId === mission.id);
    if (!assignment) throw new Error(`Journey graduate fixture: no assignment for week ${mission.weekNumber}.`);

    await acceptMissionAssignment({ tenantId: tenant.tenantId, applicantId: user.id, missionAssignmentId: assignment.id });
    await markMissionTaskComplete({ tenantId: tenant.tenantId, applicantId: user.id, missionAssignmentId: assignment.id, taskIndex: 1 });
    await markMissionTaskComplete({ tenantId: tenant.tenantId, applicantId: user.id, missionAssignmentId: assignment.id, taskIndex: 2 });

    for (let entryIndex = 0; entryIndex < 4; entryIndex += 1) {
      const entry = await prisma.engineeringJournalEntry.create({
        data: {
          tenantId: tenant.tenantId,
          applicantId: user.id,
          programId: program.id,
          missionId: mission.id,
          missionAssignmentId: assignment.id,
          weekNumber: mission.weekNumber,
          entryDate: new Date(Date.UTC(2025, 0, journalDay)),
          language: "English",
          workedOn: `Journey graduate fixture week ${mission.weekNumber}, entry ${entryIndex + 1}.`,
          challenge: "Keep the fixture's evidence realistic without driving a real browser session.",
          solution: "Write directly against the same package functions the applicant portal calls.",
          learned: "The submission gate requires 4 journal entries per assignment attempt.",
          aiUsage: "None",
          confidenceRating: 4,
          timeSpentHours: 1,
          evidenceLinks: []
        }
      });
      await markRegressionData({ runId, entityType: "EngineeringJournalEntry", entityId: entry.id });
      journalDay += 1;
    }

    const submission = await saveSubmissionDraft({
      tenantId: tenant.tenantId,
      missionId: mission.id,
      applicantId: user.id,
      repositoryUrl: `https://github.com/talentos-journey/graduate-${runId}-week-${mission.weekNumber}`,
      deploymentUrl: `https://week-${mission.weekNumber}.graduate-${runId}.journey.example.com`,
      loomUrl: `https://www.loom.com/share/graduate-${runId}-week-${mission.weekNumber}`,
      journalMarkdown: `## Week ${mission.weekNumber}\nJourney-seeded graduate fixture evidence.`
    });
    await markRegressionData({ runId, entityType: "Submission", entityId: submission.id });

    // Same reachability stub applicant-arc.spec.ts uses for its own direct submitSubmission call:
    // a synthetic loom.com URL is never actually reachable, and this fixture must not fail because
    // a third-party site is down or rate-limiting the runner.
    await submitSubmission(
      { id: submission.id, tenantId: tenant.tenantId, applicantId: user.id },
      { checkEvidenceUrl: async (url) => ({ reachable: true, finalUrl: url, statusCode: 200, error: null }) }
    );

    await reviewSubmission({
      id: submission.id,
      tenantId: tenant.tenantId,
      status: "ACCEPTED",
      reviewerFeedback: `Week ${mission.weekNumber} accepted for the recruiter-access journey's graduate fixture.`,
      reviewerUserId: tenant.adminUserId,
      rating: RATINGS[index]
    });
  }

  // publicProfileEnabled/consentStatus=ACKNOWLEDGED, exactly what the applicant's own consent
  // acknowledgment does — the consent UI itself has its own coverage (v0.20.3 public-portal
  // regression scenarios), so this fixture goes straight to the package function it calls.
  const profile = await createOrUpdateGraduateProfile(user.id, {
    bio: "Journey-seeded graduate profile for the recruiter-access browser journey.",
    skills: ["typescript", "testing"],
    interests: ["platform engineering"],
    emailPublic: false
  });
  // No "GraduateProfile" RegressionEntityType exists: GraduateProfile.user has onDelete: Cascade
  // (schema.prisma:783), so deleting the "User" marker above already reaps this row and everything
  // that cascades from it (ConsentHistory, GraduateArtifact, RecruiterAccessRequest, and in turn
  // ProfileViewAudit) — only RecruiterAccount rows need their own marker (see recruiter-access.spec.ts).

  return { userId: user.id, slug: profile.slug, name: GRADUATE_NAME };
}
