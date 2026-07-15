import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  entryFindMany: vi.fn(),
  entryFindFirst: vi.fn(),
  missionAssignmentFindFirst: vi.fn(),
  missionAssignmentFindMany: vi.fn(),
  submissionFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
  txMissionFindFirst: vi.fn(),
  txMissionAssignmentFindFirst: vi.fn(),
  txApplicationFindFirst: vi.fn(),
  txSubmissionFindFirst: vi.fn(),
  txEntryFindFirst: vi.fn(),
  txEntryCreate: vi.fn(),
  txEntryUpdateMany: vi.fn(),
  txEntryFindFirstOrThrow: vi.fn(),
  txAuditLogCreate: vi.fn(),
  txQueryRaw: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    engineeringJournalEntry: {
      findMany: prismaMock.entryFindMany,
      findFirst: prismaMock.entryFindFirst
    },
    submission: {
      findFirst: prismaMock.submissionFindFirst
    },
    missionAssignment: {
      findFirst: prismaMock.missionAssignmentFindFirst,
      findMany: prismaMock.missionAssignmentFindMany
    },
    user: {
      update: prismaMock.userUpdate
    },
    $transaction: prismaMock.transaction
  }
}));

import {
  createJournalEntry,
  getApplicantJournalEntry,
  getJournalCreateAvailability,
  getJournalCreateAvailabilityFromLatest,
  JournalEntryDateConflictError,
  listApplicantJournalEntries,
  listEngineeringJournalEntriesForSubmissionReview,
  listPreviousMissionAttemptHistoryForSubmissionReview,
  normalizeJournalEntryDate,
  parseJournalEvidenceLinks,
  updateJournalEntry,
  updatePreferredJournalLanguage,
  validateConfidenceRating,
  validateTimeSpentHours
} from "./journal";

type CurrentAssignmentScope = {
  tenantId: string;
  programId: string;
  applicantId: string;
  weekNumber: number;
  attemptNumber: number;
};

function currentAssignment(overrides: Partial<CurrentAssignmentScope> = {}): CurrentAssignmentScope {
  return {
    tenantId: "tenant-1",
    programId: "program-1",
    applicantId: "user-1",
    weekNumber: 1,
    attemptNumber: 2,
    ...overrides
  };
}

function reviewJournal(id: string, missionAssignmentId: string | null) {
  return {
    id,
    missionAssignmentId,
    entryDate: new Date("2026-07-01T00:00:00.000Z"),
    weekNumber: 1,
    language: "English",
    workedOn: `Work for ${id}`,
    challenge: "Challenge",
    solution: "Solution",
    learned: "Learning",
    aiUsage: "None",
    confidenceRating: 4,
    timeSpentHours: 2,
    evidenceLinks: [`https://example.com/${id}`]
  };
}

function previousAttempt(
  attemptNumber: number,
  options: {
    id?: string;
    missionId?: string;
    missionTitle?: string;
    journalEntries?: ReturnType<typeof reviewJournal>[];
    submissions?: Array<{
      id: string;
      missionAssignmentId: string | null;
      status: "REPEAT" | "ACCEPTED" | "NEEDS_REVISION";
      submittedAt: Date | null;
      reviewedAt: Date | null;
      reviewerFeedback: string | null;
    }>;
  } = {}
) {
  const id = options.id ?? `assignment-${attemptNumber}`;
  return {
    id,
    attemptNumber,
    status: "REPEAT" as const,
    weekNumber: 1,
    mission: {
      id: options.missionId ?? `mission-${attemptNumber}`,
      title: options.missionTitle ?? `Mission ${attemptNumber}`
    },
    submissions:
      options.submissions ??
      [
        {
          id: `submission-${attemptNumber}`,
          missionAssignmentId: id,
          status: "REPEAT" as const,
          submittedAt: new Date(`2026-07-0${attemptNumber}T10:00:00.000Z`),
          reviewedAt: new Date(`2026-07-0${attemptNumber}T12:00:00.000Z`),
          reviewerFeedback: `Feedback ${attemptNumber}`
        }
      ],
    journalEntries: options.journalEntries ?? [reviewJournal(`journal-${attemptNumber}`, id)]
  };
}

