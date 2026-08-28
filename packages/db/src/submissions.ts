import { type ReviewDecision, type ReviewOutcome, type SubmissionStatus } from "@prisma/client";
import { prisma } from "./client";
import {
  assignWeekMissionToAcceptedApplicantTx,
  FINAL_PROGRAM_WEEK,
  createRepeatMissionForSameWeekTx,
  getActiveMissionAssignmentForMissionTx
} from "./mission-assignments";
import {
  assertMissionSubmissionReady,
  checkMissionSubmissionUrlReachability,
  getMissionSubmissionReadiness,
  getMissionSubmissionReadinessWithClient,
  REQUIRED_JOURNAL_ENTRY_COUNT,
  SubmissionReadinessError
} from "./submission-readiness";
import { isFeatureFlagEnabled, JOURNAL_TESTING_MODE_FLAG } from "./feature-flags";
import { getCompletionSnapshot } from "./graduates";
import {
  checkPublicEvidenceUrl,
  normalizeDeploymentUrls,
  parseEvidenceUrl,
  type EvidenceUrlKind,
  type PublicUrlCheckResult
} from "./url-safety";

export { normalizeDeploymentUrls, parseDeploymentUrls, parseEvidenceUrl } from "./url-safety";
import { REQUIRED_TASK_INDEXES } from "./mission-tasks";

// Programs run a fixed four-week arc; accepting the week-4 submission completes the program
// instead of assigning a week 5 (assignWeekMissionToAcceptedApplicantTx already no-ops when no
// PUBLISHED mission exists for a week, but the explicit cap keeps that intent obvious here).

// Mission-submission workflow helpers (v0.15.0, D-067). All reads/writes are tenant-scoped via the
// Submission.tenantId column; writes additionally verify the mission chain and the applicant owner.
// Status-machine enforcement lives in @talentos/auth (assertSubmissionStatusTransition) and is
// applied by the server actions; these helpers add structural guards (status-scoped updateMany) as
// defense in depth.

/** Evidence-URL kinds and their allowed hosts. Deployment URLs may live anywhere (any http/https). */
/**
 * Validate an optional evidence URL (empty → null). Repository and Loom links are host-allowlisted
 * (mirrors the apply flow's profile-link rule) so stored links can't be used for phishing;
 * deployment links only need to be well-formed http(s).
 */
/** The applicant's own submission for a mission (or null before their first draft). */
export function getApplicantSubmission(missionId: string, applicantId: string, tenantId: string) {
  return prisma.submission.findFirst({
    where: { missionId, applicantId, tenantId },
    orderBy: { createdAt: "desc" }
  });
}

/** The applicant's submission for one exact assignment attempt. */
export function getApplicantSubmissionForAssignment(
  missionAssignmentId: string,
  applicantId: string,
  tenantId: string
) {
  return prisma.submission.findFirst({
    where: { missionAssignmentId, applicantId, tenantId }
  });
}

/** The applicant's submissions across a whole program (drives the mission-list status chips). */
export function listApplicantProgramSubmissions(tenantId: string, applicantId: string, programId: string) {
  return prisma.submission.findMany({
    where: { tenantId, applicantId, mission: { programId } },
    select: { id: true, missionId: true, missionAssignmentId: true, status: true, submittedAt: true },
    orderBy: { createdAt: "asc" }
  });
}

/** All submissions for one mission (admin review list). */
export function listMissionSubmissions(tenantId: string, missionId: string) {
  return prisma.submission.findMany({
    where: { tenantId, missionId },
    include: { applicant: { select: { id: true, name: true, email: true } } },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }]
  });
}

export type TenantSubmissionFilters = {
  status?: SubmissionStatus;
  programId?: string;
};

