import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — mock @talentos/db so we don't need a real database
// ---------------------------------------------------------------------------

const dbMock = vi.hoisted(() => ({
  listApplicantApplications: vi.fn(),
  listProgramTasks: vi.fn(),
  listCompletedTaskIds: vi.fn(),
  listPublishedProgramMissions: vi.fn(),
  getApplicantProgramProgress: vi.fn(),
  prismaSubmissionFindMany: vi.fn(),
}));

vi.mock("@talentos/db", () => ({
  prisma: {
    submission: {
      findMany: dbMock.prismaSubmissionFindMany,
    },
  },
  listApplicantApplications: dbMock.listApplicantApplications,
  listProgramTasks: dbMock.listProgramTasks,
  listCompletedTaskIds: dbMock.listCompletedTaskIds,
  listPublishedProgramMissions: dbMock.listPublishedProgramMissions,
  getApplicantProgramProgress: dbMock.getApplicantProgramProgress,
}));

import { buildApplicantContext, contextToPromptSection } from "./ai-context";
import type { ApplicantContext } from "./ai-context";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const acceptedApplication = {
  id: "app-1",
  status: "ACCEPTED",
  program: {
    id: "prog-1",
    name: "Full-Stack Engineering Internship",
    slug: "fse",
    startsAt: new Date("2026-07-01"),
    endsAt: new Date("2026-09-30"),
  },
};

const programTasks = [
  { id: "task-1", title: "Build Landing Page", weekNumber: 1, dueAt: new Date("2026-07-10") },
  { id: "task-2", title: "Build REST API", weekNumber: 3, dueAt: new Date("2026-07-20") },
  { id: "task-3", title: "Write Tests", weekNumber: 3, dueAt: null },
];

const completedTaskIds = ["task-1"];

const missions = [
  { id: "m-1", title: "Frontend Fundamentals", weekNumber: 1, difficulty: "Beginner" },
  { id: "m-2", title: "API Development", weekNumber: 3, difficulty: "Intermediate" },
];

const weekProgress = [
  { weekNumber: 1, totalTasks: 1, completedTasks: 1, percentage: 100 },
  { weekNumber: 3, totalTasks: 2, completedTasks: 0, percentage: 0 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AI Context — buildApplicantContext", () => {
  beforeEach(() => {
    for (const mock of Object.values(dbMock)) {
      mock.mockReset();
    }
  });

  // UT-CTX-01: Build context with accepted application
  it("builds context with program, progress, tasks, missions", async () => {
    dbMock.listApplicantApplications.mockResolvedValue([acceptedApplication]);
    dbMock.listProgramTasks.mockResolvedValue(programTasks);
    dbMock.listCompletedTaskIds.mockResolvedValue(completedTaskIds);
    dbMock.listPublishedProgramMissions.mockResolvedValue(missions);
    dbMock.getApplicantProgramProgress.mockResolvedValue(weekProgress);
    dbMock.prismaSubmissionFindMany.mockResolvedValue([]);

    const ctx = await buildApplicantContext("t1", "u1");

    expect(ctx.tenantId).toBe("t1");
    expect(ctx.userId).toBe("u1");
    expect(ctx.program).not.toBeNull();
    expect(ctx.program!.name).toBe("Full-Stack Engineering Internship");
    expect(ctx.applicationStatus).toBe("ACCEPTED");
    expect(ctx.progress).not.toBeNull();
    expect(ctx.progress!.overallPercentage).toBe(33); // 1/3 ≈ 33%
    expect(ctx.progress!.completedTasks).toBe(1);
    expect(ctx.progress!.totalTasks).toBe(3);
    expect(ctx.upcomingTasks).toBeInstanceOf(Array);
    expect(ctx.upcomingTasks.length).toBe(2); // task-2 and task-3 (task-1 completed)
    expect(ctx.missions).toBeInstanceOf(Array);
    expect(ctx.missions.length).toBe(2);
    expect(ctx.submissions).toBeInstanceOf(Array);
    expect(ctx.daysRemaining).not.toBeNull();
  });

  // UT-CTX-02: Build context with no application
  it("returns safe fallback context when no accepted application", async () => {
    dbMock.listApplicantApplications.mockResolvedValue([]);

    const ctx = await buildApplicantContext("t1", "u1");

    expect(ctx.tenantId).toBe("t1");
    expect(ctx.userId).toBe("u1");
    expect(ctx.program).toBeNull();
    expect(ctx.applicationStatus).toBeNull();
    expect(ctx.progress).toBeNull();
    expect(ctx.upcomingTasks).toEqual([]);
    expect(ctx.missions).toEqual([]);
    expect(ctx.submissions).toEqual([]);
    expect(ctx.daysRemaining).toBeNull();
  });

  // UT-CTX-04: Tenant isolation — queries use tenantId + userId
  it("passes tenantId and userId to listApplicantApplications", async () => {
    dbMock.listApplicantApplications.mockResolvedValue([]);

    await buildApplicantContext("tenant-abc", "user-xyz");

    expect(dbMock.listApplicantApplications).toHaveBeenCalledWith("user-xyz", "tenant-abc");
  });

  it("passes tenantId and programId to listProgramTasks", async () => {
    dbMock.listApplicantApplications.mockResolvedValue([acceptedApplication]);
    dbMock.listProgramTasks.mockResolvedValue([]);
    dbMock.listCompletedTaskIds.mockResolvedValue([]);
    dbMock.listPublishedProgramMissions.mockResolvedValue([]);
    dbMock.getApplicantProgramProgress.mockResolvedValue([]);
    dbMock.prismaSubmissionFindMany.mockResolvedValue([]);

    await buildApplicantContext("tenant-abc", "user-xyz");

    expect(dbMock.listProgramTasks).toHaveBeenCalledWith("tenant-abc", "prog-1");
    expect(dbMock.listPublishedProgramMissions).toHaveBeenCalledWith("tenant-abc", "prog-1");
  });

  // Error resilience — never throws
  it("returns safe fallback when database throws", async () => {
    dbMock.listApplicantApplications.mockRejectedValue(new Error("DB down"));

    const ctx = await buildApplicantContext("t1", "u1");

    expect(ctx.program).toBeNull();
    expect(ctx.progress).toBeNull();
    expect(ctx.upcomingTasks).toEqual([]);
  });

  // Upcoming tasks filtering
  it("excludes completed tasks from upcomingTasks", async () => {
    dbMock.listApplicantApplications.mockResolvedValue([acceptedApplication]);
    dbMock.listProgramTasks.mockResolvedValue(programTasks);
    dbMock.listCompletedTaskIds.mockResolvedValue(completedTaskIds);
    dbMock.listPublishedProgramMissions.mockResolvedValue([]);
    dbMock.getApplicantProgramProgress.mockResolvedValue([]);
    dbMock.prismaSubmissionFindMany.mockResolvedValue([]);

    const ctx = await buildApplicantContext("t1", "u1");

    expect(ctx.upcomingTasks.every((t) => !t.completed)).toBe(true);
    expect(ctx.upcomingTasks.find((t) => t.id === "task-1")).toBeUndefined();
  });

  // Submissions
  it("includes submissions from the database", async () => {
    dbMock.listApplicantApplications.mockResolvedValue([acceptedApplication]);
    dbMock.listProgramTasks.mockResolvedValue([]);
    dbMock.listCompletedTaskIds.mockResolvedValue([]);
    dbMock.listPublishedProgramMissions.mockResolvedValue([]);
    dbMock.getApplicantProgramProgress.mockResolvedValue([]);
    dbMock.prismaSubmissionFindMany.mockResolvedValue([
      {
        missionId: "m-2",
        mission: { id: "m-2", title: "API Development", weekNumber: 3 },
        status: "SUBMITTED",
        submittedAt: new Date("2026-07-08"),
      },
    ]);

    const ctx = await buildApplicantContext("t1", "u1");

    expect(ctx.submissions.length).toBe(1);
    expect(ctx.submissions[0].missionTitle).toBe("API Development");
    expect(ctx.submissions[0].status).toBe("SUBMITTED");
  });
});

