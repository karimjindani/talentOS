import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantAccess: vi.fn(),
  auth: vi.fn(),
  getTenantSubmission: vi.fn(),
  getUserByEmail: vi.fn(),
  reviewSubmission: vi.fn(),
  revalidatePath: vi.fn()
}));

vi.mock("@/lib/tenant-guard", () => ({
  requireTenantAccess: mocks.requireTenantAccess
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@talentos/db", () => ({
  getTenantSubmission: mocks.getTenantSubmission,
  getUserByEmail: mocks.getUserByEmail,
  reviewSubmission: mocks.reviewSubmission
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { reviewSubmissionAction } from "./submission-actions";

const tenantCtx = { tenant: { id: "tenant-1", slug: "demo" }, actorUserId: "reviewer-1" };

describe("reviewSubmissionAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.requireTenantAccess.mockResolvedValue(tenantCtx);
  });

  it("accepts a SUBMITTED submission with reviewer attribution", async () => {
    mocks.getTenantSubmission.mockResolvedValue({
      id: "sub-1",
      tenantId: "tenant-1",
      missionId: "mission-1",
      status: "SUBMITTED"
    });
    mocks.reviewSubmission.mockResolvedValue({});

    const formData = new FormData();
    formData.set("submissionId", "sub-1");
    formData.set("decision", "ACCEPTED");
    formData.set("rating", "4");
    formData.set("reviewerFeedback", "");

    await reviewSubmissionAction(formData);

    expect(mocks.reviewSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sub-1",
        tenantId: "tenant-1",
        status: "ACCEPTED",
        reviewerUserId: "reviewer-1"
      })
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/missions/mission-1");
  });

  it("requires feedback when requesting changes (NEEDS_REVISION)", async () => {
    const formData = new FormData();
    formData.set("submissionId", "sub-1");
    formData.set("decision", "NEEDS_REVISION");
    formData.set("reviewerFeedback", "");

    await expect(reviewSubmissionAction(formData)).rejects.toThrow("feedback");
    expect(mocks.reviewSubmission).not.toHaveBeenCalled();
  });

  it("requires feedback when assigning a repeat week", async () => {
    const formData = new FormData();
    formData.set("submissionId", "sub-1");
    formData.set("decision", "REPEAT");
    formData.set("reviewerFeedback", "");

    await expect(reviewSubmissionAction(formData)).rejects.toThrow("feedback");
  });

  it("accepts NEEDS_REVISION when feedback is provided", async () => {
    mocks.getTenantSubmission.mockResolvedValue({
      id: "sub-1",
      tenantId: "tenant-1",
      missionId: "mission-1",
      status: "SUBMITTED"
    });
    mocks.reviewSubmission.mockResolvedValue({});

    const formData = new FormData();
    formData.set("submissionId", "sub-1");
    formData.set("decision", "NEEDS_REVISION");
    formData.set("reviewerFeedback", "Please add more tests.");

    await reviewSubmissionAction(formData);

    expect(mocks.reviewSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ status: "NEEDS_REVISION", reviewerFeedback: "Please add more tests." })
    );
  });

  it("rejects an invalid decision value", async () => {
    const formData = new FormData();
    formData.set("submissionId", "sub-1");
    formData.set("decision", "INVALID");
    formData.set("reviewerFeedback", "");

    await expect(reviewSubmissionAction(formData)).rejects.toThrow("Invalid review decision");
  });

  it("throws when the submission does not exist in this tenant", async () => {
    mocks.getTenantSubmission.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("submissionId", "sub-missing");
    formData.set("decision", "ACCEPTED");
    formData.set("rating", "4");

    await expect(reviewSubmissionAction(formData)).rejects.toThrow("Submission not found");
  });

  it("backfills reviewer user id from email for SUPER_ADMIN without membership", async () => {
    mocks.requireTenantAccess.mockResolvedValue({ tenant: { id: "tenant-1" }, actorUserId: null });
    mocks.auth.mockResolvedValue({ user: { email: "superadmin@talentos.local" } });
    mocks.getUserByEmail.mockResolvedValue({ id: "superadmin-db" });
    mocks.getTenantSubmission.mockResolvedValue({
      id: "sub-1",
      tenantId: "tenant-1",
      missionId: "mission-1",
      status: "SUBMITTED"
    });
    mocks.reviewSubmission.mockResolvedValue({});

    const formData = new FormData();
    formData.set("submissionId", "sub-1");
    formData.set("decision", "ACCEPTED");
    formData.set("rating", "4");

    await reviewSubmissionAction(formData);

    expect(mocks.reviewSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ reviewerUserId: "superadmin-db" })
    );
  });

  it("throws when the reviewer has no DB user row", async () => {
    mocks.requireTenantAccess.mockResolvedValue({ tenant: { id: "tenant-1" }, actorUserId: null });
    mocks.auth.mockResolvedValue({ user: { email: "nobody@talentos.local" } });
    mocks.getUserByEmail.mockResolvedValue(null);

    const formData = new FormData();
    formData.set("submissionId", "sub-1");
    formData.set("decision", "ACCEPTED");

    await expect(reviewSubmissionAction(formData)).rejects.toThrow("not linked");
  });
});