/** All submissions across every mission in the tenant (the top-level Submissions admin page). */
export function listTenantSubmissions(tenantId: string, filters: TenantSubmissionFilters = {}) {
  return prisma.submission.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.programId ? { mission: { programId: filters.programId } } : {})
    },
    include: {
      applicant: { select: { id: true, name: true, email: true } },
      mission: { select: { id: true, title: true, weekNumber: true, programId: true, program: { select: { name: true } } } }
    },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }]
  });
}

/** One submission with review context (admin review page). Cross-tenant ids resolve to null. */
export function getTenantSubmission(id: string, tenantId: string) {
  return prisma.submission.findFirst({
    where: { id, tenantId },
    include: {
      mission: true,
      missionAssignment: { select: { id: true, attemptNumber: true, weekNumber: true } },
      applicant: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } }
    }
  });
}

export type SubmissionEvidenceInput = {
  tenantId: string;
  missionId: string;
  applicantId: string;
  repositoryUrl: string | null;
  deploymentUrl: string | null;
  loomUrl: string | null;
  journalMarkdown?: string | null;
};

/**
 * Create or update the applicant's draft for a mission. The mission must be a PUBLISHED mission of
 * this tenant; evidence is only writable while the submission is editable (DRAFT / NEEDS_REVISION).
 */
export async function saveSubmissionDraft(input: SubmissionEvidenceInput) {
  return prisma.$transaction(async (tx) => {
    const activeAssignment = await getActiveMissionAssignmentForMissionTx(tx, {
      tenantId: input.tenantId,
      applicantId: input.applicantId,
      missionId: input.missionId
    });
    const assignment =
      activeAssignment ??
      (await tx.missionAssignment.findFirst({
        where: {
          tenantId: input.tenantId,
          applicantId: input.applicantId,
          missionId: input.missionId,
          mission: { status: "PUBLISHED" }
        },
        include: { mission: { select: { id: true, programId: true, weekNumber: true } } },
        orderBy: { attemptNumber: "desc" }
      }));
    if (!assignment) {
      throw new Error("Mission is not assigned to this applicant.");
    }

    const existing = await tx.submission.findFirst({
      where: {
        missionAssignmentId: assignment.id,
        missionId: input.missionId,
        applicantId: input.applicantId,
        tenantId: input.tenantId
      },
      select: { id: true, status: true }
    });

    if (!activeAssignment) {
      if (existing) {
        throw new Error("This submission is not editable in its current status.");
      }
      throw new Error("Mission is not assigned to an active attempt for this applicant.");
    }

    const evidence: {
      repositoryUrl: string | null;
      deploymentUrl: string | null;
      loomUrl: string | null;
      journalMarkdown?: string | null;
    } = {
      repositoryUrl: input.repositoryUrl,
      deploymentUrl: normalizeDeploymentUrls(input.deploymentUrl),
      loomUrl: input.loomUrl
    };
    if (Object.prototype.hasOwnProperty.call(input, "journalMarkdown")) {
      evidence.journalMarkdown = input.journalMarkdown ?? null;
    }

    if (!existing) {
      const created = await tx.submission.create({
        data: {
          tenantId: input.tenantId,
          missionId: assignment.mission.id,
          applicantId: input.applicantId,
          missionAssignmentId: assignment.id,
          status: "DRAFT",
          ...evidence
        }
      });
      // First draft moves the assignment from ACCEPTED to IN_PROGRESS; no-op if it's already
      // IN_PROGRESS or OVERDUE (drafting during the grace period doesn't change its status).
      await tx.missionAssignment.updateMany({
        where: { id: assignment.id, tenantId: input.tenantId, applicantId: input.applicantId, status: "ACCEPTED" },
        data: { status: "IN_PROGRESS" }
      });
      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.applicantId,
          action: "submission.created",
          entityType: "Submission",
          entityId: created.id,
          metadata: {
            missionId: assignment.mission.id,
            missionAssignmentId: assignment.id,
            attemptNumber: assignment.attemptNumber
          }
        }
      });
      return created;
    }

    if (existing.status !== "DRAFT" && existing.status !== "NEEDS_REVISION") {
      throw new Error("This submission is not editable in its current status.");
    }

    await tx.submission.update({ where: { id: existing.id }, data: evidence });
    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.applicantId,
        action: "submission.updated",
        entityType: "Submission",
        entityId: existing.id,
        metadata: {
          missionId: assignment.mission.id,
          missionAssignmentId: assignment.id,
          attemptNumber: assignment.attemptNumber,
          status: existing.status
        }
      }
    });
    return tx.submission.findFirstOrThrow({ where: { id: existing.id } });
  });
}

