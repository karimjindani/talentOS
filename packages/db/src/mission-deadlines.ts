import { prisma } from "./client";

export type SweepMissionDeadlinesResult = {
  markedOverdue: number;
  markedFailed: number;
  disqualifiedApplicants: number;
};

/**
 * Deadline sweep for mission assignments. Meant to be invoked by an external scheduler (cron / OS
 * task scheduler) — deliberately kept out of the long-running app processes so scheduling scales
 * independently of them.
 *
 * Idempotent by construction: each phase's WHERE clause is scoped to the source status, so a row
 * already moved out of that status (by a previous run, a concurrent run, or the applicant's own
 * action) simply won't match on a later run — re-running never double-transitions a row or sends a
 * duplicate notification. The grace-expiry phase re-checks the row's status again inside its own
 * transaction immediately before writing, closing the race between the initial scan and the write.
 */
export async function sweepMissionDeadlines(now: Date = new Date()): Promise<SweepMissionDeadlinesResult> {
  const overdue = await prisma.missionAssignment.updateMany({
    where: {
      status: { in: ["ACCEPTED", "IN_PROGRESS"] },
      deadlineAt: { lt: now }
    },
    data: { status: "OVERDUE" }
  });

  const graceExpired = await prisma.missionAssignment.findMany({
    where: { status: "OVERDUE", graceEndsAt: { lt: now } },
    select: { id: true, tenantId: true, programId: true, applicantId: true }
  });

  let markedFailed = 0;
  let disqualifiedApplicants = 0;

  for (const assignment of graceExpired) {
    await prisma.$transaction(async (tx) => {
      const transitioned = await tx.missionAssignment.updateMany({
        where: { id: assignment.id, status: "OVERDUE", graceEndsAt: { lt: now } },
        data: { status: "FAILED" }
      });
      if (transitioned.count === 0) {
        // Already handled by a previous or concurrent sweep run since the scan above.
        return;
      }
      markedFailed += 1;

      const disqualified = await tx.application.updateMany({
        where: {
          tenantId: assignment.tenantId,
          programId: assignment.programId,
          applicantId: assignment.applicantId,
          status: "ACCEPTED"
        },
        data: { status: "DISQUALIFIED" }
      });
      disqualifiedApplicants += disqualified.count;
    });
  }

  return { markedOverdue: overdue.count, markedFailed, disqualifiedApplicants };
}
