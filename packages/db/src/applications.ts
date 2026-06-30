import type { ApplicationStatus } from "@prisma/client";
import { prisma } from "./client";

export type ApplicationAnswerInput = {
  questionKey: string;
  questionLabel: string;
  answer: string;
};

// Statuses that represent an in-flight application (used to block duplicate submissions per program).
const ACTIVE_STATUSES: ApplicationStatus[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "WAITLISTED"];

/** An applicant's existing in-flight application for a program, if any. */
export function findActiveApplication(applicantId: string, programId: string) {
  return prisma.application.findFirst({
    where: { applicantId, programId, status: { in: ACTIVE_STATUSES } }
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
  return prisma.$transaction(async (tx) => {
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
  });
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
    const application = await tx.application.update({
      where: { id },
      data: {
        status: toStatus,
        reviewedAt: new Date(),
        ...(reviewerNotes !== undefined ? { reviewerNotes } : {})
      }
    });

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

    return application;
  });
}
