import { type SubmissionStatus } from "@prisma/client";
import { prisma } from "./client";
import {
  createRepeatMissionAssignmentTx,
  getActiveMissionAssignmentForMissionTx
} from "./mission-assignments";

// Mission-submission workflow helpers (v0.15.0, D-067). All reads/writes are tenant-scoped via the
// Submission.tenantId column; writes additionally verify the mission chain and the applicant owner.
// Status-machine enforcement lives in @talentos/auth (assertSubmissionStatusTransition) and is
// applied by the server actions; these helpers add structural guards (status-scoped updateMany) as
// defense in depth.

/** Evidence-URL kinds and their allowed hosts. Deployment URLs may live anywhere (any http/https). */
const EVIDENCE_HOST_SUFFIX: Record<"repository" | "loom", string> = {
  repository: "github.com",
  loom: "loom.com"
};

/**
 * Validate an optional evidence URL (empty → null). Repository and Loom links are host-allowlisted
 * (mirrors the apply flow's profile-link rule) so stored links can't be used for phishing;
 * deployment links only need to be well-formed http(s).
 */
export function parseEvidenceUrl(raw: string, kind: "repository" | "deployment" | "loom"): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Enter a valid ${kind} URL (including https://).`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`Enter a valid ${kind} URL (including https://).`);
  }
  if (kind === "deployment") {
    return url.toString();
  }
  const host = url.hostname.toLowerCase();
  const suffix = EVIDENCE_HOST_SUFFIX[kind];
  if (host !== suffix && !host.endsWith(`.${suffix}`)) {
    throw new Error(`The ${kind} URL must be on ${suffix}.`);
  }
  return url.toString();
}

/** The applicant's own submission for a mission (or null before their first draft). */
export function getApplicantSubmission(missionId: string, applicantId: string, tenantId: string) {
  return prisma.submission.findFirst({
    where: { missionId, applicantId, tenantId },
    orderBy: { createdAt: "desc" }
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
      deploymentUrl: input.deploymentUrl,
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

/**
 * Move the applicant's own DRAFT / NEEDS_REVISION submission to SUBMITTED. Requires at least one
 * evidence URL so reviewers always have something to open.
 */
export async function submitSubmission({ id, tenantId, applicantId }: SubmitSubmissionInput) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findFirst({
      where: { id, tenantId, applicantId }
    });
    if (!submission) {
      throw new Error("Submission not found for this tenant.");
    }
    if (submission.status !== "DRAFT" && submission.status !== "NEEDS_REVISION") {
      throw new Error(`Invalid submission status transition from ${submission.status} to SUBMITTED.`);
    }
    if (!submission.repositoryUrl && !submission.deploymentUrl && !submission.loomUrl) {
      throw new Error("Add at least one evidence link (repository, deployment or Loom) before submitting.");
    }
    if (!submission.missionAssignmentId) {
      throw new Error("This submission is not linked to an assignment attempt.");
    }

    const submittedAt = new Date();
    const updated = await tx.submission.update({
      where: { id: submission.id },
      data: { status: "SUBMITTED", submittedAt }
    });

    await tx.engineeringJournalEntry.updateMany({
      where: {
        tenantId,
        applicantId,
        missionAssignmentId: submission.missionAssignmentId,
        lockedAt: null
      },
      data: { lockedAt: submittedAt }
    });
    await tx.missionAssignment.updateMany({
      where: {
        id: submission.missionAssignmentId,
        tenantId,
        applicantId,
        status: "ACTIVE"
      },
      data: { status: "SUBMITTED" }
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
          missionAssignmentId: submission.missionAssignmentId,
          resubmission: submission.status === "NEEDS_REVISION"
        }
      }
    });

    return updated;
  });
}

export type ReviewSubmissionInput = {
  id: string;
  tenantId: string;
  status: Extract<SubmissionStatus, "ACCEPTED" | "NEEDS_REVISION" | "REPEAT">;
  reviewerFeedback: string;
  reviewerUserId: string;
};

/**
 * Review a SUBMITTED attempt: accept it, return the same attempt for revision, or close it as REPEAT
 * and create the next attempt. The review, assignment update and notification share one transaction.
 */
export async function reviewSubmission({ id, tenantId, status, reviewerFeedback, reviewerUserId }: ReviewSubmissionInput) {
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
    if (submission.status !== "SUBMITTED") {
      throw new Error(`Invalid submission status transition from ${submission.status} to ${status}.`);
    }

    const updated = await tx.submission.update({
      where: { id: submission.id },
      data: {
        status,
        reviewerFeedback,
        reviewerUserId,
        reviewedAt: new Date()
      }
    });

    if (submission.missionAssignment) {
      const assignmentStatus =
        status === "ACCEPTED" ? "PASSED" : status === "REPEAT" ? "REPEAT" : "ACTIVE";
      await tx.missionAssignment.updateMany({
        where: {
          id: submission.missionAssignment.id,
          tenantId,
          applicantId: submission.applicantId
        },
        data: { status: assignmentStatus }
      });

      if (status === "REPEAT") {
        await createRepeatMissionAssignmentTx(tx, submission.missionAssignment);
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
          status
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

    return updated;
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
