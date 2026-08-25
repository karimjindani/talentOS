import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  submissionFindFirst: vi.fn(),
  submissionFindMany: vi.fn(),
  missionFindMany: vi.fn(),
  missionAssignmentFindMany: vi.fn(),
  transaction: vi.fn(),
  txMissionFindFirst: vi.fn(),
  txMissionFindMany: vi.fn(),
  txMissionAssignmentFindFirst: vi.fn(),
  txMissionAssignmentFindMany: vi.fn(),
  txMissionAssignmentUpdateMany: vi.fn(),
  txMissionAssignmentCreate: vi.fn(),
  txApplicationFindFirst: vi.fn(),
  txApplicationUpdateMany: vi.fn(),
  txMissionAssignmentGroupBy: vi.fn(),
  txTenantMembershipFindMany: vi.fn(),
  txNotificationCreateMany: vi.fn(),
  txSubmissionFindFirst: vi.fn(),
  txSubmissionCreate: vi.fn(),
  txSubmissionUpdate: vi.fn(),
  txSubmissionUpdateMany: vi.fn(),
  txSubmissionFindFirstOrThrow: vi.fn(),
  txSubmissionFindMany: vi.fn(),
  txGraduateProfileUpdateMany: vi.fn(),
  txAuditLogCreate: vi.fn(),
  txNotificationCreate: vi.fn(),
  txJournalUpdateMany: vi.fn(),
  txMissionTaskCompletionFindMany: vi.fn(),
  txSubmissionReviewFindMany: vi.fn(),
  txSubmissionReviewCreate: vi.fn(),
  submissionReviewFindMany: vi.fn(),
  featureFlagFindUnique: vi.fn()
}));

const readinessMock = vi.hoisted(() => ({
  getReadiness: vi.fn(),
  getReadinessWithClient: vi.fn()
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
    submissionReview: { findMany: prismaMock.submissionReviewFindMany },
    featureFlag: { findUnique: prismaMock.featureFlagFindUnique },
    $transaction: prismaMock.transaction
  }
}));

vi.mock("./submission-readiness", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./submission-readiness")>();
  return {
    ...actual,
    getMissionSubmissionReadiness: readinessMock.getReadiness,
    getMissionSubmissionReadinessWithClient: readinessMock.getReadinessWithClient
  };
});

import {
  getApplicantMissionProgress,
  getApplicantSubmission,
  listMissionSubmissions,
  listTenantSubmissions,
  parseEvidenceUrl,
  listSubmissionReviewHistory,
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
    expect(() => parseEvidenceUrl("javascript:alert(1)", "deployment")).toThrow("valid public deployment URL");
    expect(() => parseEvidenceUrl("not a url", "deployment")).toThrow("valid public deployment URL");
  });

  it("returns null for empty values (all evidence fields are optional in drafts)", () => {
    expect(parseEvidenceUrl("", "repository")).toBeNull();
    expect(parseEvidenceUrl("   ", "loom")).toBeNull();
  });
});

