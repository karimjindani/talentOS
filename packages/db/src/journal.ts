import { Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "./client";
import { getActiveMissionAssignmentForMissionTx } from "./mission-assignments";

const MAX_LANGUAGE_LENGTH = 64;
const MAX_EVIDENCE_LINKS = 10;
const JOURNAL_LOCKED_AFTER_SUBMISSION_MESSAGE =
  "This journal entry is locked because it was submitted for review.";
const SUBMITTED_SUBMISSION_STATUSES: SubmissionStatus[] = [
  SubmissionStatus.SUBMITTED,
  SubmissionStatus.REVIEWED,
  SubmissionStatus.NEEDS_REVISION,
  SubmissionStatus.ACCEPTED,
  SubmissionStatus.REPEAT
];
const CREATE_DUPLICATE_ENTRY_DATE_MESSAGE =
  "You already have a journal entry for this date. Please edit the existing entry instead.";
const UPDATE_DUPLICATE_ENTRY_DATE_MESSAGE =
  "You already have a journal entry for this date. Please choose another date or edit the existing entry.";

export class JournalEntryDateConflictError extends Error {
  constructor(
    message: string,
    public readonly existingEntryId: string | null = null
  ) {
    super(message);
    this.name = "JournalEntryDateConflictError";
  }
}

export type JournalCreateAvailability = {
  canCreate: boolean;
  lastCreatedAt: Date | null;
  nextAllowedAt: Date | null;
};

export type JournalEntryContentInput = {
  missionId: string;
  entryDate: Date;
  language: string;
  workedOn: string;
  challenge: string;
  solution: string;
  learned: string;
  aiUsage: string;
  confidenceRating: number;
  timeSpentHours: number;
  evidenceLinks: string[];
};

export type CreateJournalEntryInput = JournalEntryContentInput & {
  tenantId: string;
  applicantId: string;
};

export type UpdateJournalEntryInput = CreateJournalEntryInput & {
  id: string;
};

export function normalizeJournalLanguage(value: string): string {
  const language = value.trim();
  if (!language) {
    return "English";
  }
  if (language.length > MAX_LANGUAGE_LENGTH) {
    throw new Error(`Preferred journal language must be ${MAX_LANGUAGE_LENGTH} characters or fewer.`);
  }
  return language;
}

export function parseJournalEvidenceLinks(raw: string): string[] {
  const values = raw
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  return validateEvidenceLinks(values);
}

export function validateConfidenceRating(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new Error("Confidence rating must be a whole number from 1 to 5.");
  }
  return value;
}

export function validateTimeSpentHours(value: number): number {
  if (!Number.isFinite(value) || value <= 0 || value > 24) {
    throw new Error("Time spent must be greater than 0 and no more than 24 hours.");
  }
  return value;
}

export function listApplicantJournalEntries(tenantId: string, applicantId: string, programId: string) {
  return prisma.engineeringJournalEntry.findMany({
    where: { tenantId, applicantId, programId },
    include: { mission: { select: { id: true, title: true, weekNumber: true } } },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }]
  });
}

export type SubmissionReviewJournalEntriesInput = {
  tenantId: string;
  applicantId: string;
  missionId: string;
  missionAssignmentId: string | null;
};

/** Read-only journal context for staff reviewing one applicant's submission for one mission. */
export function listEngineeringJournalEntriesForSubmissionReview({
  tenantId,
  applicantId,
  missionId,
  missionAssignmentId
}: SubmissionReviewJournalEntriesInput) {
  return prisma.engineeringJournalEntry.findMany({
    where: { tenantId, applicantId, missionId, missionAssignmentId },
    select: {
      id: true,
      entryDate: true,
      weekNumber: true,
      language: true,
      workedOn: true,
      challenge: true,
      solution: true,
      learned: true,
      aiUsage: true,
      confidenceRating: true,
      timeSpentHours: true,
      evidenceLinks: true
    },
    orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }]
  });
}

export function getApplicantJournalEntry(id: string, tenantId: string, applicantId: string) {
  return prisma.engineeringJournalEntry.findFirst({
    where: { id, tenantId, applicantId },
    include: { mission: { select: { id: true, title: true, weekNumber: true } }, program: true }
  });
}

export async function isJournalMissionLockedForApplicant(tenantId: string, applicantId: string, missionId: string) {
  const assignment = await prisma.missionAssignment.findFirst({
    where: { tenantId, applicantId, missionId },
    select: { status: true },
    orderBy: { attemptNumber: "desc" }
  });
  if (assignment) {
    return assignment.status !== "ACTIVE";
  }

  const legacySubmission = await prisma.submission.findFirst({
    where: { ...submittedSubmissionWhere(tenantId, applicantId, missionId), missionAssignmentId: null },
    select: { id: true }
  });
  return Boolean(legacySubmission);
}

