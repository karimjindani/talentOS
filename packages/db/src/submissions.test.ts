import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  submissionFindFirst: vi.fn(),
  submissionFindMany: vi.fn(),
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
    $transaction: prismaMock.transaction
  }
}));

import {
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
      where: { id: "mission-1", tenantId: "tenant-1", status: "PUBLISHED" },
      select: { id: true }
    });
    expect(prismaMock.txSubmissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-1", applicantId: "user-1", status: "DRAFT" })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "submission.created", entityType: "Submission" })
    });
  });

  it("rejects drafts for missions outside the tenant or not published", async () => {
    prismaMock.txMissionFindFirst.mockResolvedValue(null);
    await expect(saveSubmissionDraft(draftInput())).rejects.toThrow("Mission not found for this tenant.");
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
