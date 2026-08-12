import { type ReviewDecision, type ReviewOutcome } from "@prisma/client";
import { prisma } from "./client";

/**
 * Evaluation summary (v0.20.0).
 *
 * Feeds AI evaluation of an applicant's whole program. The point is the *shape* of the journey, not
 * just the endpoint: "completed all four weeks" reads very differently from "completed all four, but
 * week 2 needed changes and week 3 only passed after repeating the week". Both of those used to look
 * identical in the data, because one Submission row is reused across the revision loop and each
 * review overwrote the last.
 *
 * Reviewer feedback text is included deliberately -- the reason changes were requested is a far
 * stronger evaluation signal than a decision label on its own.
 */

export type EvaluationReview = {
  round: number;
  decision: ReviewDecision;
  feedback: string | null;
  reviewedAt: Date;
};

export type EvaluationAttempt = {
  attemptNumber: number;
  missionId: string;
  missionTitle: string;
  status: string;
  outcome: ReviewOutcome | null;
  revisionCount: number;
  reviews: EvaluationReview[];
};

export type EvaluationWeek = {
  weekNumber: number;
  /** True when the week was repeated, i.e. more than one attempt was assigned. */
  repeated: boolean;
  /** Change requests across every attempt in the week. */
  totalRevisions: number;
  /** Outcome of the final attempt -- null while the week is still unreviewed. */
  finalOutcome: ReviewOutcome | null;
  passed: boolean;
  attempts: EvaluationAttempt[];
};

export type ApplicantEvaluationSummary = {
  tenantId: string;
  applicantId: string;
  programId: string;
  weeks: EvaluationWeek[];
  totals: {
    weeksAttempted: number;
    weeksPassed: number;
    weeksRepeated: number;
    weeksAcceptedFirstTime: number;
    totalRevisions: number;
  };
};

/**
 * Per-week review history for one applicant in one program, ordered oldest first.
 *
 * Scoped by tenantId + applicantId + programId like every other applicant query, so it can never
 * read across tenants.
 */
export async function getApplicantEvaluationSummary({
  tenantId,
  applicantId,
  programId
}: {
  tenantId: string;
  applicantId: string;
  programId: string;
}): Promise<ApplicantEvaluationSummary> {
  const assignments = await prisma.missionAssignment.findMany({
    where: { tenantId, applicantId, programId },
    select: {
      missionId: true,
      weekNumber: true,
      attemptNumber: true,
      status: true,
      reviewOutcome: true,
      revisionCount: true,
      mission: { select: { title: true } },
      reviews: {
        select: { round: true, decision: true, feedback: true, createdAt: true },
        orderBy: { round: "asc" }
      }
    },
    orderBy: [{ weekNumber: "asc" }, { attemptNumber: "asc" }]
  });

  const byWeek = new Map<number, EvaluationWeek>();
  for (const assignment of assignments) {
    const week = byWeek.get(assignment.weekNumber) ?? {
      weekNumber: assignment.weekNumber,
      repeated: false,
      totalRevisions: 0,
      finalOutcome: null,
      passed: false,
      attempts: []
    };

    week.attempts.push({
      attemptNumber: assignment.attemptNumber,
      missionId: assignment.missionId,
      missionTitle: assignment.mission.title,
      status: assignment.status,
      outcome: assignment.reviewOutcome,
      revisionCount: assignment.revisionCount,
      reviews: assignment.reviews.map((review) => ({
        round: review.round,
        decision: review.decision,
        feedback: review.feedback,
        reviewedAt: review.createdAt
      }))
    });

    week.repeated = week.attempts.length > 1;
    week.totalRevisions += assignment.revisionCount;
    // Assignments arrive ordered by attempt, so the last one seen is the current attempt.
    week.finalOutcome = assignment.reviewOutcome;
    week.passed = assignment.status === "PASSED";
    byWeek.set(assignment.weekNumber, week);
  }

  const weeks = [...byWeek.values()];
  return {
    tenantId,
    applicantId,
    programId,
    weeks,
    totals: {
      weeksAttempted: weeks.length,
      weeksPassed: weeks.filter((week) => week.passed).length,
      weeksRepeated: weeks.filter((week) => week.repeated).length,
      weeksAcceptedFirstTime: weeks.filter(
        (week) => week.finalOutcome === "ACCEPTED_FIRST_TIME" && !week.repeated
      ).length,
      totalRevisions: weeks.reduce((sum, week) => sum + week.totalRevisions, 0)
    }
  };
}

/**
 * Compact prose rendering for an AI prompt. Keeps the sequence explicit so the model does not have
 * to infer it from a status enum.
 */
export function formatEvaluationSummaryForPrompt(summary: ApplicantEvaluationSummary): string {
  if (summary.weeks.length === 0) return "No mission history yet.";

  const lines = summary.weeks.map((week) => {
    const parts: string[] = [];
    for (const attempt of week.attempts) {
      const decisions = attempt.reviews.map((review) => review.decision).join(" -> ");
      // Qualify the status: MissionAssignmentStatus has its own ACCEPTED (the applicant accepted the
      // assignment), which an evaluator would otherwise read as a passing review decision.
      parts.push(
        `attempt ${attempt.attemptNumber} on "${attempt.missionTitle}" [assignment status: ${attempt.status}]` +
          (decisions ? ` (reviews: ${decisions})` : " (not reviewed yet)")
      );
    }
    const flags = [
      week.repeated ? "week repeated" : null,
      week.totalRevisions > 0 ? `${week.totalRevisions} change request(s)` : null,
      week.finalOutcome === "ACCEPTED_FIRST_TIME" && !week.repeated ? "accepted first time" : null
    ].filter(Boolean);
    return `Week ${week.weekNumber}: ${parts.join("; ")}${flags.length ? ` — ${flags.join(", ")}` : ""}`;
  });

  const { totals } = summary;
  lines.push(
    `Totals: ${totals.weeksPassed}/${totals.weeksAttempted} weeks passed, ` +
      `${totals.weeksAcceptedFirstTime} accepted first time, ` +
      `${totals.weeksRepeated} repeated, ${totals.totalRevisions} change request(s) overall.`
  );
  return lines.join("\n");
}