export type SubmitSubmissionInput = {
  id: string;
  tenantId: string;
  applicantId: string;
};

export type SubmitSubmissionDependencies = {
  checkEvidenceUrl?: (url: string, kind: EvidenceUrlKind) => Promise<PublicUrlCheckResult>;
};

/** Validate readiness and public evidence before atomically submitting and locking this attempt. */
export async function submitSubmission(
  { id, tenantId, applicantId }: SubmitSubmissionInput,
  dependencies: SubmitSubmissionDependencies = {}
) {
  const submission = await prisma.submission.findFirst({
    where: { id, tenantId, applicantId }
  });
  if (!submission) {
    throw new Error("Submission not found for this tenant.");
  }
  if (submission.status !== "DRAFT" && submission.status !== "NEEDS_REVISION") {
    throw new Error(`Invalid submission status transition from ${submission.status} to SUBMITTED.`);
  }
  if (!submission.missionAssignmentId) {
    throw new Error("This submission is not linked to an assignment attempt.");
  }
  const missionAssignmentId = submission.missionAssignmentId;

  // Keep the in-transaction re-check consistent with the preflight: when journal.testing_mode is
  // on, neither requires 4 journal entries.
  const requiredJournalCount = (await isFeatureFlagEnabled(JOURNAL_TESTING_MODE_FLAG))
    ? 0
    : REQUIRED_JOURNAL_ENTRY_COUNT;

  const preflight = await getMissionSubmissionReadiness({
    tenantId,
    applicantId,
    missionAssignmentId
  });
  if (preflight.submission?.id !== submission.id) {
    throw new Error("Submission does not belong to the current assignment attempt.");
  }
  assertMissionSubmissionReady(preflight);

  const checkedPreflight = await checkMissionSubmissionUrlReachability(
    preflight,
    dependencies.checkEvidenceUrl ?? checkPublicEvidenceUrl
  );
  assertMissionSubmissionReady(checkedPreflight);

  const checkedUrls = {
    repositoryUrl: checkedPreflight.urls.repository.value,
    deploymentUrl: checkedPreflight.urls.deployment.value,
    loomUrl: checkedPreflight.urls.loom.value
  };

  return prisma.$transaction(async (tx) => {
    const current = await getMissionSubmissionReadinessWithClient(
      tx,
      {
        tenantId,
        applicantId,
        missionAssignmentId
      },
      new Date(),
      requiredJournalCount
    );
    assertMissionSubmissionReady(current);
    if (current.submission?.id !== submission.id) {
      throw new Error("Submission does not belong to the current assignment attempt.");
    }
    if (
      current.urls.repository.value !== checkedUrls.repositoryUrl ||
      current.urls.deployment.value !== checkedUrls.deploymentUrl ||
      current.urls.loom.value !== checkedUrls.loomUrl
    ) {
      throw new Error("Submission evidence changed during validation. Please submit again.");
    }

    const assignment = await tx.missionAssignment.findFirst({
      where: { id: missionAssignmentId, tenantId, applicantId }
    });
    if (!assignment) {
      throw new Error("This submission's assignment attempt was not found.");
    }
    if (assignment.status === "FAILED") {
      throw new Error("The deadline and grace period for this mission have passed.");
    }

    // Tasks 1 & 2 (Review Brief, Study Tutorial) must be checked off before Task 3 (this submit
    // action) is allowed — Task 3 itself has no completion row; it's this transition.
    const requiredCompletions = await tx.missionTaskCompletion.findMany({
      where: { missionAssignmentId: assignment.id, taskIndex: { in: [...REQUIRED_TASK_INDEXES] } },
      select: { taskIndex: true }
    });
    const completedTaskIndexes = new Set(requiredCompletions.map((completion) => completion.taskIndex));
    if (!REQUIRED_TASK_INDEXES.every((index) => completedTaskIndexes.has(index))) {
      throw new Error("Complete the mission tasks (Review Brief, Study Tutorial) before submitting for review.");
    }

    const submittedAt = new Date();
    // Deadline timestamps remain authoritative even when the external sweep has not run yet.
    // Trust the clock over the (possibly stale, externally-swept) assignment status — the sweep may
    // not have run yet, so lateness is judged directly against the stored deadline/grace timestamps.
    if (assignment.graceEndsAt && submittedAt.getTime() > assignment.graceEndsAt.getTime()) {
      throw new Error("The deadline and grace period for this mission have passed.");
    }
    const isLate = Boolean(assignment.deadlineAt && submittedAt.getTime() > assignment.deadlineAt.getTime());

    // Status-scoped updateMany prevents concurrent submit attempts from processing twice.
    const update = await tx.submission.updateMany({
      where: {
        id: submission.id,
        tenantId,
        applicantId,
        status: { in: ["DRAFT", "NEEDS_REVISION"] }
      },
      data: { status: "SUBMITTED", submittedAt }
    });
    if (update.count !== 1) {
      throw new Error("This submission was already processed. Refresh the page to see its current status.");
    }

    const assignmentUpdate = await tx.missionAssignment.updateMany({
      where: {
        id: missionAssignmentId,
        tenantId,
        applicantId,
        status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] }
      },
      data: { status: isLate ? "LATE_SUBMITTED" : "PENDING_EVALUATION" }
    });
    if (assignmentUpdate.count !== 1) {
      throw new Error("The assignment attempt is no longer open for submission.");
    }

    await tx.engineeringJournalEntry.updateMany({
      where: {
        tenantId,
        applicantId,
        missionAssignmentId,
        lockedAt: null
      },
      data: { lockedAt: submittedAt }
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId: applicantId,
        action: "submission.submitted",
        entityType: "Submission",
        entityId: submission.id,
        metadata: {
          missionId: submission.missionId,
          missionAssignmentId,
          resubmission: submission.status === "NEEDS_REVISION"
        }
      }
    });

    return tx.submission.findFirstOrThrow({ where: { id: submission.id, tenantId, applicantId } });
  });
}