export async function getJournalCreateAvailability(
  tenantId: string,
  applicantId: string,
  now = new Date()
): Promise<JournalCreateAvailability> {
  const latest = await prisma.engineeringJournalEntry.findFirst({
    where: { tenantId, applicantId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" }
  });

  return getJournalCreateAvailabilityFromLatest(latest?.createdAt ?? null, now);
}

export async function createJournalEntry(input: CreateJournalEntryInput) {
  const content = normalizeJournalEntryContent(input);

  try {
    return await prisma.$transaction(async (tx) => {
      const assignment = await assertActiveAssignmentForAcceptedProgram(tx, {
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        missionId: input.missionId
      });

      await assertEntryDateAvailable(tx, {
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        entryDate: content.entryDate,
        message: CREATE_DUPLICATE_ENTRY_DATE_MESSAGE
      });

      const entry = await tx.engineeringJournalEntry.create({
        data: {
          tenantId: input.tenantId,
          applicantId: input.applicantId,
          programId: assignment.programId,
          missionId: assignment.missionId,
          missionAssignmentId: assignment.id,
          weekNumber: assignment.weekNumber,
          ...content
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.applicantId,
          action: "journal.created",
          entityType: "EngineeringJournalEntry",
          entityId: entry.id,
          metadata: {
            missionId: assignment.missionId,
            missionAssignmentId: assignment.id,
            programId: assignment.programId,
            weekNumber: assignment.weekNumber,
            attemptNumber: assignment.attemptNumber
          }
        }
      });

      return entry;
    });
  } catch (error) {
    throwDuplicateEntryDateError(error, CREATE_DUPLICATE_ENTRY_DATE_MESSAGE);
    throw error;
  }
}

export async function updateJournalEntry(input: UpdateJournalEntryInput) {
  const content = normalizeJournalEntryContent(input);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.engineeringJournalEntry.findFirst({
      where: { id: input.id, tenantId: input.tenantId, applicantId: input.applicantId },
      select: { id: true, missionId: true, missionAssignmentId: true, lockedAt: true }
    });
    if (!existing) {
      throw new Error("Journal entry not found for this applicant.");
    }
    if (existing.lockedAt) {
      throw new Error(JOURNAL_LOCKED_AFTER_SUBMISSION_MESSAGE);
    }
    if (!existing.missionAssignmentId) {
      await assertLegacyJournalMissionNotLocked(tx, {
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        missionId: existing.missionId
      });
    }

    const assignment = await assertActiveAssignmentForAcceptedProgram(tx, {
      tenantId: input.tenantId,
      applicantId: input.applicantId,
      missionId: input.missionId
    });
    if (existing.missionAssignmentId && existing.missionAssignmentId !== assignment.id) {
      throw new Error("A saved journal entry cannot be moved to another assignment attempt.");
    }

    try {
      await assertEntryDateAvailable(tx, {
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        entryDate: content.entryDate,
        excludingEntryId: input.id,
        message: UPDATE_DUPLICATE_ENTRY_DATE_MESSAGE
      });

      const result = await tx.engineeringJournalEntry.updateMany({
        where: { id: input.id, tenantId: input.tenantId, applicantId: input.applicantId },
        data: {
          programId: assignment.programId,
          missionId: assignment.missionId,
          missionAssignmentId: assignment.id,
          weekNumber: assignment.weekNumber,
          ...content
        }
      });
      if (result.count === 0) {
        throw new Error("Journal entry not found for this applicant.");
      }

      await tx.auditLog.create({
        data: {
          tenantId: input.tenantId,
          actorUserId: input.applicantId,
          action: "journal.updated",
          entityType: "EngineeringJournalEntry",
          entityId: input.id,
          metadata: {
            missionId: assignment.missionId,
            missionAssignmentId: assignment.id,
            programId: assignment.programId,
            weekNumber: assignment.weekNumber,
            attemptNumber: assignment.attemptNumber
          }
        }
      });

      return tx.engineeringJournalEntry.findFirstOrThrow({
        where: { id: input.id, tenantId: input.tenantId, applicantId: input.applicantId }
      });
    } catch (error) {
      throwDuplicateEntryDateError(error, UPDATE_DUPLICATE_ENTRY_DATE_MESSAGE);
      throw error;
    }
  });
}

export function updatePreferredJournalLanguage(userId: string, language: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { preferredJournalLanguage: normalizeJournalLanguage(language) }
  });
}

