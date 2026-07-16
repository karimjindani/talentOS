import { Prisma } from "@prisma/client";
import { prisma } from "./client";

export const DEFAULT_ASSIGNMENT_WEEK = 1;

export type MissionAssignmentInput = {
  tenantId: string;
  programId: string;
  applicantId: string;
  weekNumber?: number;
  chooseAssignmentIndex?: (candidateCount: number) => number;
};

type MissionCandidate = {
  id: string;
  title: string;
  order: number;
};

export function listAssignedProgramMissions(tenantId: string, applicantId: string, programId: string) {
  return prisma.missionAssignment
    .findMany({
      where: { tenantId, applicantId, programId, mission: { status: "PUBLISHED" } },
      include: { mission: true },
      orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
    })
    .then((assignments) => {
      const latestByWeek = new Map<number, (typeof assignments)[number]>();
      for (const assignment of assignments) {
        if (!latestByWeek.has(assignment.weekNumber)) {
          latestByWeek.set(assignment.weekNumber, assignment);
        }
      }
      return [...latestByWeek.values()]
        .map((assignment) => assignment.mission)
        .sort((a, b) => a.weekNumber - b.weekNumber || a.order - b.order || a.title.localeCompare(b.title));
    });
}

/** The applicant's latest-attempt assignment status per mission, for list-view status chips. */
export async function listApplicantMissionAssignmentStatuses(tenantId: string, applicantId: string, programId: string) {
  const assignments = await prisma.missionAssignment.findMany({
    where: { tenantId, applicantId, programId },
    select: { missionId: true, status: true, attemptNumber: true },
    orderBy: { attemptNumber: "desc" }
  });
  const latestByMission = new Map<string, (typeof assignments)[number]>();
  for (const assignment of assignments) {
    if (!latestByMission.has(assignment.missionId)) {
      latestByMission.set(assignment.missionId, assignment);
    }
  }
  return new Map([...latestByMission.entries()].map(([missionId, assignment]) => [missionId, assignment.status]));
}

/** The applicant's latest attempt (any status) for a mission — used to render accept/countdown UI. */
export function getLatestMissionAssignmentForMission(tenantId: string, applicantId: string, missionId: string) {
  return prisma.missionAssignment.findFirst({
    where: { tenantId, applicantId, missionId },
    orderBy: { attemptNumber: "desc" }
  });
}

export function getAssignedProgramMission(
  missionId: string,
  tenantId: string,
  applicantId: string,
  programId: string
) {
  return prisma.mission.findFirst({
    where: {
      id: missionId,
      tenantId,
      programId,
      status: "PUBLISHED",
      assignments: { some: { tenantId, programId, applicantId } }
    }
  });
}

export function assignWeekMissionToAcceptedApplicant(input: MissionAssignmentInput) {
  return prisma.$transaction((tx) => assignWeekMissionToAcceptedApplicantTx(tx, input));
}

export async function assignWeekMissionToAcceptedApplicantTx(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    programId,
    applicantId,
    weekNumber = DEFAULT_ASSIGNMENT_WEEK,
    chooseAssignmentIndex = randomAssignmentIndex
  }: MissionAssignmentInput
) {
  const acceptedApplication = await tx.application.findFirst({
    where: { tenantId, programId, applicantId, status: "ACCEPTED" },
    select: { id: true }
  });
  if (!acceptedApplication) {
    throw new Error("Mission assignments require an accepted application for this program.");
  }

  const existing = await tx.missionAssignment.findFirst({
    where: { tenantId, programId, applicantId, weekNumber, attemptNumber: 1 }
  });
  if (existing) {
    return existing;
  }

  const missions = await tx.mission.findMany({
    where: { tenantId, programId, weekNumber, status: "PUBLISHED" },
    select: { id: true, title: true, order: true },
    orderBy: [{ order: "asc" }, { title: "asc" }]
  });
  if (missions.length === 0) {
    return null;
  }

  const counts = await tx.missionAssignment.groupBy({
    by: ["missionId"],
    where: { tenantId, programId, weekNumber, missionId: { in: missions.map((mission) => mission.id) } },
    _count: { missionId: true }
  });
  const assignmentCountByMission = new Map(counts.map((count) => [count.missionId, count._count.missionId]));
  const leastAssignedCount = Math.min(...missions.map((mission) => assignmentCountByMission.get(mission.id) ?? 0));
  const leastAssignedMissions = missions.filter(
    (mission) => (assignmentCountByMission.get(mission.id) ?? 0) === leastAssignedCount
  );
  const mission = pickMissionCandidate(leastAssignedMissions, chooseAssignmentIndex);

  return tx.missionAssignment.create({
    data: {
      tenantId,
      programId,
      applicantId,
      missionId: mission.id,
      weekNumber,
      attemptNumber: 1,
      status: "NOT_STARTED"
    }
  });
}

export function acceptMissionAssignment(input: {
  tenantId: string;
  applicantId: string;
  missionAssignmentId: string;
}) {
  return prisma.$transaction((tx) => acceptMissionAssignmentTx(tx, input));
}

/**
 * The applicant's explicit "Accept Mission" action. Starts the deadline/grace countdown from this
 * moment, not from when the mission was assigned — an un-accepted assignment never expires.
 */
