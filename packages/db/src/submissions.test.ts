import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  submissionFindFirst: vi.fn(),
  submissionFindMany: vi.fn(),
  missionFindMany: vi.fn(),
  missionAssignmentFindMany: vi.fn(),
  transaction: vi.fn(),
  txMissionFindFirst: vi.fn(),
  txSubmissionFindFirst: vi.fn(),
  txSubmissionCreate: vi.fn(),
  txSubmissionUpdate: vi.fn(),
  txSubmissionFindFirstOrThrow: vi.fn(),
  txAuditLogCreate: vi.fn(),
  txNotificationCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    submission: {
      findFirst: prismaMock.submissionFindFirst,
      findMany: prismaMock.submissionFindMany
    },
    mission: {
      findMany: prismaMock.missionFindMany
    },
    missionAssignment: {
      findMany: prismaMock.missionAssignmentFindMany
    },
    $transaction: prismaMock.transaction
  }
}));

import {
  getApplicantMissionProgress,
  getApplicantSubmission,
  listMissionSubmissions,
  parseEvidenceUrl,
  reviewSubmission,
  saveSubmissionDraft,
  submitSubmission
} from "./submissions";

describe("parseEvidenceUrl (host allowlists, D-067)", () => {
  it("accepts GitHub repository URLs and rejects other hosts", () => {
    expect(parseEvidenceUrl("https://github.com/user/repo", "repository")).toBe("https://github.com/user/repo");
    expect(() => parseEvidenceUrl("https://gitlab.com/user/repo", "repository")).toThrow("github.com");
    // Look-alike suffix is rejected (endsWith('.github.com') check, not includes).
    expect(() => parseEvidenceUrl("https://evilgithub.com/x", "repository")).toThrow("github.com");
  });

  it("accepts Loom URLs and rejects other hosts", () => {
    expect(parseEvidenceUrl("https://www.loom.com/share/abc", "loom")).toBe("https://www.loom.com/share/abc");
    expect(() => parseEvidenceUrl("https://youtube.com/watch?v=1", "loom")).toThrow("loom.com");
  });

  it("accepts any http(s) deployment URL but rejects other protocols and garbage", () => {
    expect(parseEvidenceUrl("https://myapp.vercel.app/", "deployment")).toBe("https://myapp.vercel.app/");
    expect(() => parseEvidenceUrl("javascript:alert(1)", "deployment")).toThrow("valid deployment URL");
    expect(() => parseEvidenceUrl("not a url", "deployment")).toThrow("valid deployment URL");
  });

  it("returns null for empty values (all evidence fields are optional in drafts)", () => {
    expect(parseEvidenceUrl("", "repository")).toBeNull();
    expect(parseEvidenceUrl("   ", "loom")).toBeNull();
  });
});

