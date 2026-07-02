import type { ApplicationStatus, Prisma } from "@prisma/client";
import { prisma } from "./client";

export type ApplicationAnswerInput = {
  questionKey: string;
  questionLabel: string;
  answer: string;
};

export const DUPLICATE_APPLICATION_ERROR_MESSAGE = "You already have an active application for this opportunity.";

// Statuses that block another application for the same applicant and program.
export const DUPLICATE_BLOCKING_APPLICATION_STATUSES: ApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "WAITLISTED"
];

export function isDuplicateBlockingApplicationStatus(status: ApplicationStatus): boolean {
  return DUPLICATE_BLOCKING_APPLICATION_STATUSES.includes(status);
}

function duplicateBlockingApplicationWhere(
  applicantId: string,
  programId: string
): Prisma.ApplicationWhereInput {
  return {
    applicantId,
    programId,
    status: { in: DUPLICATE_BLOCKING_APPLICATION_STATUSES }
  };
}

type PrismaKnownErrorShape = {
  code?: unknown;
  meta?: {
    target?: unknown;
  };
};

function isDuplicateApplicationUniqueError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const knownError = error as PrismaKnownErrorShape;
  if (knownError.code !== "P2002") {
    return false;
  }
  const target = knownError.meta?.target;
  if (Array.isArray(target)) {
    return target.includes("applicantId") && target.includes("programId");
  }
  return typeof target === "string" && target.includes("applicantId") && target.includes("programId");
}

/** An applicant's duplicate-blocking application for a program, if any. */
export function findActiveApplication(applicantId: string, programId: string) {
  return prisma.application.findFirst({
    where: duplicateBlockingApplicationWhere(applicantId, programId)
  });
}

export type CreateSubmittedApplicationInput = {
  tenantId: string;
  programId: string;
  applicantId: string;
  answers: ApplicationAnswerInput[];
  cvFileId?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
};

/** Create a SUBMITTED application with its answers and an audit entry, atomically. */
export function createSubmittedApplication({
  tenantId,
  programId,
  applicantId,
  answers,
  cvFileId = null,
  githubUrl = null,
  linkedinUrl = null
}: CreateSubmittedApplicationInput) {
  return prisma
    .$transaction(async (tx) => {
      const existing = await tx.application.findFirst({
        where: duplicateBlockingApplicationWhere(applicantId, programId)
      });
      if (existing) {
        throw new Error(DUPLICATE_APPLICATION_ERROR_MESSAGE);
      }

      const application = await tx.application.create({
        data: {
          tenantId,
          programId,
          applicantId,
          status: "SUBMITTED",
          submittedAt: new Date(),
          cvFileId,
          githubUrl,
          linkedinUrl,
          answers: {
            create: answers.map((a) => ({
              questionKey: a.questionKey,
              questionLabel: a.questionLabel,
              answer: a.answer
            }))
          }
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorUserId: applicantId,
          action: "application.submitted",
          entityType: "Application",
          entityId: application.id,
          metadata: { programId, status: "SUBMITTED" }
        }
      });

      return application;
    })
    .catch((error: unknown) => {
      if (isDuplicateApplicationUniqueError(error)) {
        throw new Error(DUPLICATE_APPLICATION_ERROR_MESSAGE);
      }
      throw error;
    });
}

export type ApplicationDuplicatePolicyCase = {
  previousStatus: ApplicationStatus | null;
  canApply: boolean;
};

export const APPLICATION_DUPLICATE_POLICY_CASES: ApplicationDuplicatePolicyCase[] = [
  { previousStatus: null, canApply: true },
  { previousStatus: "DRAFT", canApply: false },
  { previousStatus: "SUBMITTED", canApply: false },
  { previousStatus: "UNDER_REVIEW", canApply: false },
  { previousStatus: "ACCEPTED", canApply: false },
  { previousStatus: "REJECTED", canApply: true },
  { previousStatus: "WAITLISTED", canApply: false }
];

export function canApplyAfterPreviousApplicationStatus(status: ApplicationStatus | null): boolean {
  return status === null || !isDuplicateBlockingApplicationStatus(status);
}

/** All applications for a tenant, with applicant and program, newest first (admin list). */
export function listTenantApplications(tenantId: string) {
  return prisma.application.findMany({
    where: { tenantId },
    include: { applicant: true, program: true },
    orderBy: { createdAt: "desc" }
  });
}

/** A single tenant-scoped application with applicant, program and answers (admin detail). */
export function getTenantApplication(id: string, tenantId: string) {
  return prisma.application.findFirst({
    where: { id, tenantId },
    include: { applicant: true, program: true, cvFile: true, answers: { orderBy: { createdAt: "asc" } } }
  });
}

/** The signed-in applicant's applications for a tenant (applicant status view). */
export function listApplicantApplications(applicantId: string, tenantId: string) {
  return prisma.application.findMany({
    where: { applicantId, tenantId },
    include: { program: true, cvFile: true, answers: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
}

export type ApplyStatusTransitionInput = {
  id: string;
  toStatus: ApplicationStatus;
  reviewerNotes?: string | null;
  actorUserId: string | null;
  tenantId: string;
};

/** Persist a reviewed status change with reviewer notes and an audit entry, atomically. */
export function applyStatusTransition({
  id,
  toStatus,
  reviewerNotes,
  actorUserId,
  tenantId
}: ApplyStatusTransitionInput) {
  return prisma.$transaction(async (tx) => {
    // Scope the write by tenant so a raw id can never cross tenants (defense-in-depth for D-051).
    const result = await tx.application.updateMany({
      where: { id, tenantId },
      data: {
        status: toStatus,
        reviewedAt: new Date(),
        ...(reviewerNotes !== undefined ? { reviewerNotes } : {})
      }
    });
    if (result.count === 0) {
      throw new Error("Application not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "application.status_changed",
        entityType: "Application",
        entityId: id,
        metadata: { status: toStatus }
      }
    });

    return tx.application.findFirstOrThrow({ where: { id, tenantId } });
  });
}