describe("AI Context — contextToPromptSection", () => {
  // UT-CTX-03: Context to prompt section
  it("formats context as markdown section with program name", () => {
    const ctx: ApplicantContext = {
      tenantId: "t1",
      userId: "u1",
      program: { id: "p1", name: "Full-Stack Engineering", slug: "fse", startsAt: null, endsAt: null },
      applicationStatus: "ACCEPTED",
      progress: {
        totalTasks: 10,
        completedTasks: 4,
        pendingTasks: 6,
        overallPercentage: 40,
        weeks: [],
      },
      upcomingTasks: [],
      missions: [],
      submissions: [],
      daysRemaining: 30,
    };

    const section = contextToPromptSection(ctx);

    expect(typeof section).toBe("string");
    expect(section).toContain("Full-Stack Engineering");
    expect(section).toContain("40%");
    expect(section).toContain("ACCEPTED");
    expect(section).toContain("Days Remaining: 30");
  });

  it("returns fallback message when no program", () => {
    const ctx: ApplicantContext = {
      tenantId: "t1",
      userId: "u1",
      program: null,
      applicationStatus: null,
      progress: null,
      upcomingTasks: [],
      missions: [],
      submissions: [],
      daysRemaining: null,
    };

    const section = contextToPromptSection(ctx);
    expect(section).toBe("No active program enrollment found.");
  });

  it("includes upcoming tasks in the prompt section", () => {
    const ctx: ApplicantContext = {
      tenantId: "t1",
      userId: "u1",
      program: { id: "p1", name: "Test Program", slug: "test", startsAt: null, endsAt: null },
      applicationStatus: "ACCEPTED",
      progress: null,
      upcomingTasks: [
        { id: "t1", title: "Build API", weekNumber: 3, dueAt: "2026-07-20T00:00:00Z", completed: false, overdue: false },
      ],
      missions: [],
      submissions: [],
      daysRemaining: null,
    };

    const section = contextToPromptSection(ctx);
    expect(section).toContain("Upcoming Tasks");
    expect(section).toContain("Build API");
  });

  it("includes missions in the prompt section", () => {
    const ctx: ApplicantContext = {
      tenantId: "t1",
      userId: "u1",
      program: { id: "p1", name: "Test Program", slug: "test", startsAt: null, endsAt: null },
      applicationStatus: "ACCEPTED",
      progress: null,
      upcomingTasks: [],
      missions: [{ id: "m1", title: "API Development", weekNumber: 3, difficulty: "Intermediate" }],
      submissions: [],
      daysRemaining: null,
    };

    const section = contextToPromptSection(ctx);
    expect(section).toContain("Missions");
    expect(section).toContain("API Development");
  });
});