export type ReviewSubmissionInput = {
  id: string;
  tenantId: string;
  status: Extract<SubmissionStatus, "ACCEPTED" | "NEEDS_REVISION" | "REPEAT">;
  reviewerFeedback: string;
  reviewerUserId: string;
  rating: number | null;
};

const REVIEW_DECISION_BY_STATUS = {
  ACCEPTED: "ACCEPTED",
  NEEDS_REVISION: "CHANGES_REQUESTED",
  REPEAT: "REPEAT"
} as const satisfies Record<ReviewSubmissionInput["status"], ReviewDecision>;

/**
 * How this attempt ended, for evaluation rollups. "First time" is scoped to the attempt: accepted
 * with no change requests. Whether the *week* was repeated is a separate fact, visible from the
 * assignment's attemptNumber -- a week-two repeat that then passes cleanly is ACCEPTED_FIRST_TIME
 * on attempt 2, which is what an evaluator wants to see alongside the earlier REPEATED attempt.
 */
export function deriveReviewOutcome(decision: ReviewDecision, revisionCount: number): ReviewOutcome {
  if (decision === "REPEAT") return "REPEATED";
  if (decision === "CHANGES_REQUESTED") return "CHANGES_REQUESTED";
  return revisionCount === 0 ? "ACCEPTED_FIRST_TIME" : "ACCEPTED_AFTER_CHANGES";
}

