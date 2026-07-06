import { type SubmissionStatus } from "@prisma/client";
import { prisma } from "./client";

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
    where: { missionId, applicantId, tenantId }
  });
}

/** The applicant's submissions across a whole program (drives the mission-list status chips). */
export function listApplicantProgramSubmissions(tenantId: string, applicantId: string, programId: string) {
  return prisma.submission.findMany({
    where: { tenantId, applicantId, mission: { programId } },
    select: { id: true, missionId: true, status: true, submittedAt: true }
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
  journalMarkdown: string | null;
};

/**
 * Create or update the applicant's draft for a mission. The mission must be a PUBLISHED mission of
 * this tenant; evidence is only writable while the submission is editable (DRAFT / NEEDS_REVISION).
 */
export async function saveSubmissionDraft(input: SubmissionEvidenceInput) {
  return prisma.$transaction(async (tx) => {
    const mission = await tx.mission.findFirst({
      where: { id: input.missionId, tenantId: input.tenantId, status: "PUBLISHED" },
      select: { id: true }
    });
    if (!mission) {
      throw new Error("Mission not found for this tenant.");
    }

    const existing = await tx.submission.findFirst({
      where: { missionId: input.missionId, applicantId: input.applicantId, tenantId: input.tenantId },
      select: { id: true, status: true }
    });

    const evidence = {
      repositoryUrl: input.repositoryUrl,
      deploymentUrl: input.deploymentUrl,
      loomUrl: input.loomUrl,
      journalMarkdown: input.journalMarkdown
    };

    if (!existing) {
      const created = await tx.submission.create({
        data: {
          tenantId: input.tenantId,
          missionId: input.missionId,
          applicantId: input.applicantId,
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
          metadata: { missionId: input.missionId }
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
        metadata: { missionId: input.missionId, status: existing.status }
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

    const updated = await tx.submission.update({
      where: { id: submission.id },
      data: { status: "SUBMITTED", submittedAt: new Date() }
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId: applicantId,
        action: "submission.submitted",
        entityType: "Submission",
        entityId: submission.id,
        metadata: { missionId: submission.missionId, resubmission: submission.status === "NEEDS_REVISION" }
      }
    });

    return updated;
  });
}

export type ReviewSubmissionInput = {
  id: string;
  tenantId: string;
  status: Extract<SubmissionStatus, "ACCEPTED" | "NEEDS_REVISION">;
  reviewerFeedback: string;
  reviewerUserId: string;
};

/**
 * Review a SUBMITTED submission: accept it (terminal — graduation/portfolio evidence) or send it
 * back for revision with written feedback (the SEM coaching loop). Notifies the applicant in the
 * same transaction.
 */
export async function reviewSubmission({ id, tenantId, status, reviewerFeedback, reviewerUserId }: ReviewSubmissionInput) {
  return prisma.$transaction(async (tx) => {
    const submission = await tx.submission.findFirst({
      where: { id, tenantId },
      include: { mission: { select: { id: true, title: true } } }
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

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId: reviewerUserId,
        action: "submission.reviewed",
        entityType: "Submission",
        entityId: submission.id,
        metadata: { missionId: submission.missionId, status }
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
            : `Revision requested: ${submission.mission.title}`,
        body: reviewerFeedback || undefined
      }
    });

    return updated;
  });
}