describe("submission data access", () => {
  beforeEach(() => {
    vi.useRealTimers();
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        mission: { findFirst: prismaMock.txMissionFindFirst, findMany: prismaMock.txMissionFindMany },
        missionAssignment: {
          findFirst: prismaMock.txMissionAssignmentFindFirst,
          findMany: prismaMock.txMissionAssignmentFindMany,
          updateMany: prismaMock.txMissionAssignmentUpdateMany,
          create: prismaMock.txMissionAssignmentCreate,
          groupBy: prismaMock.txMissionAssignmentGroupBy
        },
        application: { findFirst: prismaMock.txApplicationFindFirst, updateMany: prismaMock.txApplicationUpdateMany },
        tenantMembership: { findMany: prismaMock.txTenantMembershipFindMany },
        submission: {
          findFirst: prismaMock.txSubmissionFindFirst,
          findMany: prismaMock.txSubmissionFindMany,
          create: prismaMock.txSubmissionCreate,
          update: prismaMock.txSubmissionUpdate,
          updateMany: prismaMock.txSubmissionUpdateMany,
          findFirstOrThrow: prismaMock.txSubmissionFindFirstOrThrow
        },
        graduateProfile: { updateMany: prismaMock.txGraduateProfileUpdateMany },
        engineeringJournalEntry: { updateMany: prismaMock.txJournalUpdateMany },
        auditLog: { create: prismaMock.txAuditLogCreate },
        notification: { create: prismaMock.txNotificationCreate, createMany: prismaMock.txNotificationCreateMany },
        missionTaskCompletion: { findMany: prismaMock.txMissionTaskCompletionFindMany },
        submissionReview: {
          findMany: prismaMock.txSubmissionReviewFindMany,
          create: prismaMock.txSubmissionReviewCreate
        }
      })
    );
    prismaMock.txMissionAssignmentFindMany.mockResolvedValue([]);
    prismaMock.txSubmissionReviewFindMany.mockResolvedValue([]);
    // Auto-publish: no prior accepted submissions by default
    prismaMock.txSubmissionFindMany.mockResolvedValue([]);
    prismaMock.txGraduateProfileUpdateMany.mockResolvedValue({ count: 0 });
    // Tasks 1 & 2 complete by default so existing submit-flow tests are unaffected by the gate;
    // tests for the gate itself override this.
    prismaMock.txMissionTaskCompletionFindMany.mockResolvedValue([{ taskIndex: 1 }, { taskIndex: 2 }]);
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "user-1",
      missionId: "mission-1",
      weekNumber: 1,
      attemptNumber: 1,
      status: "ACCEPTED",
      // Relative to "now" so submit-flow tests that don't pin the clock stay within the live window
      // regardless of the current date (tests exercising the deadline/grace edges set their own clock).
      deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      graceEndsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      mission: { id: "mission-1", programId: "program-1", weekNumber: 1 }
    });
    prismaMock.txSubmissionCreate.mockResolvedValue({ id: "sub-1" });
    prismaMock.txSubmissionUpdate.mockResolvedValue({ id: "sub-1", status: "SUBMITTED" });
    prismaMock.txSubmissionUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txSubmissionFindFirstOrThrow.mockResolvedValue({ id: "sub-1" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
    prismaMock.txNotificationCreate.mockResolvedValue({ id: "notif-1" });
    prismaMock.txNotificationCreateMany.mockResolvedValue({ count: 0 });
    prismaMock.txMissionAssignmentUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txMissionAssignmentCreate.mockResolvedValue({ id: "assignment-2", attemptNumber: 2 });
    prismaMock.txJournalUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.featureFlagFindUnique.mockResolvedValue({ enabled: false });
    readinessMock.getReadiness.mockReset();
    readinessMock.getReadinessWithClient.mockReset();
    readinessMock.getReadiness.mockResolvedValue(readyReadiness());
    readinessMock.getReadinessWithClient.mockResolvedValue(readyReadiness());
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "application-1" });
    prismaMock.txApplicationUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txMissionFindMany.mockResolvedValue([]);
    prismaMock.txMissionAssignmentGroupBy.mockResolvedValue([]);
    prismaMock.txTenantMembershipFindMany.mockResolvedValue([]);
  });

  it("reads the applicant's own submission tenant-scoped", async () => {
    await getApplicantSubmission("mission-1", "user-1", "tenant-1");
    expect(prismaMock.submissionFindFirst).toHaveBeenCalledWith({
      where: { missionId: "mission-1", applicantId: "user-1", tenantId: "tenant-1" },
      orderBy: { createdAt: "desc" }
    });
  });

  it("lists mission submissions tenant-scoped with applicant identity", async () => {
    await listMissionSubmissions("tenant-1", "mission-1");
    expect(prismaMock.submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1", missionId: "mission-1" } })
    );
  });

  it("lists tenant-wide submissions with no filters by default", async () => {
    await listTenantSubmissions("tenant-1");
    expect(prismaMock.submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-1" } })
    );
  });

  it("filters tenant-wide submissions by status and program", async () => {
    await listTenantSubmissions("tenant-1", { status: "SUBMITTED", programId: "program-1" });
    expect(prismaMock.submissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", status: "SUBMITTED", mission: { programId: "program-1" } }
      })
    );
  });

  it("creates a first draft only for a PUBLISHED mission of the tenant, with audit", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue(null);
    await saveSubmissionDraft(draftInput());

    expect(prismaMock.txMissionAssignmentFindFirst).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        missionId: "mission-1",
        status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] },
        mission: { status: "PUBLISHED" }
      },
      include: { mission: { select: { id: true, programId: true, weekNumber: true } } },
      orderBy: { attemptNumber: "desc" }
    });
    expect(prismaMock.txSubmissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "tenant-1",
        applicantId: "user-1",
        missionAssignmentId: "assignment-1",
        status: "DRAFT"
      })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "submission.created", entityType: "Submission" })
    });
    // First draft moves the assignment ACCEPTED -> IN_PROGRESS.
    expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "assignment-1", tenantId: "tenant-1", applicantId: "user-1", status: "ACCEPTED" },
      data: { status: "IN_PROGRESS" }
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
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);
    await expect(saveSubmissionDraft(draftInput())).rejects.toThrow("Mission is not assigned");
    expect(prismaMock.txSubmissionCreate).not.toHaveBeenCalled();
  });

  it("rejects drafts for missions not assigned to the applicant", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);

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

  it("normalizes multiple deployment URLs when saving a draft", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({ id: "sub-1", status: "DRAFT" });

    await saveSubmissionDraft({
      ...draftInputWithoutJournal(),
      deploymentUrl:
        " https://app.example.com ; ; https://api.example.com; https://app.example.com "
    });

    expect(prismaMock.txSubmissionUpdate).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: expect.objectContaining({
        deploymentUrl: "https://app.example.com/;https://api.example.com/"
      })
    });
  });

  it("blocks incomplete readiness without changing status or locking journals", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    readinessMock.getReadiness.mockResolvedValue({
      ...readyReadiness(),
      ready: false,
      blockers: ["Add at least 4 Engineering Journal entries (3 of 4 completed)."]
    });

    await expect(
      submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }, reachableDependencies())
    ).rejects.toThrow("3 of 4");
    expect(prismaMock.transaction).not.toHaveBeenCalled();
    expect(prismaMock.txSubmissionUpdateMany).not.toHaveBeenCalled();
    expect(prismaMock.txJournalUpdateMany).not.toHaveBeenCalled();
  });

  it("checks all three public URLs then submits and locks only the current attempt journals", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    const dependencies = reachableDependencies();

    await submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }, dependencies);

    expect(dependencies.checkEvidenceUrl).toHaveBeenCalledTimes(3);
    expect(prismaMock.txSubmissionUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "sub-1",
        tenantId: "tenant-1",
        applicantId: "user-1",
        status: { in: ["DRAFT", "NEEDS_REVISION"] }
      },
      data: expect.objectContaining({ status: "SUBMITTED", submittedAt: expect.any(Date) })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "submission.submitted" })
    });
    expect(prismaMock.txJournalUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "user-1",
        missionAssignmentId: "assignment-1",
        lockedAt: null
      },
      data: { lockedAt: expect.any(Date) }
    });
    expect(prismaMock.submissionFindFirst).toHaveBeenCalledWith({
      where: { id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }
    });
    expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "assignment-1", tenantId: "tenant-1", applicantId: "user-1", status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] } },
      data: { status: "PENDING_EVALUATION" }
    });
  });

  it("checks every deployment URL before submitting", async () => {
    const submission = {
      ...submittableSubmission(),
      deploymentUrl: "https://app.example.com/;https://api.example.com/"
    };
    const readiness = readyReadiness({
      deploymentUrls: ["https://app.example.com/", "https://api.example.com/"]
    });
    prismaMock.submissionFindFirst.mockResolvedValue(submission);
    readinessMock.getReadiness.mockResolvedValue(readiness);
    readinessMock.getReadinessWithClient.mockResolvedValue(readiness);
    const dependencies = reachableDependencies();

    await submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }, dependencies);

    expect(dependencies.checkEvidenceUrl).toHaveBeenCalledTimes(4);
    expect(dependencies.checkEvidenceUrl).toHaveBeenCalledWith("https://app.example.com/", "deployment");
    expect(dependencies.checkEvidenceUrl).toHaveBeenCalledWith("https://api.example.com/", "deployment");
    expect(prismaMock.txSubmissionUpdateMany).toHaveBeenCalled();
    expect(prismaMock.txJournalUpdateMany).toHaveBeenCalled();
  });

  it("does not submit or lock journals when one of several deployment URLs is unreachable", async () => {
    const failingUrl = "https://api.example.com/";
    const readiness = readyReadiness({
      deploymentUrls: ["https://app.example.com/", failingUrl]
    });
    prismaMock.submissionFindFirst.mockResolvedValue({
      ...submittableSubmission(),
      deploymentUrl: `https://app.example.com/;${failingUrl}`
    });
    readinessMock.getReadiness.mockResolvedValue(readiness);
    const dependencies = reachableDependencies();
    dependencies.checkEvidenceUrl.mockImplementation(async (url: string) => ({
      reachable: url !== failingUrl,
      finalUrl: url,
      statusCode: url === failingUrl ? 503 : 200,
      error: url === failingUrl ? "Deployed application is not publicly reachable (HTTP 503)." : null
    }));

    await expect(
      submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }, dependencies)
    ).rejects.toThrow(failingUrl);
    expect(prismaMock.transaction).not.toHaveBeenCalled();
    expect(prismaMock.txSubmissionUpdateMany).not.toHaveBeenCalled();
    expect(prismaMock.txJournalUpdateMany).not.toHaveBeenCalled();
  });

  it("marks the assignment LATE_SUBMITTED when submitted after the deadline but within the grace period", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-22T00:00:00.000Z")); // between deadlineAt (07-21) and graceEndsAt (07-22 + defaults)
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      status: "OVERDUE",
      deadlineAt: new Date("2026-07-21T00:00:00.000Z"),
      graceEndsAt: new Date("2026-07-23T00:00:00.000Z")
    });
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "DRAFT",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1",
      repositoryUrl: "https://github.com/u/r",
      deploymentUrl: null,
      loomUrl: null
    });

    await submitSubmission(
      { id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" },
      reachableDependencies()
    );

    expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "assignment-1", tenantId: "tenant-1", applicantId: "user-1", status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] } },
      data: { status: "LATE_SUBMITTED" }
    });
    vi.useRealTimers();
  });

  it("rejects a submission attempted after the grace period has passed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T00:00:00.000Z")); // after graceEndsAt
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      status: "OVERDUE",
      deadlineAt: new Date("2026-07-21T00:00:00.000Z"),
      graceEndsAt: new Date("2026-07-23T00:00:00.000Z")
    });
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "DRAFT",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1",
      repositoryUrl: "https://github.com/u/r",
      deploymentUrl: null,
      loomUrl: null
    });

    await expect(
      submitSubmission(
        { id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" },
        reachableDependencies()
      )
    ).rejects.toThrow("deadline and grace period");
    expect(prismaMock.txSubmissionUpdate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("rejects a submission when the assignment has already been marked FAILED", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      status: "FAILED",
      deadlineAt: new Date("2026-07-21T00:00:00.000Z"),
      graceEndsAt: new Date("2026-07-23T00:00:00.000Z")
    });
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "DRAFT",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1",
      repositoryUrl: "https://github.com/u/r",
      deploymentUrl: null,
      loomUrl: null
    });

    await expect(
      submitSubmission(
        { id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" },
        reachableDependencies()
      )
    ).rejects.toThrow("deadline and grace period");
  });

  it("rejects submitting for review until Tasks 1 & 2 (Review Brief, Study Tutorial) are complete", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    prismaMock.txMissionTaskCompletionFindMany.mockResolvedValue([{ taskIndex: 1 }]); // Task 2 missing
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "DRAFT",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1",
      repositoryUrl: "https://github.com/u/r",
      deploymentUrl: null,
      loomUrl: null
    });

    await expect(
      submitSubmission(
        { id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" },
        reachableDependencies()
      )
    ).rejects.toThrow("Complete the mission tasks");
    expect(prismaMock.txSubmissionUpdate).not.toHaveBeenCalled();
  });

  it("does not submit or lock journals when a public URL check fails", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    const dependencies = reachableDependencies();
    dependencies.checkEvidenceUrl.mockResolvedValueOnce({
      reachable: false,
      finalUrl: "https://github.com/u/r",
      statusCode: 404,
      error: "GitHub repository is not publicly reachable (HTTP 404)."
    });
    await expect(
      submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }, dependencies)
    ).rejects.toThrow("not publicly reachable");
    expect(prismaMock.transaction).not.toHaveBeenCalled();
    expect(prismaMock.txJournalUpdateMany).not.toHaveBeenCalled();
  });

  it("guards concurrent submission attempts with a status-scoped update", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue(submittableSubmission());
    prismaMock.txSubmissionUpdateMany.mockResolvedValue({ count: 0 });
    await expect(
      submitSubmission({ id: "sub-1", tenantId: "tenant-1", applicantId: "user-1" }, reachableDependencies())
    ).rejects.toThrow("already processed");
    expect(prismaMock.txJournalUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects submitting from a non-editable status", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue({
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
      reviewerUserId: "lead-1",
      rating: null
    });

    expect(prismaMock.txSubmissionUpdateMany).toHaveBeenCalledWith({
      where: { id: "sub-1", tenantId: "tenant-1", status: "SUBMITTED" },
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

  // Review history (v0.20.0): one Submission row is reused across the revision loop, so without an
  // append-only history "accepted first time" and "accepted after two rounds" are indistinguishable.
  describe("review history", () => {
    const reviewable = () => ({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      applicantId: "user-1",
      missionAssignmentId: "assignment-1",
      mission: { id: "mission-1", title: "Build a Landing Page" },
      missionAssignment: {
        id: "assignment-1",
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "user-1",
        missionId: "mission-1",
        weekNumber: 2,
        attemptNumber: 1
      }
    });

    it("appends round 1 and records ACCEPTED_FIRST_TIME when accepted with no prior changes", async () => {
      prismaMock.txSubmissionFindFirst.mockResolvedValue(reviewable());
      prismaMock.txSubmissionReviewFindMany.mockResolvedValue([]);

      await reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "ACCEPTED",
        reviewerFeedback: "Great work.",
        reviewerUserId: "lead-1",
        rating: 4
      });

      expect(prismaMock.txSubmissionReviewCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          submissionId: "sub-1",
          missionAssignmentId: "assignment-1",
          weekNumber: 2,
          attemptNumber: 1,
          round: 1,
          decision: "ACCEPTED",
          feedback: "Great work.",
          reviewerUserId: "lead-1"
        }
      });
      expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PASSED", reviewOutcome: "ACCEPTED_FIRST_TIME", revisionCount: 0 }
        })
      );
    });

    it("records ACCEPTED_AFTER_CHANGES and keeps the revision count when an earlier round asked for changes", async () => {
      prismaMock.txSubmissionFindFirst.mockResolvedValue(reviewable());
      prismaMock.txSubmissionReviewFindMany.mockResolvedValue([{ decision: "CHANGES_REQUESTED" }]);

      await reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "ACCEPTED",
        reviewerFeedback: "Fixed, thanks.",
        reviewerUserId: "lead-1",
        rating: 4.0
      });

      expect(prismaMock.txSubmissionReviewCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ round: 2, decision: "ACCEPTED" })
      });
      expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "PASSED", reviewOutcome: "ACCEPTED_AFTER_CHANGES", revisionCount: 1 }
        })
      );
    });

    it("counts a change request and marks the attempt CHANGES_REQUESTED", async () => {
      prismaMock.txSubmissionFindFirst.mockResolvedValue(reviewable());
      prismaMock.txSubmissionReviewFindMany.mockResolvedValue([]);

      await reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "NEEDS_REVISION",
        reviewerFeedback: "Journal entries predate the mission start.",
        reviewerUserId: "lead-1",
        rating: null
      });

      expect(prismaMock.txSubmissionReviewCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          round: 1,
          decision: "CHANGES_REQUESTED",
          feedback: "Journal entries predate the mission start."
        })
      });
      expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "IN_PROGRESS", reviewOutcome: "CHANGES_REQUESTED", revisionCount: 1 }
        })
      );
    });

    it("marks the attempt REPEATED and preserves the reason", async () => {
      prismaMock.txSubmissionFindFirst.mockResolvedValue(reviewable());
      prismaMock.txSubmissionReviewFindMany.mockResolvedValue([{ decision: "CHANGES_REQUESTED" }]);
      prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ id: "assignment-1" });
      prismaMock.txMissionFindMany.mockResolvedValue([]);

      await reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "REPEAT",
        reviewerFeedback: "Repo code and journal entries are stale.",
        reviewerUserId: "lead-1",
        rating: null
      });

      expect(prismaMock.txSubmissionReviewCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          round: 2,
          decision: "REPEAT",
          feedback: "Repo code and journal entries are stale."
        })
      });
      expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "REPEAT", reviewOutcome: "REPEATED", revisionCount: 1 }
        })
      );
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
      reviewerUserId: "lead-1",
      rating: 4
    });

    expect(prismaMock.txNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "SUCCESS", title: "Mission accepted: Build a Landing Page" })
    });
  });

  it("closes a repeated attempt and creates exactly one alternate same-week assignment attempt", async () => {
    const assignment = {
      id: "assignment-1",
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "user-1",
      missionId: "mission-1",
      weekNumber: 3,
      attemptNumber: 1
    };
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1",
      applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" },
      missionAssignment: assignment
    });
    // 1st call: "latest overall attempt" guard. 2nd call: latest same-week attempt for the next attemptNumber.
    prismaMock.txMissionAssignmentFindFirst
      .mockResolvedValueOnce({ id: "assignment-1" })
      .mockResolvedValueOnce({ attemptNumber: 1 });
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-alt", title: "Alt Mission", order: 1 }]);

    await reviewSubmission({
      id: "sub-1",
      tenantId: "tenant-1",
      status: "REPEAT",
      reviewerFeedback: "Repeat Week 3 with a fresh attempt.",
      reviewerUserId: "lead-1",
      rating: null
    });

    expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "assignment-1", tenantId: "tenant-1", applicantId: "user-1" },
      // v0.20.0 also stamps the attempt's review outcome for evaluation rollups.
      data: { status: "REPEAT", reviewOutcome: "REPEATED", revisionCount: 0 }
    });
    // Repeats the same week (3) with a different mission — never resets back to week one.
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledTimes(1);
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "user-1",
        missionId: "mission-alt",
        weekNumber: 3,
        attemptNumber: 2,
        status: "NOT_STARTED"
      }
    });
  });

  it("does not auto-advance the week when the decision is REPEAT", async () => {
    const assignment = {
      id: "assignment-1",
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "user-1",
      missionId: "mission-1",
      weekNumber: 1,
      attemptNumber: 1
    };
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      missionAssignmentId: "assignment-1",
      applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" },
      missionAssignment: assignment
    });
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValueOnce({ id: "assignment-1" }).mockResolvedValueOnce(null);
    prismaMock.txMissionFindMany.mockResolvedValue([]); // no alternate week-1 mission

    await reviewSubmission({
      id: "sub-1",
      tenantId: "tenant-1",
      status: "REPEAT",
      reviewerFeedback: "n/a",
      reviewerUserId: "lead-1",
      rating: null
    });

    // assignWeekMissionToAcceptedApplicantTx (auto-advance) is never invoked on REPEAT.
    expect(prismaMock.txApplicationUpdateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.txApplicationUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", applicantId: "user-1", status: "ACCEPTED" },
      data: { status: "AWAITING_MISSION_ASSIGNMENT" }
    });
  });

  it("auto-advances to the next week when a submission is ACCEPTED, unless already at the final week", async () => {
    const assignment = {
      id: "assignment-1",
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "user-1",
      missionId: "mission-1",
      weekNumber: 2,
      attemptNumber: 1
    };
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" },
      missionAssignment: assignment
    });
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "application-1" });
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null); // no existing week-3 assignment yet
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-w3", title: "Week 3 Mission", order: 1 }]);

    await reviewSubmission({
      id: "sub-1",
      tenantId: "tenant-1",
      status: "ACCEPTED",
      reviewerFeedback: "Nice work.",
      reviewerUserId: "lead-1",
      rating: 4
    });

    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ weekNumber: 3, attemptNumber: 1, status: "NOT_STARTED" })
    });
  });

  it("does not assign a Week 5 when accepting the final Week 4 submission (fixed four-week program)", async () => {
    const assignment = {
      id: "assignment-1",
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "user-1",
      missionId: "mission-1",
      weekNumber: 4,
      attemptNumber: 1
    };
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" },
      missionAssignment: assignment
    });

    await reviewSubmission({
      id: "sub-1",
      tenantId: "tenant-1",
      status: "ACCEPTED",
      reviewerFeedback: "Program complete!",
      reviewerUserId: "lead-1",
      rating: 5.0
    });

    expect(prismaMock.txApplicationFindFirst).not.toHaveBeenCalled();
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });

  it("auto-publishes a graduate profile with the real average rating (not a placeholder 0)", async () => {
    const assignment = {
      id: "assignment-1", tenantId: "tenant-1", programId: "program-1",
      applicantId: "user-1", missionId: "mission-1", weekNumber: 4, attemptNumber: 1
    };
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1", status: "SUBMITTED", missionId: "mission-1", applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" },
      missionAssignment: assignment
    });
    const reviewedAt = new Date("2026-08-01T10:00:00Z");
    const rich = [
      { id: "s1", rating: 4, reviewedAt, submittedAt: reviewedAt, updatedAt: reviewedAt, mission: { id: "m1", title: "M1", programId: "program-1", program: { name: "Program 1" } } },
      { id: "s2", rating: 5, reviewedAt, submittedAt: reviewedAt, updatedAt: reviewedAt, mission: { id: "m2", title: "M2", programId: "program-1", program: { name: "Program 1" } } },
      { id: "s3", rating: 3, reviewedAt, submittedAt: reviewedAt, updatedAt: reviewedAt, mission: { id: "m3", title: "M3", programId: "program-1", program: { name: "Program 1" } } },
      { id: "s4", rating: 4, reviewedAt, submittedAt: reviewedAt, updatedAt: reviewedAt, mission: { id: "m4", title: "M4", programId: "program-1", program: { name: "Program 1" } } }
    ];
    prismaMock.txSubmissionFindMany.mockImplementation((args) => {
      // getCompletionSnapshot selects mission.program; the auto-publish count only selects programId.
      if (args?.select?.mission?.select?.program) return Promise.resolve(rich);
      return Promise.resolve([
        { mission: { programId: "program-1" } },
        { mission: { programId: "program-1" } },
        { mission: { programId: "program-1" } },
        { mission: { programId: "program-1" } }
      ]);
    });

    await reviewSubmission({
      id: "sub-1", tenantId: "tenant-1", status: "ACCEPTED",
      reviewerFeedback: "Program complete!", reviewerUserId: "lead-1", rating: 4
    });

    expect(prismaMock.txGraduateProfileUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", consentStatus: "ACKNOWLEDGED", publicProfileEnabled: false },
      data: {
        publicProfileEnabled: true,
        programId: "program-1",
        graduationDate: reviewedAt,
        overallRating: 4 // average of the four accepted week ratings (4, 5, 3, 4)
      }
    });
  });

  it("refuses to review a submission that is not SUBMITTED (double-review guard)", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "ACCEPTED",
      mission: { id: "mission-1", title: "X" }
    });
    // The real status-scoped updateMany would match 0 rows here since status is already ACCEPTED,
    // not SUBMITTED; the fully-mocked Prisma client doesn't filter by `where`, so simulate that.
    prismaMock.txSubmissionUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "NEEDS_REVISION",
        reviewerFeedback: "n/a",
        reviewerUserId: "lead-1",
        rating: null
      })
    ).rejects.toThrow("Invalid submission status transition");
    expect(prismaMock.txNotificationCreate).not.toHaveBeenCalled();
  });

  it("guards concurrent review attempts with a status-scoped update (double-click / two tabs)", async () => {
    prismaMock.txSubmissionFindFirst.mockResolvedValue({
      id: "sub-1",
      status: "SUBMITTED",
      missionId: "mission-1",
      applicantId: "user-1",
      mission: { id: "mission-1", title: "Build a Landing Page" }
    });
    // Simulates a concurrent reviewer already having won the race and committed first.
    prismaMock.txSubmissionUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "ACCEPTED",
        reviewerFeedback: "Great work.",
        reviewerUserId: "lead-1",
        rating: 4
      })
    ).rejects.toThrow("Invalid submission status transition");
    expect(prismaMock.txSubmissionReviewCreate).not.toHaveBeenCalled();
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
        reviewerUserId: "lead-1",
        rating: 4
      })
    ).rejects.toThrow("Submission not found for this tenant.");
  });

  it("rejects a decimal rating when accepting (rating must be a whole number 1-5)", async () => {
    await expect(
      reviewSubmission({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "ACCEPTED",
        reviewerFeedback: "Great work.",
        reviewerUserId: "lead-1",
        rating: 4.5
      })
    ).rejects.toThrow("whole-number rating from 1 to 5");
    expect(prismaMock.txSubmissionUpdateMany).not.toHaveBeenCalled();
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

function submittableSubmission() {
  return {
    id: "sub-1",
    status: "DRAFT",
    missionId: "mission-1",
    missionAssignmentId: "assignment-1",
    repositoryUrl: "https://github.com/u/r",
    deploymentUrl: "https://app.example.com/",
    loomUrl: "https://www.loom.com/share/demo"
  };
}

function readyReadiness(options?: { deploymentUrls?: string[] }) {
  const deploymentUrls = options?.deploymentUrls ?? ["https://app.example.com/"];
  return {
    ready: true,
    assignment: {
      id: "assignment-1",
      missionId: "mission-1",
      programId: "program-1",
      weekNumber: 1,
      attemptNumber: 1,
      status: "ACCEPTED"
    },
    submission: { id: "sub-1", status: "DRAFT" },
    tasks: { required: 3, completed: 3, incomplete: [] },
    journals: { required: 4, completed: 4 },
    urls: {
      repository: {
        present: true,
        validFormat: true,
        value: "https://github.com/u/r",
        reachable: null,
        statusCode: null,
        error: null
      },
      deployment: {
        present: true,
        validFormat: true,
        value: deploymentUrls.join(";"),
        count: deploymentUrls.length,
        values: deploymentUrls,
        reachability: deploymentUrls.map((url) => ({
          value: url,
          validFormat: true,
          reachable: null,
          statusCode: null,
          error: null
        })),
        error: null
      },
      loom: {
        present: true,
        validFormat: true,
        value: "https://www.loom.com/share/demo",
        reachable: null,
        statusCode: null,
        error: null
      }
    },
    blockers: []
  };
}

function reachableDependencies() {
  return {
    checkEvidenceUrl: vi.fn().mockResolvedValue({
      reachable: true,
      finalUrl: "https://example.com/",
      statusCode: 200,
      error: null
    })
  };
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
      include: { mission: { select: { id: true, title: true, weekNumber: true, order: true } } },
      orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
    });
  });

  it("counts only ACCEPTED submissions and advances the current mission past them", async () => {
    prismaMock.missionAssignmentFindMany.mockResolvedValue(asAssignments(missions));
    prismaMock.submissionFindMany.mockResolvedValue([
      { id: "s1", missionId: "m1", missionAssignmentId: "a-m1", status: "ACCEPTED", submittedAt: new Date() },
      { id: "s2", missionId: "m2", missionAssignmentId: "a-m2", status: "SUBMITTED", submittedAt: new Date() }
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
      missions.map((m, i) => ({
        id: `s${i}`,
        missionId: m.id,
        missionAssignmentId: `a-${m.id}`,
        status: "ACCEPTED",
        submittedAt: new Date()
      }))
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
  return missions.map((mission) => ({
    id: `a-${mission.id}`,
    weekNumber: mission.weekNumber,
    attemptNumber: 1,
    mission
  }));
}

describe("listSubmissionReviewHistory", () => {
  beforeEach(() => {
    prismaMock.submissionReviewFindMany.mockReset();
  });

  it("returns rounds oldest first, scoped to the tenant and attempt", async () => {
    prismaMock.submissionReviewFindMany.mockResolvedValue([
      {
        round: 1,
        decision: "CHANGES_REQUESTED",
        feedback: "Journals are stale.",
        createdAt: new Date("2026-08-01T10:00:00.000Z"),
        reviewer: { name: "Tech Lead", email: "lead@demo.local" }
      },
      {
        round: 2,
        decision: "ACCEPTED",
        feedback: "Resolved.",
        createdAt: new Date("2026-08-02T10:00:00.000Z"),
        reviewer: { name: null, email: "admin@demo.local" }
      }
    ]);

    const history = await listSubmissionReviewHistory({
      tenantId: "tenant-1",
      missionAssignmentId: "assignment-1"
    });

    expect(prismaMock.submissionReviewFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: "tenant-1", missionAssignmentId: "assignment-1" },
        orderBy: { round: "asc" }
      })
    );
    expect(history.map((entry) => entry.decision)).toEqual(["CHANGES_REQUESTED", "ACCEPTED"]);
    expect(history[0].feedback).toBe("Journals are stale.");
    // Falls back to email when the reviewer has no display name.
    expect(history[1].reviewerName).toBe("admin@demo.local");
  });

  it("returns an empty history for an attempt that was never reviewed", async () => {
    prismaMock.submissionReviewFindMany.mockResolvedValue([]);
    await expect(
      listSubmissionReviewHistory({ tenantId: "tenant-1", missionAssignmentId: "assignment-1" })
    ).resolves.toEqual([]);
  });
});