describe("engineering journal data access", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        mission: { findFirst: prismaMock.txMissionFindFirst },
        missionAssignment: { findFirst: prismaMock.txMissionAssignmentFindFirst },
        application: { findFirst: prismaMock.txApplicationFindFirst },
        submission: { findFirst: prismaMock.txSubmissionFindFirst },
        engineeringJournalEntry: {
          findFirst: prismaMock.txEntryFindFirst,
          create: prismaMock.txEntryCreate,
          updateMany: prismaMock.txEntryUpdateMany,
          findFirstOrThrow: prismaMock.txEntryFindFirstOrThrow
        },
        auditLog: { create: prismaMock.txAuditLogCreate },
        $queryRaw: prismaMock.txQueryRaw
      })
    );
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "user-1",
      missionId: "mission-1",
      weekNumber: 2,
      attemptNumber: 1,
      status: "ACTIVE",
      mission: { id: "mission-1", programId: "program-1", weekNumber: 2 }
    });
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "app-1" });
    prismaMock.txSubmissionFindFirst.mockResolvedValue(null);
    prismaMock.txEntryCreate.mockResolvedValue({ id: "journal-1" });
    prismaMock.txEntryFindFirst.mockImplementation(async ({ where }) =>
      where?.id === "journal-1"
        ? {
            id: "journal-1",
            missionId: "mission-1",
            missionAssignmentId: "assignment-1",
            lockedAt: null
          }
        : null
    );
    prismaMock.txEntryUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txEntryFindFirstOrThrow.mockResolvedValue({ id: "journal-1" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
    prismaMock.txQueryRaw.mockResolvedValue([{ id: "user-1" }]);
  });

  it("lists the signed-in applicant's journal entries tenant/program scoped", async () => {
    await listApplicantJournalEntries("tenant-1", "user-1", "program-1");

    expect(prismaMock.entryFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", applicantId: "user-1", programId: "program-1" },
      include: { mission: { select: { id: true, title: true, weekNumber: true } } },
      orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }]
    });
  });

  it("tenant-scopes journal entries used for submission review", async () => {
    await listEngineeringJournalEntriesForSubmissionReview({
      tenantId: "tenant-1",
      applicantId: "user-1",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1"
    });

    expect(prismaMock.entryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          applicantId: "user-1",
          missionId: "mission-1",
          missionAssignmentId: "assignment-1"
        }
      })
    );
  });

  it("does not query another applicant's entries for submission review", async () => {
    await listEngineeringJournalEntriesForSubmissionReview({
      tenantId: "tenant-1",
      applicantId: "applicant-under-review",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1"
    });

    expect(prismaMock.entryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          applicantId: "applicant-under-review",
          missionId: "mission-1",
          missionAssignmentId: "assignment-1"
        }
      })
    );
  });

  it("does not query another mission's entries for submission review", async () => {
    await listEngineeringJournalEntriesForSubmissionReview({
      tenantId: "tenant-1",
      applicantId: "user-1",
      missionId: "mission-under-review",
      missionAssignmentId: "assignment-1"
    });

    expect(prismaMock.entryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          applicantId: "user-1",
          missionId: "mission-under-review",
          missionAssignmentId: "assignment-1"
        }
      })
    );
  });

  it("returns only read-only journal fields in chronological order for submission review", async () => {
    await listEngineeringJournalEntriesForSubmissionReview({
      tenantId: "tenant-1",
      applicantId: "user-1",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1"
    });

    expect(prismaMock.entryFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        missionId: "mission-1",
        missionAssignmentId: "assignment-1"
      },
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
  });

  describe("previous mission-attempt history for submission review", () => {
    beforeEach(() => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(currentAssignment());
      prismaMock.missionAssignmentFindMany.mockResolvedValue([]);
    });

    it("returns no previous-attempt history for Attempt 1", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(currentAssignment({ attemptNumber: 1 }));

      await expect(
        listPreviousMissionAttemptHistoryForSubmissionReview({
          tenantId: "tenant-1",
          missionAssignmentId: "assignment-current"
        })
      ).resolves.toEqual([]);
      expect(prismaMock.missionAssignmentFindMany).not.toHaveBeenCalled();
    });

    it("returns only Attempt 1 while reviewing Attempt 2", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([previousAttempt(1)]);

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(history.map((attempt) => attempt.attemptNumber)).toEqual([1]);
    });

    it("returns Attempts 2 and 1 newest-first while reviewing Attempt 3", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(currentAssignment({ attemptNumber: 3 }));
      prismaMock.missionAssignmentFindMany.mockResolvedValue([previousAttempt(2), previousAttempt(1)]);

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(history.map((attempt) => attempt.attemptNumber)).toEqual([2, 1]);
      expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { attemptNumber: "desc" } })
      );
    });

    it("excludes the current attempt with a strict lower-attempt query", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(currentAssignment({ attemptNumber: 3 }));

      await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ attemptNumber: { lt: 3 } })
        })
      );
    });

    it("excludes future attempts with the same strict lower-attempt query", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(currentAssignment({ attemptNumber: 2 }));

      await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ attemptNumber: { lt: 2 } })
        })
      );
    });

    it("excludes previous attempts from another tenant", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(currentAssignment({ tenantId: "tenant-reviewed" }));

      await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-reviewed",
        missionAssignmentId: "assignment-current"
      });

      expect(prismaMock.missionAssignmentFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "assignment-current", tenantId: "tenant-reviewed" } })
      );
      expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ tenantId: "tenant-reviewed" }) })
      );
    });

    it("excludes previous attempts from another applicant", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(
        currentAssignment({ applicantId: "applicant-reviewed" })
      );

      await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ applicantId: "applicant-reviewed" })
        })
      );
    });

    it("excludes previous attempts from another program", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(
        currentAssignment({ programId: "program-reviewed" })
      );

      await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ programId: "program-reviewed" }) })
      );
    });

    it("excludes previous attempts from another week", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(currentAssignment({ weekNumber: 4 }));

      await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ weekNumber: 4 }) })
      );
    });

    it("includes a previous attempt with a different mission in the same program and week", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([
        previousAttempt(1, {
          missionId: "different-mission",
          missionTitle: "A different repeated-week mission"
        })
      ]);

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(history[0]?.mission).toEqual({
        id: "different-mission",
        title: "A different repeated-week mission"
      });
      const query = prismaMock.missionAssignmentFindMany.mock.calls[0]?.[0];
      expect(query.where).not.toHaveProperty("missionId");
    });

    it("loads each previous attempt's journals through its exact assignment relation", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([previousAttempt(1)]);

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      const query = prismaMock.missionAssignmentFindMany.mock.calls[0]?.[0];
      expect(query.select.journalEntries).toEqual(
        expect.objectContaining({
          where: {
            tenantId: "tenant-1",
            applicantId: "user-1",
            missionAssignmentId: { not: null }
          },
          orderBy: [{ entryDate: "asc" }, { createdAt: "asc" }]
        })
      );
      expect(history[0]?.journalEntries.map((entry) => entry.id)).toEqual(["journal-1"]);
    });

    it("does not mix a journal linked to another assignment into a previous attempt", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([
        previousAttempt(1, {
          journalEntries: [
            reviewJournal("journal-exact", "assignment-1"),
            reviewJournal("journal-other-attempt", "assignment-2")
          ]
        })
      ]);

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(history[0]?.journalEntries.map((entry) => entry.id)).toEqual(["journal-exact"]);
    });

    it("does not include unlinked legacy journals in previous-attempt history", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([
        previousAttempt(1, {
          journalEntries: [
            reviewJournal("journal-exact", "assignment-1"),
            reviewJournal("journal-legacy", null)
          ]
        })
      ]);

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });

      expect(history[0]?.journalEntries.map((entry) => entry.id)).toEqual(["journal-exact"]);
    });

    it("returns only the read-only assignment, submission, mission, and journal review fields", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([previousAttempt(1)]);

      const history = await listPreviousMissionAttemptHistoryForSubmissionReview({
        tenantId: "tenant-1",
        missionAssignmentId: "assignment-current"
      });
      const attempt = history[0];

      expect(Object.keys(attempt ?? {}).sort()).toEqual([
        "assignmentStatus",
        "attemptNumber",
        "journalEntries",
        "mission",
        "missionAssignmentId",
        "submission",
        "weekNumber"
      ]);
      expect(Object.keys(attempt?.submission ?? {}).sort()).toEqual([
        "id",
        "reviewedAt",
        "reviewerFeedback",
        "status",
        "submittedAt"
      ]);
      expect(Object.keys(attempt?.journalEntries[0] ?? {}).sort()).toEqual([
        "aiUsage",
        "challenge",
        "confidenceRating",
        "entryDate",
        "evidenceLinks",
        "id",
        "language",
        "learned",
        "solution",
        "timeSpentHours",
        "weekNumber",
        "workedOn"
      ]);
    });

    it("keeps the existing exact current-attempt journal lookup unchanged", async () => {
      await listEngineeringJournalEntriesForSubmissionReview({
        tenantId: "tenant-1",
        applicantId: "user-1",
        missionId: "mission-current",
        missionAssignmentId: "assignment-current"
      });

      expect(prismaMock.entryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: "tenant-1",
            applicantId: "user-1",
            missionId: "mission-current",
            missionAssignmentId: "assignment-current"
          }
        })
      );
    });
  });

  it("reads one owned journal entry by tenant and applicant", async () => {
    await getApplicantJournalEntry("journal-1", "tenant-1", "user-1");

    expect(prismaMock.entryFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "journal-1", tenantId: "tenant-1", applicantId: "user-1" } })
    );
  });

  it("reports create availability from the applicant's latest created entry", async () => {
    prismaMock.entryFindFirst.mockResolvedValue({ createdAt: new Date("2026-07-07T10:00:00.000Z") });

    const availability = await getJournalCreateAvailability(
      "tenant-1",
      "user-1",
      new Date("2026-07-08T09:00:00.000Z")
    );

    expect(prismaMock.entryFindFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", applicantId: "user-1" },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" }
    });
    expect(availability).toEqual({
      canCreate: true,
      lastCreatedAt: new Date("2026-07-07T10:00:00.000Z"),
      nextAllowedAt: null
    });
  });

  it("allows creation when no prior journal entry exists", () => {
    expect(getJournalCreateAvailabilityFromLatest(null, new Date("2026-07-08T10:00:00.000Z"))).toEqual({
      canCreate: true,
      lastCreatedAt: null,
      nextAllowedAt: null
    });
  });

  it("creates an entry only for a published mission in the applicant's accepted program", async () => {
    await createJournalEntry(journalInput({ entryDate: new Date("2026-07-07T15:45:00.000Z") }));

    expect(prismaMock.txMissionAssignmentFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        missionId: "mission-1",
        status: "ACTIVE",
        mission: { status: "PUBLISHED" }
      },
      include: { mission: { select: { id: true, programId: true, weekNumber: true } } },
      orderBy: { attemptNumber: "desc" }
    });
    expect(prismaMock.txApplicationFindFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", applicantId: "user-1", programId: "program-1", status: "ACCEPTED" },
      select: { id: true }
    });
    expect(prismaMock.txEntryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        applicantId: "user-1",
        programId: "program-1",
        missionId: "mission-1",
        missionAssignmentId: "assignment-1",
        weekNumber: 2,
        entryDate: new Date("2026-07-07T00:00:00.000Z")
      })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "journal.created", entityType: "EngineeringJournalEntry" })
    });
  });

  it("rejects creating a second entry for the same applicant and entry date", async () => {
    prismaMock.txEntryFindFirst.mockResolvedValue({ id: "journal-existing" });

    await expectJournalDateConflict(
      createJournalEntry(journalInput()),
      "You already have a journal entry for this date. Please edit the existing entry instead.",
      "journal-existing"
    );
    expect(prismaMock.txEntryFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        entryDate: new Date("2026-07-07T00:00:00.000Z")
      },
      select: { id: true }
    });
    expect(prismaMock.txEntryCreate).not.toHaveBeenCalled();
  });

  it("allows creating another entry immediately when the entry date is different", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T09:59:00.000Z"));

    await createJournalEntry(journalInput({ entryDate: new Date("2026-07-08T12:00:00.000Z") }));

    expect(prismaMock.txEntryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryDate: new Date("2026-07-08T00:00:00.000Z") })
    });
    expect(prismaMock.txQueryRaw).not.toHaveBeenCalled();
  });

  it("allows a back-dated entry without a 24-hour create wait", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T09:59:00.000Z"));

    await createJournalEntry(journalInput({ entryDate: new Date("2026-06-29T20:30:00.000Z") }));

    expect(prismaMock.txEntryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryDate: new Date("2026-06-29T00:00:00.000Z") })
    });
  });

  it("rejects creating a journal entry after the assignment is submitted", async () => {
    prismaMock.txMissionAssignmentFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: "SUBMITTED" });

    await expect(createJournalEntry(journalInput())).rejects.toThrow(
      "This journal entry is locked because it was submitted for review."
    );
    expect(prismaMock.txEntryCreate).not.toHaveBeenCalled();
  });

  it("allows one applicant to create entries for different dates", async () => {
    await createJournalEntry(journalInput({ entryDate: new Date("2026-07-07T12:00:00.000Z") }));
    await createJournalEntry(journalInput({ entryDate: new Date("2026-07-08T12:00:00.000Z") }));

    expect(prismaMock.txEntryCreate).toHaveBeenCalledTimes(2);
    expect(prismaMock.txEntryFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        entryDate: new Date("2026-07-07T00:00:00.000Z")
      },
      select: { id: true }
    });
    expect(prismaMock.txEntryFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        entryDate: new Date("2026-07-08T00:00:00.000Z")
      },
      select: { id: true }
    });
  });

  it("allows a back-dated entry when that applicant has no entry for that date", async () => {
    await createJournalEntry(journalInput({ entryDate: new Date("2026-06-29T20:30:00.000Z") }));

    expect(prismaMock.txEntryCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ entryDate: new Date("2026-06-29T00:00:00.000Z") })
    });
  });

  it("rejects entries for missing, archived or cross-tenant missions", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);

    await expect(createJournalEntry(journalInput())).rejects.toThrow("Mission is not assigned");
    expect(prismaMock.txEntryCreate).not.toHaveBeenCalled();
  });

  it("rejects entries when the applicant has no accepted application for the mission program", async () => {
    prismaMock.txApplicationFindFirst.mockResolvedValue(null);

    await expect(createJournalEntry(journalInput())).rejects.toThrow("accepted program");
    expect(prismaMock.txEntryCreate).not.toHaveBeenCalled();
  });

  it("updates only an owned journal entry and re-derives program/week from the selected mission", async () => {
    await updateJournalEntry({ id: "journal-1", ...journalInput() });

    expect(prismaMock.txEntryFindFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "journal-1", tenantId: "tenant-1", applicantId: "user-1" },
      select: { id: true, missionId: true, missionAssignmentId: true, lockedAt: true }
    });
    expect(prismaMock.txEntryFindFirst).toHaveBeenNthCalledWith(2, {
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        entryDate: new Date("2026-07-07T00:00:00.000Z"),
        id: { not: "journal-1" }
      },
      select: { id: true }
    });
    expect(prismaMock.txEntryUpdateMany).toHaveBeenCalledWith({
      where: { id: "journal-1", tenantId: "tenant-1", applicantId: "user-1" },
      data: expect.objectContaining({ programId: "program-1", weekNumber: 2 })
    });
    const updateData = prismaMock.txEntryUpdateMany.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("createdAt");
  });

  it("allows editing an existing entry while the assignment is unsubmitted", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-08T11:00:00.000Z"));

    await updateJournalEntry({ id: "journal-1", ...journalInput({ entryDate: new Date("2026-07-08T00:00:00.000Z") }) });

    expect(prismaMock.txEntryUpdateMany).toHaveBeenCalledWith({
      where: { id: "journal-1", tenantId: "tenant-1", applicantId: "user-1" },
      data: expect.objectContaining({ entryDate: new Date("2026-07-08T00:00:00.000Z") })
    });
    expect(prismaMock.txEntryFindFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    );
  });

  it("does not change createdAt when an entry is updated", async () => {
    await updateJournalEntry({ id: "journal-1", ...journalInput() });

    const updateData = prismaMock.txEntryUpdateMany.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("createdAt");
    expect(updateData).not.toHaveProperty("updatedAt");
  });

  it("rejects updating an entry date to another owned entry's date", async () => {
    prismaMock.txEntryFindFirst
      .mockResolvedValueOnce({
        id: "journal-1",
        missionId: "mission-1",
        missionAssignmentId: "assignment-1",
        lockedAt: null
      })
      .mockResolvedValueOnce({ id: "journal-2" });

    await expectJournalDateConflict(
      updateJournalEntry({ id: "journal-1", ...journalInput() }),
      "You already have a journal entry for this date. Please choose another date or edit the existing entry.",
      "journal-2"
    );
    expect(prismaMock.txEntryUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects editing a journal entry after the assignment is submitted", async () => {
    prismaMock.txEntryFindFirst.mockResolvedValue({
      id: "journal-1",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1",
      lockedAt: new Date("2026-07-07T10:00:00.000Z")
    });

    await expect(updateJournalEntry({ id: "journal-1", ...journalInput() })).rejects.toThrow(
      "This journal entry is locked because it was submitted for review."
    );
    expect(prismaMock.txEntryUpdateMany).not.toHaveBeenCalled();
  });

  it("allows different applicants to use the same entry date", async () => {
    await createJournalEntry(journalInput({ applicantId: "user-1" }));
    await createJournalEntry(journalInput({ applicantId: "user-2" }));

    expect(prismaMock.txEntryCreate).toHaveBeenCalledTimes(2);
    expect(prismaMock.txEntryFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        entryDate: new Date("2026-07-07T00:00:00.000Z")
      },
      select: { id: true }
    });
    expect(prismaMock.txEntryFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-2",
        entryDate: new Date("2026-07-07T00:00:00.000Z")
      },
      select: { id: true }
    });
  });

  it("keeps duplicate date checks tenant scoped", async () => {
    await createJournalEntry(journalInput({ tenantId: "tenant-1" }));
    await createJournalEntry(journalInput({ tenantId: "tenant-2" }));

    expect(prismaMock.txEntryCreate).toHaveBeenCalledTimes(2);
    expect(prismaMock.txEntryFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        entryDate: new Date("2026-07-07T00:00:00.000Z")
      },
      select: { id: true }
    });
    expect(prismaMock.txEntryFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-2",
        applicantId: "user-1",
        entryDate: new Date("2026-07-07T00:00:00.000Z")
      },
      select: { id: true }
    });
  });

  it("rejects cross-applicant updates by resolving them as not found", async () => {
    prismaMock.txEntryFindFirst.mockResolvedValue(null);

    await expect(updateJournalEntry({ id: "journal-1", ...journalInput() })).rejects.toThrow("not found");
    expect(prismaMock.txEntryUpdateMany).not.toHaveBeenCalled();
  });

  it("validates confidence rating and evidence links", () => {
    expect(validateConfidenceRating(1)).toBe(1);
    expect(validateConfidenceRating(5)).toBe(5);
    expect(() => validateConfidenceRating(0)).toThrow("1 to 5");
    expect(() => validateConfidenceRating(6)).toThrow("1 to 5");
    expect(() => validateConfidenceRating(2.5)).toThrow("whole number");

    expect(parseJournalEvidenceLinks("https://github.com/org/repo\nhttps://example.com/demo")).toEqual([
      "https://github.com/org/repo",
      "https://example.com/demo"
    ]);
    expect(() => parseJournalEvidenceLinks("ftp://example.com/file")).toThrow("valid URLs");
    expect(() => parseJournalEvidenceLinks("https://user:password@example.com/private")).toThrow("username or password");
  });

  it("accepts today and back-dated journal dates but rejects future dates", () => {
    const now = new Date("2026-07-16T18:30:00.000Z");
    expect(normalizeJournalEntryDate(new Date("2026-07-16T20:00:00.000Z"), now)).toEqual(
      new Date("2026-07-16T00:00:00.000Z")
    );
    expect(normalizeJournalEntryDate(new Date("2026-07-01T12:00:00.000Z"), now)).toEqual(
      new Date("2026-07-01T00:00:00.000Z")
    );
    expect(() => normalizeJournalEntryDate(new Date("2026-07-17T00:00:00.000Z"), now)).toThrow("future");
  });

  it("uses the applicant calendar time zone when validating today's date", () => {
    const now = new Date("2026-07-15T22:30:00.000Z");

    expect(
      normalizeJournalEntryDate(new Date("2026-07-16T00:00:00.000Z"), now, "Asia/Karachi")
    ).toEqual(new Date("2026-07-16T00:00:00.000Z"));
    expect(() =>
      normalizeJournalEntryDate(new Date("2026-07-17T00:00:00.000Z"), now, "Asia/Karachi")
    ).toThrow("future");
    expect(() =>
      normalizeJournalEntryDate(new Date("2026-07-16T00:00:00.000Z"), now, "Not/A_Time_Zone")
    ).toThrow("time zone is invalid");
  });

  it("uses an explicit positive time-spent range", () => {
    expect(validateTimeSpentHours(0.25)).toBe(0.25);
    expect(validateTimeSpentHours(24)).toBe(24);
    expect(() => validateTimeSpentHours(0)).toThrow("at least 0.25");
    expect(() => validateTimeSpentHours(0.1)).toThrow("at least 0.25");
    expect(() => validateTimeSpentHours(24.25)).toThrow("no more than 24");
  });

  it("updates preferred journal language with a normalized fallback", async () => {
    await updatePreferredJournalLanguage("user-1", "  Roman Urdu  ");
    expect(prismaMock.userUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { preferredJournalLanguage: "Roman Urdu" }
    });

    await updatePreferredJournalLanguage("user-1", "   ");
    expect(prismaMock.userUpdate).toHaveBeenLastCalledWith({
      where: { id: "user-1" },
      data: { preferredJournalLanguage: "English" }
    });
  });
});

function journalInput(overrides: Partial<ReturnType<typeof journalInputFixture>> = {}) {
  return { ...journalInputFixture(), ...overrides };
}

async function expectJournalDateConflict(promise: Promise<unknown>, message: string, existingEntryId: string) {
  try {
    await promise;
    throw new Error("Expected journal date conflict");
  } catch (error) {
    expect(error).toBeInstanceOf(JournalEntryDateConflictError);
    expect(error).toMatchObject({ message, existingEntryId });
  }
}

function journalInputFixture() {
  return {
    tenantId: "tenant-1",
    applicantId: "user-1",
    missionId: "mission-1",
    entryDate: new Date("2026-07-07T00:00:00.000Z"),
    language: "Roman Urdu",
    workedOn: "Built the journal form.",
    challenge: "Figuring out tenant ownership.",
    solution: "Checked the accepted application before writing.",
    learned: "Journal entries need their own module.",
    aiUsage: "Used AI to draft test cases.",
    confidenceRating: 4,
    timeSpentHours: 2,
    evidenceLinks: ["https://github.com/org/repo"]
  };
}
