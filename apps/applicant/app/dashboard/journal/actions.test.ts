import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantAccess: vi.fn(),
  listApplicantApplications: vi.fn(),
  createJournalEntry: vi.fn(),
  updateJournalEntry: vi.fn(),
  parseJournalEvidenceLinks: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("@/lib/tenant-guard", () => ({
  requireTenantAccess: mocks.requireTenantAccess
}));

vi.mock("@talentos/db", () => {
  class JournalEntryDateConflictError extends Error {
    constructor(message: string, public readonly existingEntryId: string | null = null) {
      super(message);
      this.name = "JournalEntryDateConflictError";
    }
  }
  return {
    createJournalEntry: mocks.createJournalEntry,
    updateJournalEntry: mocks.updateJournalEntry,
    listApplicantApplications: mocks.listApplicantApplications,
    parseJournalEvidenceLinks: mocks.parseJournalEvidenceLinks,
    JournalEntryDateConflictError
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { saveJournalEntryAction } from "./actions";
import { JournalEntryDateConflictError } from "@talentos/db";

const tenantCtx = { tenant: { id: "tenant-1", slug: "demo" }, actorUserId: "user-1" };

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("missionId", "mission-1");
  fd.set("entryDate", "2026-08-10");
  fd.set("calendarTimeZone", "UTC");
  fd.set("language", "English");
  fd.set("workedOn", "Built REST API endpoints");
  fd.set("challenge", "Authentication was tricky");
  fd.set("solution", "Used JWT with refresh tokens");
  fd.set("learned", "JWT best practices");
  fd.set("aiUsage", "Used AI for code review");
  fd.set("confidenceRating", "4");
  fd.set("timeSpentHours", "2");
  fd.set("evidenceLinks", "");
  for (const [key, value] of Object.entries(overrides)) {
    fd.set(key, value);
  }
  return fd;
}

describe("saveJournalEntryAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.requireTenantAccess.mockResolvedValue(tenantCtx);
    mocks.listApplicantApplications.mockResolvedValue([
      { status: "ACCEPTED", program: { id: "program-1" } }
    ]);
    mocks.parseJournalEvidenceLinks.mockReturnValue([]);
  });

  it("creates a new journal entry and redirects to it", async () => {
    mocks.createJournalEntry.mockResolvedValue({ id: "journal-new" });

    await saveJournalEntryAction(null, { ok: false, error: null, existingEntryId: null }, buildFormData());

    expect(mocks.createJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", applicantId: "user-1", missionId: "mission-1" })
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard/journal/journal-new");
  });

  it("updates an existing journal entry without redirecting", async () => {
    mocks.updateJournalEntry.mockResolvedValue({ id: "journal-1" });

    const result = await saveJournalEntryAction("journal-1", { ok: false, error: null, existingEntryId: null }, buildFormData());

    expect(mocks.updateJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ id: "journal-1", tenantId: "tenant-1", applicantId: "user-1" })
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, error: null, existingEntryId: null });
  });

  it("returns an error when no accepted application exists", async () => {
    mocks.listApplicantApplications.mockResolvedValue([
      { status: "SUBMITTED", program: { id: "program-1" } }
    ]);

    const result = await saveJournalEntryAction(null, { ok: false, error: null, existingEntryId: null }, buildFormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("accepted");
  });

  it("returns an error when the user is not linked", async () => {
    mocks.requireTenantAccess.mockResolvedValue({ tenant: { id: "tenant-1" }, actorUserId: null });

    const result = await saveJournalEntryAction(null, { ok: false, error: null, existingEntryId: null }, buildFormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not linked");
  });

  it("returns an error when missionId is missing", async () => {
    const result = await saveJournalEntryAction(null, { ok: false, error: null, existingEntryId: null }, buildFormData({ missionId: "" }));

    expect(result.ok).toBe(false);
    expect(result.error).toContain("mission");
  });

  it("returns an error when entryDate is missing", async () => {
    const result = await saveJournalEntryAction(null, { ok: false, error: null, existingEntryId: null }, buildFormData({ entryDate: "" }));

    expect(result.ok).toBe(false);
    expect(result.error).toContain("date");
  });

  it("surfaces JournalEntryDateConflictError with existingEntryId", async () => {
    mocks.createJournalEntry.mockRejectedValue(
      new JournalEntryDateConflictError("You already have a journal entry for this mission on this date.", "journal-existing")
    );

    const result = await saveJournalEntryAction(null, { ok: false, error: null, existingEntryId: null }, buildFormData());

    expect(result.ok).toBe(false);
    expect(result.existingEntryId).toBe("journal-existing");
    expect(result.error).toContain("already have");
  });

  it("surfaces generic errors from createJournalEntry", async () => {
    mocks.createJournalEntry.mockRejectedValue(new Error("Mission is not assigned."));

    const result = await saveJournalEntryAction(null, { ok: false, error: null, existingEntryId: null }, buildFormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not assigned");
  });
});