describe("submission data access", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        mission: { findFirst: prismaMock.txMissionFindFirst },
        submission: {
          findFirst: prismaMock.txSubmissionFindFirst,
          create: prismaMock.txSubmissionCreate,
          update: prismaMock.txSubmissionUpdate,
          findFirstOrThrow: prismaMock.txSubmissionFindFirstOrThrow
        },
        auditLog: { create: prismaMock.txAuditLogCreate },
        notification: { create: prismaMock.txNotificationCreate }
      })
    );
    prismaMock.txMissionFindFirst.mockResolvedValue({ id: "mission-1" });
    prismaMock.txSubmissionCreate.mockResolvedValue({ id: "sub-1" });
    prismaMock.txSubmissionUpdate.mockResolvedValue({ id: "sub-1", status: "SUBMITTED" });
    prismaMock.txSubmissionFindFirstOrThrow.mockResolvedValue({ id: "sub-1" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
    prismaMock.txNotificationCreate.mockResolvedValue({ id: "notif-1" });
  });

  it("reads the applicant's own submission tenant-scoped", async () => {
    await getApplicantSubmission("mission-1", "user-1", "tenant-1");
    expect(prismaMock.submissionFindFirst).toHaveBeenCalledWith({
      where: { missionId: "mission-1", applicantId: "user-1", tenantId: "tenant-1" }
    });
  });

  it("lists mission submissions tenant-scoped with applicant identity", async () => {
    await listMissionSubmissions("tenant-1", "mission-1");
    expect(prismaMock.submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1", missionId: "mission-1" } })
    );
  });

  it("creates a first draft only for a PUBLISHED mission of the tenant, with audit", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue(null);
    await saveSubmissionDraft(draftInput());

    expect(prismaMock.txMissionFindFirst).toHaveBeenCalledWith({
      where: {
        id: "mission-1",
        tenantId: "tenant-1",
        status: "PUBLISHED",
        assignments: { some: { tenantId: "tenant-1", applicantId: "user-1" } }
      },
      select: { id: true }
    });
    expect(prismaMock.txSubmissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-1", applicantId: "user-1", status: "DRAFT" })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "submission.created", entityType: "Submission" })
    });
  });

  it("creates a draft when the legacy inline journal field is omitted", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue(null);

    await saveSubmissionDraft(draftInputWithoutJournal());

    const createdData = prismaMock.txSubmissionCreate.mock.calls[0][0].data;
    expect(createdData).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        applicantId: "user-1",
        repositoryUrl: "https://github.com/u/r",
        status: "DRAFT"
      })
    );
    expect(createdData).not.toHaveProperty("journalMarkdown");
  });

  it("rejects drafts for missions outside the tenant or not published", async () => {
    prismaMock.txMissionFindFirst.mockResolvedValue(null);
    await expect(saveSubmissionDraft(draftInput())).rejects.toThrow("Mission is not assigned");
    expect(prismaMock.txSubmissionCreate).not.toHaveBeenCalled();
  });

  it("rejects drafts for missions not assigned to the applicant", async () => {
    prismaMock.txMissionFindFirst.mockResolvedValue(null);

    await expect(saveSubmissionDraft(draftInput())).rejects.toThrow("Mission is not assigned to this applicant.");
    expect(prismaMock.txSubmissionCreate).not.toHaveBeenCalled();
  });

  it("refuses to edit evidence once SUBMITTED or ACCEPTED", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({ id: "sub-1", status: "SUBMITTED" });
    await expect(saveSubmissionDraft(draftInput())).rejects.toThrow("not editable");

    prismaMock.txSubmissionFindFirst.mockResolvedValue({ id: "sub-1", status: "ACCEPTED" });
    await expect(saveSubmissionDraft(draftInput())).rejects.toThrow("not editable");
  });

  it("allows re-editing after NEEDS_REVISION (the SEM loop)", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({ id: "sub-1", status: "NEEDS_REVISION" });
    await saveSubmissionDraft(draftInput());
    expect(prismaMock.txSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({ repositoryUrl: "https://github.com/u/r" })
    });
  });

  it("preserves existing legacy journal markdown when new drafts omit that field", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({ id: "sub-1", status: "DRAFT" });

    await saveSubmissionDraft(draftInputWithoutJournal());

    const updateData = prismaMock.txSubmissionUpdate.mock.calls[0][0].data;
    expect(updateData).toEqual(expect.objectContaining({ repositoryUrl: "https://github.com/u/r" }));
    expect(updateData).not.toHaveProperty("journalMarkdown");
  });

  it("submits only the applicant's own draft and requires at least one evidence link", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "DRAFT",
      missionId: "mission-1",
      repositoryUrl: null,
      deploymentUrl: null,
      loomUrl: null
    });
    await expect(submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" })).rejects.toThrow(
      "at least one evidence link"
    );

    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "DRAFT",
      missionId: "mission-1",
      repositoryUrl: "https://github.com/u/r",
      deploymentUrl: null,
      loomUrl: null
    });
    await submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" });
    expect(prismaMock.txSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({ status: "SUBMITTED" })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "submission.submitted" })
    });
    // Ownership is part of the lookup, not a post-check.
    expect(prismaMock.txSubmissionFindFirst).toHaveBeenCalledWith({
      where: { id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }
    });
  });

  it("rejects submitting from a non-editable status", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "ACCEPTED",
      repositoryUrl: "https://github.com/u/r"
    });
    await expect(submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" })).rejects.toThrow(
      "Invalid submission status transition"
    );
  });

  it("reviews a SUBMITTED submission, records reviewer fields, audits and notifies the applicant", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" }
    });

    await reviewSubmission({
      id: "sub-1",
      tenantId: "tenant-1",
      status: "NEEDS_REVISION",
      reviewerFeedback: "Add acceptance criteria evidence.",
      reviewerUserId: "lead-1"
    });

    expect(prismaMock.txSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({
        status: "NEEDS_REVISION",
        reviewerFeedback: "Add acceptance criteria evidence.",
        reviewerUserId: "lead-1"
      })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "submission.reviewed" })
    });
    expect(prismaMock.txNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        type: "WARNING",
        title: "Revision requested: Build a Landing Page",
        body: "Add acceptance criteria evidence."
      })
    });
  });

  it("sends a SUCCESS notification on acceptance", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" }
    });

    await reviewSubmission({
      id: "sub-1",
      tenantId: "tenant-1",
      status: "ACCEPTED",
      reviewerFeedback: "Great work.",
      reviewerUserId: "lead-1"
    });

    expect(prismaMock.txNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "SUCCESS", title: "Mission accepted: Build a Landing Page" })
    });
  });

  it("refuses to review a submission that is not SUBMITTED (double-review guard)", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "ACCEPTED",
      mission: { id: "mission-1", title: "X" }
    });
    await expect(
      reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "NEEDS_REVISION",
        reviewerFeedback: "n/a",
        reviewerUserId: "lead-1"
      })
    ).rejects.toThrow("Invalid submission status transition");
    expect(prismaMock.txNotificationCreate).not.toHaveBeenCalled();
  });

  it("cross-tenant review resolves to not-found (tenant isolation)", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue(null);
    await expect(
      reviewSubmission({
        id: "sub-1",
        tenantId: "other-tenant",
        status: "ACCEPTED",
        reviewerFeedback: "",
        reviewerUserId: "lead-1"
      })
    ).rejects.toThrow("Submission not found for this tenant.");
  });
});

