import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
const mocks = vi.hoisted(() => ({
  requireTenantAccess: vi.fn(),
  listApplicantApplications: vi.fn(),
  getAssignedProgramMission: vi.fn(),
  getLatestMissionAssignmentForMission: vi.fn(),
  acceptMissionAssignment: vi.fn(),
  saveSubmissionDraft: vi.fn(),
  submitSubmission: vi.fn(),
  parseEvidenceUrl: vi.fn(),
  normalizeDeploymentUrls: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn()
}));

vi.mock("@/lib/tenant-guard", () => ({
  requireTenantAccess: mocks.requireTenantAccess
}));

vi.mock("@talentos/db", () => ({
  acceptMissionAssignment: mocks.acceptMissionAssignment,
  getAssignedProgramMission: mocks.getAssignedProgramMission,
  getLatestMissionAssignmentForMission: mocks.getLatestMissionAssignmentForMission,
  listApplicantApplications: mocks.listApplicantApplications,
  normalizeDeploymentUrls: mocks.normalizeDeploymentUrls,
  parseEvidenceUrl: mocks.parseEvidenceUrl,
  saveSubmissionDraft: mocks.saveSubmissionDraft,
  submitSubmission: mocks.submitSubmission
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect
}));

import { acceptMissionAction, saveSubmissionAction } from "./actions";

const tenantCtx = { tenant: { id: "tenant-1", slug: "demo" }, actorUserId: "user-1" };

describe("acceptMissionAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.requireTenantAccess.mockResolvedValue(tenantCtx);
  });

  it("accepts an assigned mission and revalidates paths", async () => {
    mocks.getLatestMissionAssignmentForMission.mockResolvedValue({ id: "assignment-1" });
    mocks.acceptMissionAssignment.mockResolvedValue({});

    const result = await acceptMissionAction("mission-1", { ok: false, error: null }, new FormData());

    expect(result).toEqual({ ok: true, error: null });
    expect(mocks.acceptMissionAssignment).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      applicantId: "user-1",
      missionAssignmentId: "assignment-1"
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/missions/mission-1");
  });

  it("returns an error when the mission is not assigned", async () => {
    mocks.getLatestMissionAssignmentForMission.mockResolvedValue(null);

    const result = await acceptMissionAction("mission-x", { ok: false, error: null }, new FormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not assigned");
    expect(mocks.acceptMissionAssignment).not.toHaveBeenCalled();
  });

  it("returns an error when the user is not linked to the tenant", async () => {
    mocks.requireTenantAccess.mockResolvedValue({ tenant: { id: "tenant-1" }, actorUserId: null });

    const result = await acceptMissionAction("mission-1", { ok: false, error: null }, new FormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not linked");
  });

  it("catches and surfaces errors from acceptMissionAssignment", async () => {
    mocks.getLatestMissionAssignmentForMission.mockResolvedValue({ id: "assignment-1" });
    mocks.acceptMissionAssignment.mockRejectedValue(new Error("Only a NOT_STARTED assignment can be accepted."));

    const result = await acceptMissionAction("mission-1", { ok: false, error: null }, new FormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("NOT_STARTED");
  });
});

describe("saveSubmissionAction", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
    mocks.requireTenantAccess.mockResolvedValue(tenantCtx);
    mocks.parseEvidenceUrl.mockImplementation((v: string) => v || null);
    mocks.normalizeDeploymentUrls.mockReturnValue("");
  });

  it("saves a draft and revalidates when intent is not submit", async () => {
    mocks.listApplicantApplications.mockResolvedValue([
      { status: "ACCEPTED", program: { id: "program-1" } }
    ]);
    mocks.getAssignedProgramMission.mockResolvedValue({ id: "mission-1" });
    mocks.saveSubmissionDraft.mockResolvedValue({ id: "draft-1" });

    const formData = new FormData();
    formData.set("repositoryUrl", "https://github.com/u/r");
    formData.set("deploymentUrl", "");
    formData.set("loomUrl", "https://www.loom.com/share/abc");
    formData.set("intent", "save");

    const result = await saveSubmissionAction("mission-1", { ok: false, error: null }, formData);

    expect(result).toEqual({ ok: true, error: null });
    expect(mocks.saveSubmissionDraft).toHaveBeenCalled();
    expect(mocks.submitSubmission).not.toHaveBeenCalled();
  });

  it("saves and submits when intent is submit", async () => {
    mocks.listApplicantApplications.mockResolvedValue([
      { status: "ACCEPTED", program: { id: "program-1" } }
    ]);
    mocks.getAssignedProgramMission.mockResolvedValue({ id: "mission-1" });
    mocks.saveSubmissionDraft.mockResolvedValue({ id: "draft-1" });
    mocks.submitSubmission.mockResolvedValue({});

    const formData = new FormData();
    formData.set("repositoryUrl", "https://github.com/u/r");
    formData.set("deploymentUrl", "https://app.example.com");
    formData.set("loomUrl", "https://www.loom.com/share/abc");
    formData.set("intent", "submit");

    const result = await saveSubmissionAction("mission-1", { ok: false, error: null }, formData);

    expect(result).toEqual({ ok: true, error: null });
    expect(mocks.submitSubmission).toHaveBeenCalledWith({
      id: "draft-1",
      tenantId: "tenant-1",
      applicantId: "user-1"
    });
  });

  it("returns an error when no accepted application exists", async () => {
    mocks.listApplicantApplications.mockResolvedValue([
      { status: "SUBMITTED", program: { id: "program-1" } }
    ]);

    const result = await saveSubmissionAction("mission-1", { ok: false, error: null }, new FormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("accepted");
    expect(mocks.saveSubmissionDraft).not.toHaveBeenCalled();
  });

  it("returns an error when the mission is not assigned", async () => {
    mocks.listApplicantApplications.mockResolvedValue([
      { status: "ACCEPTED", program: { id: "program-1" } }
    ]);
    mocks.getAssignedProgramMission.mockResolvedValue(null);

    const result = await saveSubmissionAction("mission-x", { ok: false, error: null }, new FormData());

    expect(result.ok).toBe(false);
    expect(result.error).toContain("not assigned");
  });

  it("surfaces submission readiness errors to the user", async () => {
    mocks.listApplicantApplications.mockResolvedValue([
      { status: "ACCEPTED", program: { id: "program-1" } }
    ]);
    mocks.getAssignedProgramMission.mockResolvedValue({ id: "mission-1" });
    mocks.saveSubmissionDraft.mockResolvedValue({ id: "draft-1" });
    mocks.submitSubmission.mockRejectedValue(new Error("Complete all required tasks before submitting."));

    const formData = new FormData();
    formData.set("intent", "submit");

    const result = await saveSubmissionAction("mission-1", { ok: false, error: null }, formData);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("required tasks");
  });
});
