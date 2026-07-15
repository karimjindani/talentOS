import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  assignmentFindFirst: vi.fn(),
  applicationFindFirst: vi.fn(),
  submissionFindFirst: vi.fn(),
  taskFindMany: vi.fn(),
  completionFindMany: vi.fn(),
  journalCount: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    missionAssignment: { findFirst: prismaMock.assignmentFindFirst },
    application: { findFirst: prismaMock.applicationFindFirst },
    submission: { findFirst: prismaMock.submissionFindFirst },
    programTask: { findMany: prismaMock.taskFindMany },
    userTaskCompletion: { findMany: prismaMock.completionFindMany },
    engineeringJournalEntry: { count: prismaMock.journalCount }
  }
}));

import { getMissionSubmissionReadiness, REQUIRED_JOURNAL_ENTRY_COUNT } from "./submission-readiness";

describe("mission submission readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.assignmentFindFirst.mockResolvedValue({
      id: "assignment-2",
      tenantId: "tenant-1",
      applicantId: "applicant-1",
      missionId: "mission-1",
      programId: "program-1",
      weekNumber: 1,
      attemptNumber: 2,
      status: "ACTIVE"
    });
    prismaMock.applicationFindFirst.mockResolvedValue({ id: "application-1" });
    prismaMock.submissionFindFirst.mockResolvedValue({
      id: "submission-2",
      status: "DRAFT",
      repositoryUrl: "https://github.com/acme/project",
      deploymentUrl: "https://app.example.com/",
      loomUrl: "https://www.loom.com/share/demo"
    });
    prismaMock.taskFindMany.mockResolvedValue([
      { id: "task-1", title: "Environment Setup" },
      { id: "task-2", title: "Git and GitHub Basics" }
    ]);
    prismaMock.completionFindMany.mockResolvedValue([{ taskId: "task-1" }, { taskId: "task-2" }]);
    prismaMock.journalCount.mockResolvedValue(REQUIRED_JOURNAL_ENTRY_COUNT);
  });

  it("loads required tasks by tenant, program and week rather than mission", async () => {
    const readiness = await getMissionSubmissionReadiness(input(), new Date("2026-07-16T12:00:00Z"));
    expect(readiness.ready).toBe(true);
    expect(prismaMock.taskFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        programId: "program-1",
        weekNumber: 1,
        published: true,
        required: true
      },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }]
    });
    expect(prismaMock.taskFindMany.mock.calls[0][0].where).not.toHaveProperty("missionId");
  });

  it("counts only completions for this tenant, applicant and week tasks", async () => {
    await getMissionSubmissionReadiness(input());
    expect(prismaMock.completionFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        userId: "applicant-1",
        taskId: { in: ["task-1", "task-2"] },
        task: { tenantId: "tenant-1", programId: "program-1", weekNumber: 1 }
      },
      select: { taskId: true }
    });
  });

  it("blocks incomplete required tasks and fewer than four current-attempt journals", async () => {
    prismaMock.completionFindMany.mockResolvedValue([{ taskId: "task-1" }]);
    prismaMock.journalCount.mockResolvedValue(3);
    const readiness = await getMissionSubmissionReadiness(input());
    expect(readiness.ready).toBe(false);
    expect(readiness.tasks.incomplete).toEqual([{ id: "task-2", title: "Git and GitHub Basics" }]);
    expect(readiness.journals).toEqual({ required: 4, completed: 3 });
    expect(readiness.blockers.join(" ")).toContain("3 of 4");
  });

  it("isolates journal counts to the exact assignment and excludes future entry dates", async () => {
    await getMissionSubmissionReadiness(input(), new Date("2026-07-16T23:00:00Z"));
    expect(prismaMock.journalCount).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        applicantId: "applicant-1",
        missionAssignmentId: "assignment-2",
        entryDate: { lte: new Date("2026-07-17T00:00:00.000Z") }
      }
    });
  });

  it("keeps week task completion reusable on a repeat while requiring new attempt journals", async () => {
    const readiness = await getMissionSubmissionReadiness(input());
    expect(readiness.tasks.completed).toBe(2);
    expect(prismaMock.completionFindMany.mock.calls[0][0].where).not.toHaveProperty("missionAssignmentId");
    expect(prismaMock.journalCount.mock.calls[0][0].where.missionAssignmentId).toBe("assignment-2");
  });

  it("requires all three valid submission URLs", async () => {
    prismaMock.submissionFindFirst.mockResolvedValue({
      id: "submission-2",
      status: "DRAFT",
      repositoryUrl: "https://github.com/acme/project",
      deploymentUrl: null,
      loomUrl: "https://www.loom.com/not-a-share"
    });
    const readiness = await getMissionSubmissionReadiness(input());
    expect(readiness.ready).toBe(false);
    expect(readiness.urls.deployment.present).toBe(false);
    expect(readiness.urls.loom.validFormat).toBe(false);
  });

  it("rejects an assignment from another tenant or applicant", async () => {
    prismaMock.assignmentFindFirst.mockResolvedValue(null);
    await expect(getMissionSubmissionReadiness(input())).rejects.toThrow("not found for this applicant and tenant");
    expect(prismaMock.assignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: "tenant-1", applicantId: "applicant-1" })
    }));
  });
});

function input() {
  return { tenantId: "tenant-1", applicantId: "applicant-1", missionAssignmentId: "assignment-2" };
}