function draftInput() {
  return {
    tenantId: "tenant-1",
    missionId: "mission-1",
    applicantId: "user-1",
    repositoryUrl: "https://github.com/u/r",
    deploymentUrl: null,
    loomUrl: null,
    journalMarkdown: "## Week 1\nBuilt the landing page."
  };
}

function draftInputWithoutJournal() {
  const { journalMarkdown: _journalMarkdown, ...input } = draftInput();
  return input;
}

// Mission progress (v0.16.0, D-069): the dashboard's source of truth. Only ACCEPTED submissions
// move the bar; the current mission is the first published mission not yet accepted.
describe("getApplicantMissionProgress", () => {
  beforeEach(() => {
    prismaMock.missionFindMany.mockReset();
    prismaMock.missionAssignmentFindMany.mockReset();
    prismaMock.submissionFindMany.mockReset();
  });

  const missions = [
    { id: "m1", title: "Week 1 Mission", weekNumber: 1, order: 1 },
    { id: "m2", title: "Week 2 Mission", weekNumber: 2, order: 2 },
    { id: "m3", title: "Week 3 Mission", weekNumber: 3, order: 3 },
    { id: "m4", title: "Week 4 Mission", weekNumber: 4, order: 4 }
  ];

  it("reports zero progress and the Week 1 mission as current when nothing is started", async () => {
    prismaMock.missionAssignmentFindMany.mockResolvedValue(asAssignments(missions));
    prismaMock.submissionFindMany.mockResolvedValue([]);

    const progress = await getApplicantMissionProgress("tenant-1", "user-1", "program-1");

    expect(progress.overall).toEqual({ accepted: 0, total: 4, percentage: 0 });
    expect(progress.weeks).toHaveLength(4);
    expect(progress.weeks[0]).toEqual({ weekNumber: 1, totalMissions: 1, acceptedMissions: 0, percentage: 0 });
    expect(progress.currentMission).toEqual({
      id: "m1",
      title: "Week 1 Mission",
      weekNumber: 1,
      submissionStatus: null
    });
    // Reads are tenant + program scoped and published-only.
    expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", applicantId: "user-1", mission: { status: "PUBLISHED" } },
      include: { mission: { select: { id: true, title: true, weekNumber: true, order: true } } }
    });
  });

  it("counts only ACCEPTED submissions and advances the current mission past them", async () => {
    prismaMock.missionAssignmentFindMany.mockResolvedValue(asAssignments(missions));
    prismaMock.submissionFindMany.mockResolvedValue([
      { id: "s1", missionId: "m1", status: "ACCEPTED", submittedAt: new Date() },
      { id: "s2", missionId: "m2", status: "SUBMITTED", submittedAt: new Date() }
    ]);

    const progress = await getApplicantMissionProgress("tenant-1", "user-1", "program-1");

    expect(progress.overall).toEqual({ accepted: 1, total: 4, percentage: 25 });
    expect(progress.weeks[0].percentage).toBe(100);
    expect(progress.weeks[1].percentage).toBe(0);
    // m1 is done; m2 is the current mission with its pending review visible.
    expect(progress.currentMission).toEqual({
      id: "m2",
      title: "Week 2 Mission",
      weekNumber: 2,
      submissionStatus: "SUBMITTED"
    });
  });

  it("reports full completion with no current mission when every mission is accepted", async () => {
    prismaMock.missionAssignmentFindMany.mockResolvedValue(asAssignments(missions));
    prismaMock.submissionFindMany.mockResolvedValue(
      missions.map((m, i) => ({ id: `s${i}`, missionId: m.id, status: "ACCEPTED", submittedAt: new Date() }))
    );

    const progress = await getApplicantMissionProgress("tenant-1", "user-1", "program-1");

    expect(progress.overall).toEqual({ accepted: 4, total: 4, percentage: 100 });
    expect(progress.weeks.every((w) => w.percentage === 100)).toBe(true);
    expect(progress.currentMission).toBeNull();
  });

  it("always includes weeks 1-4 even when no missions are published", async () => {
    prismaMock.missionAssignmentFindMany.mockResolvedValue([]);
    prismaMock.submissionFindMany.mockResolvedValue([]);

    const progress = await getApplicantMissionProgress("tenant-1", "user-1", "program-1");

    expect(progress.weeks).toHaveLength(4);
    expect(progress.overall).toEqual({ accepted: 0, total: 0, percentage: 0 });
    expect(progress.currentMission).toBeNull();
  });
});

function asAssignments(missions: { id: string; title: string; weekNumber: number; order: number }[]) {
  return missions.map((mission) => ({ mission }));
}