export function getJournalCreateAvailabilityFromLatest(
  lastCreatedAt: Date | null,
  _now = new Date()
): JournalCreateAvailability {
  return {
    canCreate: true,
    lastCreatedAt,
    nextAllowedAt: null
  };
}

function normalizeJournalEntryContent(input: JournalEntryContentInput) {
  return {
    entryDate: normalizeEntryDate(input.entryDate),
    language: normalizeJournalLanguage(input.language),
    workedOn: requiredText(input.workedOn, "What you worked on today"),
    challenge: requiredText(input.challenge, "Challenge faced"),
    solution: requiredText(input.solution, "How you solved it"),
    learned: requiredText(input.learned, "What you learned"),
    aiUsage: requiredText(input.aiUsage, "AI usage"),
    confidenceRating: validateConfidenceRating(input.confidenceRating),
    timeSpentHours: validateTimeSpentHours(input.timeSpentHours),
    evidenceLinks: validateEvidenceLinks(input.evidenceLinks)
  };
}

function normalizeEntryDate(value: Date): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("Entry date is required.");
  }
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function requiredText(value: string, label: string): string {
  const text = value.trim();
  if (!text) {
    throw new Error(`${label} is required.`);
  }
  return text;
}

function validateEvidenceLinks(links: string[]): string[] {
  if (links.length > MAX_EVIDENCE_LINKS) {
    throw new Error(`Add ${MAX_EVIDENCE_LINKS} evidence links or fewer.`);
  }

  const normalized: string[] = [];
  for (const link of links) {
    let url: URL;
    try {
      url = new URL(link);
    } catch {
      throw new Error("Evidence links must be valid URLs including https:// or http://.");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("Evidence links must be valid URLs including https:// or http://.");
    }
    normalized.push(url.toString());
  }

  return [...new Set(normalized)];
}

async function assertActiveAssignmentForAcceptedProgram(
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
  const assignment = await getActiveMissionAssignmentForMissionTx(tx, {
    tenantId,
    applicantId,
    missionId
  });
  if (!assignment) {
    const latestAssignment = await tx.missionAssignment.findFirst({
      where: { tenantId, applicantId, missionId },
      select: { status: true },
      orderBy: { attemptNumber: "desc" }
    });
    if (latestAssignment && latestAssignment.status !== "ACTIVE") {
      throw new Error(JOURNAL_LOCKED_AFTER_SUBMISSION_MESSAGE);
    }
    throw new Error("Mission is not assigned to this applicant.");
  }

  const acceptedApplication = await tx.application.findFirst({
    where: { tenantId, applicantId, programId: assignment.programId, status: "ACCEPTED" },
    select: { id: true }
  });
  if (!acceptedApplication) {
    throw new Error("Journal entries can only be linked to missions in your accepted program.");
  }

  return assignment;
}

async function assertEntryDateAvailable(
  tx: Prisma.TransactionClient,
  {
    tenantId,
    applicantId,
    entryDate,
    excludingEntryId,
    message
  }: {
    tenantId: string;
    applicantId: string;
    entryDate: Date;
    excludingEntryId?: string;
    message: string;
  }
) {
  const duplicate = await tx.engineeringJournalEntry.findFirst({
    where: {
      tenantId,
      applicantId,
      entryDate,
      ...(excludingEntryId ? { id: { not: excludingEntryId } } : {})
    },
    select: { id: true }
  });

  if (duplicate) {
    throw new JournalEntryDateConflictError(message, duplicate.id);
  }
}

async function assertLegacyJournalMissionNotLocked(
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
  const submittedSubmission = await tx.submission.findFirst({
    where: { ...submittedSubmissionWhere(tenantId, applicantId, missionId), missionAssignmentId: null },
    select: { id: true }
  });
  if (submittedSubmission) {
    throw new Error(JOURNAL_LOCKED_AFTER_SUBMISSION_MESSAGE);
  }
}

function submittedSubmissionWhere(tenantId: string, applicantId: string, missionId: string) {
  return {
    tenantId,
    applicantId,
    missionId,
    OR: [
      { submittedAt: { not: null } },
      { status: { in: SUBMITTED_SUBMISSION_STATUSES } }
    ]
  };
}

function throwDuplicateEntryDateError(error: unknown, message: string): void {
  if (error instanceof JournalEntryDateConflictError) {
    throw error;
  }

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return;
  }

  const target = error.meta?.target;
  if (
    error.code === "P2002" &&
    Array.isArray(target) &&
    ["tenantId", "applicantId", "entryDate"].every((field) => target.includes(field))
  ) {
    throw new JournalEntryDateConflictError(message);
  }
}