export async function acceptMissionAssignmentTx(
  tx: Prisma.TransactionClient,
  { tenantId, applicantId, missionAssignmentId }: { tenantId: string; applicantId: string; missionAssignmentId: string }
) {
  const assignment = await tx.missionAssignment.findFirst({
    where: { id: missionAssignmentId, tenantId, applicantId },
    include: { mission: { select: { deadlineHours: true, gracePeriodHours: true } } }
  });
  if (!assignment) {
    throw new Error("Mission assignment not found for this applicant.");
  }
  if (assignment.status !== "NOT_STARTED") {
    throw new Error(`Only a NOT_STARTED assignment can be accepted (current status: ${assignment.status}).`);
  }

  const acceptedAt = new Date();
  const deadlineAt = new Date(acceptedAt.getTime() + assignment.mission.deadlineHours * 60 * 60 * 1000);
  const graceEndsAt = new Date(deadlineAt.getTime() + assignment.mission.gracePeriodHours * 60 * 60 * 1000);

  return tx.missionAssignment.update({
    where: { id: assignment.id },
    data: { status: "ACCEPTED", acceptedAt, deadlineAt, graceEndsAt }
  });
}

export function getActiveMissionAssignmentForMissionTx(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    applicantId,
    missionId
  }: {
    tenantId: string;
    applicantId: string;
    missionId: string;
  }
) {
  return tx.missionAssignment.findFirst({
    where: {
      tenantId,
      applicantId,
      missionId,
      // NOT_STARTED is excluded — the applicant must explicitly accept before evidence is editable.
      // OVERDUE stays editable through the grace period (a late submission is still allowed).
      status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] },
      mission: { status: "PUBLISHED" }
    },
    include: { mission: { select: { id: true, programId: true, weekNumber: true } } },
    orderBy: { attemptNumber: "desc" }
  });
}

const PROGRAM_REVIEWER_ROLES = ["ORG_ADMIN", "TECH_LEAD"] as const;

/**
 * On a REPEAT review decision, the applicant repeats the *same week* with a different mission than
 * the one they just failed (not a retry of the same mission, and not a reset back to week one).
 * If no alternate PUBLISHED mission exists for that week, no assignment is created — the
 * applicant's program status moves to AWAITING_MISSION_ASSIGNMENT and every Org Admin / Tech Lead
 * in the tenant is notified to assign one manually. The rejected mission is never reassigned, and
 * the applicant is never removed.
 *
 * A missed deadline (grace period expired with no submission) is a separate, terminal outcome —
 * see sweepMissionDeadlines, which marks the assignment FAILED and the application DISQUALIFIED
 * instead of going through this repeat path.
 */
export async function createRepeatMissionForSameWeekTx(
  tx: Prisma.TransactionClient,
  assignment: {
    id: string;
    tenantId: string;
    programId: string;
    applicantId: string;
    missionId: string;
    weekNumber: number;
  }
) {
  const latest = await tx.missionAssignment.findFirst({
    where: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      applicantId: assignment.applicantId
    },
    select: { id: true },
    orderBy: [{ weekNumber: "desc" }, { attemptNumber: "desc" }]
  });
  if (!latest || latest.id !== assignment.id) {
    throw new Error("Only the applicant's latest assignment attempt can be repeated.");
  }

  const alternateMissions = await tx.mission.findMany({
    where: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      weekNumber: assignment.weekNumber,
      status: "PUBLISHED",
      id: { not: assignment.missionId }
    },
    select: { id: true, title: true, order: true },
    orderBy: [{ order: "asc" }, { title: "asc" }]
  });

  if (alternateMissions.length === 0) {
    await tx.application.updateMany({
      where: {
        tenantId: assignment.tenantId,
        programId: assignment.programId,
        applicantId: assignment.applicantId,
        status: "ACCEPTED"
      },
      data: { status: "AWAITING_MISSION_ASSIGNMENT" }
    });

    const reviewers = await tx.tenantMembership.findMany({
      where: { tenantId: assignment.tenantId, role: { in: [...PROGRAM_REVIEWER_ROLES] } },
      select: { userId: true }
    });
    if (reviewers.length > 0) {
      await tx.notification.createMany({
        data: reviewers.map((reviewer) => ({
          tenantId: assignment.tenantId,
          userId: reviewer.userId,
          type: "WARNING" as const,
          title: `Applicant needs a new Week ${assignment.weekNumber} mission assignment`,
          body: `A rejected applicant has no alternate Week ${assignment.weekNumber} mission available. Assign one manually.`
        }))
      });
    }
    return null;
  }

  const latestSameWeek = await tx.missionAssignment.findFirst({
    where: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      applicantId: assignment.applicantId,
      weekNumber: assignment.weekNumber
    },
    select: { attemptNumber: true },
    orderBy: { attemptNumber: "desc" }
  });
  const nextAttemptNumber = (latestSameWeek?.attemptNumber ?? 0) + 1;
  const mission = pickMissionCandidate(alternateMissions, randomAssignmentIndex);

  return tx.missionAssignment.create({
    data: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      applicantId: assignment.applicantId,
      missionId: mission.id,
      weekNumber: assignment.weekNumber,
      attemptNumber: nextAttemptNumber,
      status: "NOT_STARTED"
    }
  });
}

function pickMissionCandidate(
  candidates: MissionCandidate[],
  chooseAssignmentIndex: (candidateCount: number) => number
): MissionCandidate {
  const requestedIndex = Math.trunc(chooseAssignmentIndex(candidates.length));
  const safeIndex = Number.isFinite(requestedIndex)
    ? Math.min(Math.max(requestedIndex, 0), candidates.length - 1)
    : 0;
  const candidate = candidates[safeIndex];
  if (!candidate) {
    throw new Error("No mission assignment candidates are available.");
  }
  return candidate;
}

function randomAssignmentIndex(candidateCount: number): number {
  return Math.floor(Math.random() * candidateCount);
}
