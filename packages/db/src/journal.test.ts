import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  entryFindMany: vi.fn(),
  entryFindFirst: vi.fn(),
  submissionFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  transaction: vi.fn(),
  txMissionFindFirst: vi.fn(),
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
  parseJournalEvidenceLinks,
  updateJournalEntry,
  updatePreferredJournalLanguage,
  validateConfidenceRating
} from "./journal";

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
    prismaMock.txMissionFindFirst.mockResolvedValue({ id: "mission-1", programId: "program-1", weekNumber: 2 });
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "app-1" });
    prismaMock.txSubmissionFindFirst.mockResolvedValue(null);
    prismaMock.txEntryCreate.mockResolvedValue({ id: "journal-1" });
    prismaMock.txEntryFindFirst.mockImplementation(async ({ where }) =>
      where?.id === "journal-1" ? { id: "journal-1", missionId: "mission-1" } : null
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

    expect(prismaMock.txMissionFindFirst).toHaveBeenCalledWith({
      where: {
        id: "mission-1",
        tenantId: "tenant-1",
        status: "PUBLISHED",
        assignments: { some: { tenantId: "tenant-1", applicantId: "user-1" } }
      },
      select: { id: true, programId: true, weekNumber: true }
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
    prismaMock.txSubmissionFindFirst.mockResolvedValue({ id: "sub-1" });

    await expect(createJournalEntry(journalInput())).rejects.toThrow(
      "This journal entry is locked because the assignment has already been submitted."
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
    prismaMock.txMissionFindFirst.mockResolvedValue(null);

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
      select: { id: true, missionId: true }
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
    vi.setSystemTime(new Date("2026-07-07T11:00:00.000Z"));

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
      .mockResolvedValueOnce({ id: "journal-1", missionId: "mission-1" })
      .mockResolvedValueOnce({ id: "journal-2" });

    await expectJournalDateConflict(
      updateJournalEntry({ id: "journal-1", ...journalInput() }),
      "You already have a journal entry for this date. Please choose another date or edit the existing entry.",
      "journal-2"
    );
    expect(prismaMock.txEntryUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects editing a journal entry after the assignment is submitted", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({ id: "sub-1" });

    await expect(updateJournalEntry({ id: "journal-1", ...journalInput() })).rejects.toThrow(
      "This journal entry is locked because the assignment has already been submitted."
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
