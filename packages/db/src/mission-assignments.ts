import { Prisma } from "@prisma/client";
import { prisma } from "./client";

export const DEFAULT_ASSIGNMENT_WEEK = 1;
/** Programs run four weeks; passing week 4 graduates rather than assigning a week 5. */
export const FINAL_PROGRAM_WEEK = 4;

const REQUIRED_WORKING_DAYS = 4; // Monday–Thursday
const THURSDAY = 4; // Date.getUTCDay(): Sunday = 0 … Thursday = 4

// Deadlines are meant to land before Friday starts in the tenant's own local time, not UTC. This
// tenant runs on Pakistan Standard Time (UTC+5, no DST), so the end-of-Thursday cutoff is stored
// as 18:59:59.999 UTC — the instant that is 23:59:59.999 PKT. Per-tenant timezone support is
// deferred future work (see D-093); this hardcodes the one timezone this deployment actually
// needs so the cadence stops silently slipping into Friday morning for its users.
const TENANT_UTC_OFFSET_HOURS = 5;
const END_OF_DAY_UTC_HOUR = 23 - TENANT_UTC_OFFSET_HOURS;

function isWorkingDay(day: number): boolean {
  return day >= 1 && day <= THURSDAY; // Mon(1)–Thu(4)
}

/**
 * Mission deadline that always lands on a Thursday (a consistent submission cadence) while
 * guaranteeing the applicant at least four working days (Mon–Thu) from acceptance. Counting Mon–Thu
 * days from the acceptance date forward, we advance to the first Thursday by which ≥4 working days
 * have elapsed:
 *   • Accepted Mon → that same-week Thursday (Mon–Thu = 4 working days).
 *   • Accepted Tue/Wed/Thu → the following Thursday (this week would give < 4).
 *   • Accepted Fri/Sat/Sun → the next Thursday (the upcoming Mon–Thu = 4 working days).
 * The deadline is the end of that Thursday in the tenant's local time (23:59:59.999 PKT, stored
 * as 18:59:59.999 UTC) so it lands before Friday starts locally, not just in UTC.
 */
export function computeMissionDeadline(acceptedAt: Date): Date {
  const cursor = new Date(Date.UTC(acceptedAt.getUTCFullYear(), acceptedAt.getUTCMonth(), acceptedAt.getUTCDate()));
  let workingDays = 0;
  for (let i = 0; i < 21; i += 1) {
    const day = cursor.getUTCDay();
    if (isWorkingDay(day)) workingDays += 1;
    if (day === THURSDAY && workingDays >= REQUIRED_WORKING_DAYS) {
      cursor.setUTCHours(END_OF_DAY_UTC_HOUR, 59, 59, 999);
      return cursor;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  cursor.setUTCHours(END_OF_DAY_UTC_HOUR, 59, 59, 999);
  return cursor;
}

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
        .map((assignment) => ({
          ...assignment.mission,
          // When the mission became workable for this applicant, so the journal form can stop them
          // dating an entry before they had even accepted it (v0.20.0).
          startedAt: assignment.acceptedAt ?? assignment.assignedAt
        }))
        .sort((a, b) => a.weekNumber - b.weekNumber || a.order - b.order || a.title.localeCompare(b.title));
    });
}

/** The applicant's latest-attempt assignment status per mission, for list-view status chips. */
export async function listApplicantMissionAssignmentStatuses(tenantId: string, applicantId: string, programId: string) {
  const assignments = await prisma.missionAssignment.findMany({
    where: { tenantId, applicantId, programId },
    select: { missionId: true, status: true, attemptNumber: true, deadlineAt: true },
    orderBy: { attemptNumber: "desc" }
  });
  const latestByMission = new Map<string, (typeof assignments)[number]>();
  for (const assignment of assignments) {
    if (!latestByMission.has(assignment.missionId)) {
      latestByMission.set(assignment.missionId, assignment);
    }
  }
  return new Map(
    [...latestByMission.entries()].map(([missionId, assignment]) => [
      missionId,
      { status: assignment.status, deadlineAt: assignment.deadlineAt },
    ])
  );
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

export function getCurrentMissionAssignmentForApplicantProgram(
  tenantId: string,
  applicantId: string,
  programId: string
) {
  return prisma.missionAssignment.findFirst({
    where: {
      tenantId,
      applicantId,
      programId,
      status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] },
      mission: { status: "PUBLISHED" }
    },
    include: { mission: true },
    orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
  });
}