/**
 * Review a SUBMITTED attempt: accept it, return the same attempt for revision, or close it as REPEAT
 * and create the next attempt. The review, assignment update and notification share one transaction.
 */
export async function reviewSubmission({
  id,
  tenantId,
  status,
  reviewerFeedback,
  reviewerUserId,
  rating
}: ReviewSubmissionInput) {
  if (status === "ACCEPTED" && (rating === null || !Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Accepted submissions require a whole-number rating from 1 to 5.");
  }
  if (status !== "ACCEPTED" && rating !== null) {
    throw new Error("Only accepted submissions can receive a rating.");
  }

  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findFirst({
      where: { id, tenantId },
      include: {
        mission: { select: { id: true, title: true } },
        missionAssignment: true
      }
    });
    if (!submission) {
      throw new Error("Submission not found for this tenant.");
    }
    // Status-scoped updateMany prevents concurrent review attempts (double-click, two admin tabs)
    // from both winning: the WHERE is re-evaluated at write time, not read time, so only the first
    // one to commit can match status: "SUBMITTED".
    const guard = await tx.submission.updateMany({
      where: { id: submission.id, tenantId, status: "SUBMITTED" },
      data: {
        status,
        reviewerFeedback,
        reviewerUserId,
        rating,
        reviewedAt: new Date()
      }
    });
    if (guard.count !== 1) {
      throw new Error(`Invalid submission status transition from ${submission.status} to ${status}.`);
    }

    if (submission.missionAssignment) {
      // NEEDS_REVISION returns to IN_PROGRESS (not NOT_STARTED/ACCEPTED) since a draft already
      // exists for the applicant to revise.
      const assignmentStatus =
        status === "ACCEPTED" ? "PASSED" : status === "REPEAT" ? "REPEAT" : "IN_PROGRESS";

      // Append the decision to the immutable review history (v0.20.0) before rolling it up. The
      // submission row keeps only the latest feedback, so without this an accepted-first-time pass
      // and one that took two rounds of changes are indistinguishable after the fact.
      const priorReviews = await tx.submissionReview.findMany({
        where: { missionAssignmentId: submission.missionAssignment.id },
        select: { decision: true }
      });
      const decision = REVIEW_DECISION_BY_STATUS[status];
      const revisionCount =
        priorReviews.filter((review) => review.decision === "CHANGES_REQUESTED").length +
        (decision === "CHANGES_REQUESTED" ? 1 : 0);

      await tx.submissionReview.create({
        data: {
          tenantId,
          submissionId: submission.id,
          missionAssignmentId: submission.missionAssignment.id,
          weekNumber: submission.missionAssignment.weekNumber,
          attemptNumber: submission.missionAssignment.attemptNumber,
          round: priorReviews.length + 1,
          decision,
          feedback: reviewerFeedback || null,
          reviewerUserId
        }
      });

      await tx.missionAssignment.updateMany({
        where: {
          id: submission.missionAssignment.id,
          tenantId,
          applicantId: submission.applicantId
        },
        data: {
          status: assignmentStatus,
          reviewOutcome: deriveReviewOutcome(decision, revisionCount),
          revisionCount
        }
      });

      if (status === "REPEAT") {
        await createRepeatMissionForSameWeekTx(tx, submission.missionAssignment);
      } else if (status === "ACCEPTED" && submission.missionAssignment.weekNumber < FINAL_PROGRAM_WEEK) {
        await assignWeekMissionToAcceptedApplicantTx(tx, {
          tenantId,
          programId: submission.missionAssignment.programId,
          applicantId: submission.applicantId,
          weekNumber: submission.missionAssignment.weekNumber + 1
        });
      }
    } else if (status === "REPEAT") {
      throw new Error("A repeat decision requires a linked assignment attempt.");
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId: reviewerUserId,
        action: "submission.reviewed",
        entityType: "Submission",
        entityId: submission.id,
        metadata: {
          missionId: submission.missionId,
          missionAssignmentId: submission.missionAssignmentId,
          status,
          rating
        }
      }
    });

    await tx.notification.create({
      data: {
        tenantId,
        userId: submission.applicantId,
        type: status === "ACCEPTED" ? "SUCCESS" : "WARNING",
        title:
          status === "ACCEPTED"
            ? `Mission accepted: ${submission.mission.title}`
            : status === "REPEAT"
              ? `Week repeat assigned: ${submission.mission.title}`
              : `Revision requested: ${submission.mission.title}`,
        body: reviewerFeedback || undefined
      }
    });

    // Auto-publish: when a submission is accepted, check if the applicant now has
    // 4+ accepted missions with ratings in a single program AND has acknowledged
    // consent. If so, automatically enable their public profile on the portal.
    if (status === "ACCEPTED") {
      const acceptedSubmissions = await tx.submission.findMany({
        where: { applicantId: submission.applicantId, status: "ACCEPTED", rating: { not: null } },
        select: { mission: { select: { programId: true } } }
      });
      const programCounts = new Map<string, number>();
      for (const s of acceptedSubmissions) {
        programCounts.set(s.mission.programId, (programCounts.get(s.mission.programId) ?? 0) + 1);
      }
      const hasEnough = [...programCounts.values()].some((count) => count >= 4);
      if (hasEnough) {
        // Recompute the real snapshot (overallRating = average of accepted week ratings,
        // graduationDate, programId) so a placeholder profile created with overallRating: 0 is
        // never published with a wrong rating. Falls back to a plain publish if the snapshot
        // throws (e.g. fewer than 4 distinct accepted missions in one program).
        let snapshot: { programId: string; graduationDate: Date; overallRating: number } | null = null;
        try {
          const completion = await getCompletionSnapshot(submission.applicantId, tx);
          snapshot = {
            programId: completion.programId,
            graduationDate: completion.graduationDate,
            overallRating: completion.overallRating
          };
        } catch {
          snapshot = null;
        }
        await tx.graduateProfile.updateMany({
          where: { userId: submission.applicantId, consentStatus: "ACKNOWLEDGED", publicProfileEnabled: false },
          data: {
            publicProfileEnabled: true,
            ...(snapshot
              ? { programId: snapshot.programId, graduationDate: snapshot.graduationDate, overallRating: snapshot.overallRating }
              : {})
          }
        });
      }
    }

    return tx.submission.findFirstOrThrow({ where: { id: submission.id, tenantId } });
  });
}