export function getLatestMissionAssignmentForApplicantProgram(
  tenantId: string,
  applicantId: string,
  programId: string
) {
  return prisma.missionAssignment.findFirst({
    where: { tenantId, applicantId, programId, mission: { status: "PUBLISHED" } },
    include: { mission: true },
    orderBy: [{ weekNumber: "desc" }, { attemptNumber: "desc" }]
  });
}

export function getApplicantMissionAssignmentForMission(
  tenantId: string,
  applicantId: string,
  missionId: string
) {
  return prisma.missionAssignment.findFirst({
    where: {
      tenantId,
      applicantId,
      missionId,
      mission: { status: "PUBLISHED" }
    },
    include: { mission: true },
    orderBy: { attemptNumber: "desc" }
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

/**
 * Backfill: when a mission is published (at creation or via status change), any already-accepted
 * applicants for that program who don't yet have a Week 1 assignment need one created. This closes
 * the gap where an application is accepted before any PUBLISHED mission exists — the acceptance-time
 * assignment returned null because no missions were found, and nothing retroactively created the
 * assignment when a mission was later published.
 *
 * Safe to call multiple times: `assignWeekMissionToAcceptedApplicantTx` is idempotent (returns the
 * existing assignment if one already exists for the week/attempt).
 */
/**
 * Warn the people who can fix it that an applicant is enrolled with nothing to work on. Accepting an
 * application when the program has no publishable mission used to fail silently: the applicant
 * landed in a fully working portal with every surface empty and no one was told (v0.20.0).
 */
export async function notifyReviewersOfMissingMissionTx(
  tx: Prisma.TransactionClient,
  { tenantId, title, body }: { tenantId: string; title: string; body: string }
): Promise<number> {
  const reviewers = await tx.tenantMembership.findMany({
    where: { tenantId, role: { in: [...PROGRAM_REVIEWER_ROLES] } },
    select: { userId: true }
  });
  if (reviewers.length === 0) {
    return 0;
  }
  await tx.notification.createMany({
    data: reviewers.map((reviewer) => ({
      tenantId,
      userId: reviewer.userId,
      type: "WARNING" as const,
      title,
      body
    }))
  });
  return reviewers.length;
}

/**
 * The week this applicant should be handed next, or null when they need nothing.
 *
 * Null covers three distinct cases on purpose: an attempt is still open, the latest attempt is a
 * REPEAT (resumeAwaitingMissionAssignmentsTx owns that path and must not be double-served), or they
 * have passed the final week and graduated.
 */
export async function nextAssignableWeekForApplicantTx(
  tx: Prisma.TransactionClient,
  { tenantId, programId, applicantId }: { tenantId: string; programId: string; applicantId: string }
): Promise<number | null> {
  const latest = await tx.missionAssignment.findFirst({
    where: { tenantId, programId, applicantId },
    select: { weekNumber: true, status: true },
    orderBy: [{ weekNumber: "desc" }, { attemptNumber: "desc" }]
  });
  if (!latest) {
    return DEFAULT_ASSIGNMENT_WEEK;
  }
  if (latest.status !== "PASSED") {
    return null;
  }
  const next = latest.weekNumber + 1;
  return next <= FINAL_PROGRAM_WEEK ? next : null;
}

export async function backfillAssignmentsForAcceptedApplicantsTx(
  tx: Prisma.TransactionClient,
  { tenantId, programId }: { tenantId: string; programId: string }
) {
  const acceptedApplications = await tx.application.findMany({
    where: { tenantId, programId, status: "ACCEPTED" },
    select: { applicantId: true }
  });

  // Previously this always asked for week 1, so an applicant who had passed week 2 and was waiting
  // on week 3 was never served when week 3 was finally published -- the week-1 lookup found their
  // existing assignment and no-opped. Ask for the week each applicant actually needs instead.
  let assigned = 0;
  for (const app of acceptedApplications) {
    const weekNumber = await nextAssignableWeekForApplicantTx(tx, {
      tenantId,
      programId,
      applicantId: app.applicantId
    });
    if (weekNumber === null) {
      continue;
    }
    const assignment = await assignWeekMissionToAcceptedApplicantTx(tx, {
      tenantId,
      programId,
      applicantId: app.applicantId,
      weekNumber
    });
    if (assignment) {
      assigned += 1;
    }
  }

  return assigned;
}

/**
 * Resume applicants parked in AWAITING_MISSION_ASSIGNMENT once a mission is published for the week
 * they are waiting on.
 *
 * A REPEAT decision with no unassigned mission left for that week parks the application (see
 * createRepeatMissionForSameWeekTx) and notifies reviewers to add one. Adding it is what unblocks the
 * applicant, so publishing a mission must hand it to everyone waiting on that exact week — the
 * ACCEPTED-only backfill above skips them precisely because they are no longer ACCEPTED.
 *
 * Keeps the repeat rules intact: same week as the attempt being repeated, never a mission the
 * applicant has already been assigned for that week, and the next attempt number.
 */
export async function resumeAwaitingMissionAssignmentsTx(
  tx: Prisma.TransactionClient,
  { tenantId, programId, weekNumber }: { tenantId: string; programId: string; weekNumber: number }
) {
  // ACCEPTED is included alongside the parked status because a dangling REPEAT is reachable without
  // parking: Mission -> MissionAssignment is onDelete: Cascade, so deleting or archiving the mission
  // that held a repeat attempt removes the assignment and leaves the application ACCEPTED. The
  // per-applicant guard below (latest attempt must be REPEAT for this exact week) is what makes this
  // safe -- an ACCEPTED applicant with an open attempt is skipped.
  const waitingApplications = await tx.application.findMany({
    where: {
      tenantId,
      programId,
      status: { in: ["AWAITING_MISSION_ASSIGNMENT", "ACCEPTED"] }
    },
    select: { id: true, applicantId: true }
  });

  let resumed = 0;
  for (const application of waitingApplications) {
    // The week being repeated is the applicant's latest attempt — the one the REPEAT decision closed.
    const latest = await tx.missionAssignment.findFirst({
      where: { tenantId, programId, applicantId: application.applicantId },
      select: { weekNumber: true, attemptNumber: true, status: true },
      orderBy: [{ weekNumber: "desc" }, { attemptNumber: "desc" }]
    });
    if (!latest || latest.status !== "REPEAT" || latest.weekNumber !== weekNumber) {
      continue;
    }

    const priorAssignments = await tx.missionAssignment.findMany({
      where: { tenantId, programId, applicantId: application.applicantId, weekNumber },
      select: { missionId: true }
    });
    const assignedMissionIds = [...new Set(priorAssignments.map((prior) => prior.missionId))];

    const alternateMissions = await tx.mission.findMany({
      where: {
        tenantId,
        programId,
        weekNumber,
        status: "PUBLISHED",
        id: { notIn: assignedMissionIds }
      },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { title: "asc" }]
    });
    if (alternateMissions.length === 0) {
      continue; // still nothing for this applicant — they keep waiting
    }

    const mission = alternateMissions[0];
    await tx.missionAssignment.create({
      data: {
        tenantId,
        programId,
        applicantId: application.applicantId,
        missionId: mission.id,
        weekNumber,
        attemptNumber: latest.attemptNumber + 1,
        status: "NOT_STARTED"
      }
    });

    await tx.application.updateMany({
      where: { id: application.id, tenantId, status: "AWAITING_MISSION_ASSIGNMENT" },
      data: { status: "ACCEPTED" }
    });

    await tx.notification.create({
      data: {
        tenantId,
        userId: application.applicantId,
        type: "INFO",
        title: `New Week ${weekNumber} mission assigned: ${mission.title}`,
        body: `A new Week ${weekNumber} mission is available for your repeat attempt. Accept it to start the deadline.`
      }
    });
    resumed += 1;
  }

  return resumed;
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
  // Deadline follows the Thursday / four-working-days cadence rather than the mission's raw
  // deadlineHours, so every applicant gets ≥4 working days regardless of when they accept.
  const deadlineAt = computeMissionDeadline(acceptedAt);
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

  // A mission is assigned to an applicant at most once: exclude every mission they've already been
  // assigned for this week (not only the one just failed), so a repeat never re-serves an old mission.
  const priorAssignments = await tx.missionAssignment.findMany({
    where: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      applicantId: assignment.applicantId,
      weekNumber: assignment.weekNumber
    },
    select: { missionId: true }
  });
  const assignedMissionIds = [...new Set(priorAssignments.map((prior) => prior.missionId))];

  const alternateMissions = await tx.mission.findMany({
    where: {
      tenantId: assignment.tenantId,
      programId: assignment.programId,
      weekNumber: assignment.weekNumber,
      status: "PUBLISHED",
      id: { notIn: assignedMissionIds }
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

    await notifyReviewersOfMissingMissionTx(tx, {
      tenantId: assignment.tenantId,
      title: `Applicant needs a new Week ${assignment.weekNumber} mission assignment`,
      body: `A rejected applicant has no alternate Week ${assignment.weekNumber} mission available. Assign one manually.`
    });
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