// ---------------------------------------------------------------------------
// Mission progress (v0.16.0, D-069) — the dashboard's source of truth
// ---------------------------------------------------------------------------

export type MissionWeekProgress = {
  weekNumber: number;
  totalMissions: number;
  acceptedMissions: number;
  percentage: number;
};

export type CurrentMission = {
  id: string;
  title: string;
  weekNumber: number;
  /** The applicant's submission status, or null when they have not started a draft. */
  submissionStatus: SubmissionStatus | null;
};

export type MissionProgress = {
  weeks: MissionWeekProgress[];
  overall: { accepted: number; total: number; percentage: number };
  /** First assigned published mission (by week, then order) not yet ACCEPTED — null when all are done. */
  currentMission: CurrentMission | null;
};

/**
 * Per-week and overall mission progress for an applicant in a program. Progress counts an assigned mission
 * as done only when its submission is ACCEPTED (the SEM learning loop's terminal state) — drafts
 * and pending reviews do not move the bar. Weeks 1–4 are always present, mirroring
 * getApplicantProgramProgress in dashboard.ts.
 */
export async function getApplicantMissionProgress(
  tenantId: string,
  applicantId: string,
  programId: string
): Promise<MissionProgress> {
  const assignments = await prisma.missionAssignment.findMany({
    where: { tenantId, programId, applicantId, mission: { status: "PUBLISHED" } },
    include: { mission: { select: { id: true, title: true, weekNumber: true, order: true } } },
    orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
  });
  const latestByWeek = new Map<number, (typeof assignments)[number]>();
  for (const assignment of assignments) {
    if (!latestByWeek.has(assignment.weekNumber)) {
      latestByWeek.set(assignment.weekNumber, assignment);
    }
  }
  const currentAssignments = [...latestByWeek.values()].sort(
    (a, b) =>
      a.mission.weekNumber - b.mission.weekNumber ||
      a.mission.order - b.mission.order ||
      a.mission.title.localeCompare(b.mission.title)
  );
  const missions = currentAssignments
    .map((assignment) => assignment.mission)
    .sort((a, b) => a.weekNumber - b.weekNumber || a.order - b.order || a.title.localeCompare(b.title));
  const submissions = await listApplicantProgramSubmissions(tenantId, applicantId, programId);
  const statusByAssignment = new Map(
    submissions.filter((submission) => submission.missionAssignmentId).map((submission) => [submission.missionAssignmentId, submission.status])
  );
  const legacyStatusByMission = new Map(
    submissions.filter((submission) => !submission.missionAssignmentId).map((submission) => [submission.missionId, submission.status])
  );

  const weekMap = new Map<number, { total: number; accepted: number }>();
  let accepted = 0;
  let currentMission: CurrentMission | null = null;

  for (const assignment of currentAssignments) {
    const mission = assignment.mission;
    const entry = weekMap.get(mission.weekNumber) ?? { total: 0, accepted: 0 };
    entry.total += 1;
    const status = statusByAssignment.get(assignment.id) ?? legacyStatusByMission.get(mission.id) ?? null;
    if (status === "ACCEPTED") {
      entry.accepted += 1;
      accepted += 1;
    } else if (!currentMission) {
      currentMission = {
        id: mission.id,
        title: mission.title,
        weekNumber: mission.weekNumber,
        submissionStatus: status
      };
    }
    weekMap.set(mission.weekNumber, entry);
  }

  const maxWeek = Math.max(4, ...missions.map((m) => m.weekNumber));
  const weeks: MissionWeekProgress[] = [];
  for (let w = 1; w <= maxWeek; w++) {
    const entry = weekMap.get(w) ?? { total: 0, accepted: 0 };
    weeks.push({
      weekNumber: w,
      totalMissions: entry.total,
      acceptedMissions: entry.accepted,
      percentage: entry.total === 0 ? 0 : Math.round((entry.accepted / entry.total) * 100)
    });
  }

  return {
    weeks,
    overall: {
      accepted,
      total: missions.length,
      percentage: missions.length === 0 ? 0 : Math.round((accepted / missions.length) * 100)
    },
    currentMission
  };
}

export type SubmissionReviewHistoryEntry = {
  round: number;
  decision: ReviewDecision;
  feedback: string | null;
  reviewedAt: Date;
  reviewerName: string | null;
};

/**
 * Round-by-round review history for one assignment attempt (v0.20.0), oldest first.
 *
 * The submission row only ever holds the latest decision, so this is the only way the review page
 * can show that an attempt went CHANGES_REQUESTED -> ACCEPTED rather than being accepted outright.
 */
export async function listSubmissionReviewHistory({
  tenantId,
  missionAssignmentId
}: {
  tenantId: string;
  missionAssignmentId: string;
}): Promise<SubmissionReviewHistoryEntry[]> {
  const reviews = await prisma.submissionReview.findMany({
    where: { tenantId, missionAssignmentId },
    select: {
      round: true,
      decision: true,
      feedback: true,
      createdAt: true,
      reviewer: { select: { name: true, email: true } }
    },
    orderBy: { round: "asc" }
  });

  return reviews.map((review) => ({
    round: review.round,
    decision: review.decision,
    feedback: review.feedback,
    reviewedAt: review.createdAt,
    reviewerName: review.reviewer?.name ?? review.reviewer?.email ?? null
  }));
}
