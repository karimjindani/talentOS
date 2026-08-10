import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  programTaskFindMany: vi.fn(),
  videoResourceFindMany: vi.fn(),
  calendarEventFindMany: vi.fn(),
  notificationFindMany: vi.fn(),
  notificationCount: vi.fn(),
  notificationUpdateMany: vi.fn(),
  notificationCreate: vi.fn(),
  userTaskCompletionFindMany: vi.fn(),
  transaction: vi.fn(),
  txAssignmentFindFirst: vi.fn(),
  txApplicationFindFirst: vi.fn(),
  txTaskFindFirst: vi.fn(),
  txCompletionUpsert: vi.fn(),
  txAuditCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    programTask: { findMany: prismaMock.programTaskFindMany },
    videoResource: { findMany: prismaMock.videoResourceFindMany },
    calendarEvent: { findMany: prismaMock.calendarEventFindMany },
    notification: {
      findMany: prismaMock.notificationFindMany,
      count: prismaMock.notificationCount,
      updateMany: prismaMock.notificationUpdateMany,
      create: prismaMock.notificationCreate
    },
    userTaskCompletion: { findMany: prismaMock.userTaskCompletionFindMany },
    $transaction: prismaMock.transaction
  }
}));

import {
  countUnreadNotifications,
  createNotification,
  getApplicantProgramProgress,
  listCalendarEvents,
  listCompletedTaskIds,
  listProgramTasks,
  listTasksByWeek,
  listUserNotifications,
  listVideoResources,
  markApplicantTaskCompleted,
  markNotificationRead
} from "./dashboard";

describe("dashboard helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.transaction.mockImplementation(async (callback) => callback({
      missionAssignment: { findFirst: prismaMock.txAssignmentFindFirst },
      application: { findFirst: prismaMock.txApplicationFindFirst },
      programTask: { findFirst: prismaMock.txTaskFindFirst },
      userTaskCompletion: { upsert: prismaMock.txCompletionUpsert },
      auditLog: { create: prismaMock.txAuditCreate }
    }));
    prismaMock.txAssignmentFindFirst.mockResolvedValue({ id: "assignment-1", programId: "program-1", weekNumber: 1 });
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "application-1" });
    prismaMock.txTaskFindFirst.mockResolvedValue({ id: "task-1" });
    prismaMock.txCompletionUpsert.mockResolvedValue({ id: "completion-1" });
    prismaMock.txAuditCreate.mockResolvedValue({ id: "audit-1" });
  });

  it("lists program tasks in stable week/order order with tenant-scoped resources", async () => {
    prismaMock.programTaskFindMany.mockResolvedValue([]);
    await listProgramTasks("tenant-1", "program-1");
    expect(prismaMock.programTaskFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1" },
      include: {
        resources: {
          where: { tenantId: "tenant-1" },
          include: { file: { select: { id: true, originalName: true, contentType: true } } },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }]
        }
      },
      orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { createdAt: "asc" }]
    });
  });

  it("lists applicant-visible tasks by program week, never by mission", async () => {
    prismaMock.programTaskFindMany.mockResolvedValue([]);
    await listTasksByWeek("tenant-1", "program-1", 2);
    const query = prismaMock.programTaskFindMany.mock.calls[0][0];
    expect(query.where).toEqual({ tenantId: "tenant-1", programId: "program-1", weekNumber: 2, published: true });
    expect(query.where).not.toHaveProperty("missionId");
    expect(query.orderBy).toEqual([{ order: "asc" }, { createdAt: "asc" }]);
  });

  it("lists Markdown and YouTube resources tenant-scoped and ordered", async () => {
    prismaMock.videoResourceFindMany.mockResolvedValue([]);
    await listVideoResources("tenant-1", "program-1", 1);
    expect(prismaMock.videoResourceFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", weekNumber: 1 },
      include: {
        task: { select: { id: true, title: true, weekNumber: true } },
        file: { select: { id: true, originalName: true, contentType: true } }
      },
      orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { createdAt: "asc" }]
    });
  });

  it("scopes completed task IDs by tenant, applicant, program and week", async () => {
    prismaMock.userTaskCompletionFindMany.mockResolvedValue([{ taskId: "task-1" }]);
    await expect(listCompletedTaskIds("tenant-1", "user-1", "program-1", 1)).resolves.toEqual(["task-1"]);
    expect(prismaMock.userTaskCompletionFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        userId: "user-1",
        task: { tenantId: "tenant-1", programId: "program-1", weekNumber: 1 }
      },
      select: { taskId: true }
    });
  });

  it("completes a task idempotently only for the active accepted-program week", async () => {
    await markApplicantTaskCompleted({
      tenantId: "tenant-1",
      applicantId: "user-1",
      taskId: "task-1",
      missionAssignmentId: "assignment-1"
    });
    expect(prismaMock.txAssignmentFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        tenantId: "tenant-1",
        applicantId: "user-1",
        status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] }
      })
    }));
    expect(prismaMock.txTaskFindFirst).toHaveBeenCalledWith({
      where: {
        id: "task-1",
        tenantId: "tenant-1",
        programId: "program-1",
        weekNumber: 1,
        published: true
      },
      select: { id: true }
    });
    expect(prismaMock.txCompletionUpsert).toHaveBeenCalledWith({
      where: { tenantId_userId_taskId: { tenantId: "tenant-1", userId: "user-1", taskId: "task-1" } },
      update: {},
      create: { tenantId: "tenant-1", taskId: "task-1", userId: "user-1" }
    });
  });

  it("rejects another tenant/program/week task before writing completion", async () => {
    prismaMock.txTaskFindFirst.mockResolvedValue(null);
    await expect(markApplicantTaskCompleted({
      tenantId: "tenant-1",
      applicantId: "user-1",
      taskId: "other-task",
      missionAssignmentId: "assignment-1"
    })).rejects.toThrow("not found for this program week");
    expect(prismaMock.txCompletionUpsert).not.toHaveBeenCalled();
  });

  it("computes program progress from tenant-scoped completions", async () => {
    prismaMock.programTaskFindMany.mockResolvedValue([
      { id: "t1", weekNumber: 1 },
      { id: "t2", weekNumber: 1 },
      { id: "t3", weekNumber: 2 }
    ]);
    prismaMock.userTaskCompletionFindMany.mockResolvedValue([{ taskId: "t1" }]);
    const progress = await getApplicantProgramProgress("user-1", "tenant-1", "program-1");
    expect(progress[0]).toEqual({ weekNumber: 1, totalTasks: 2, completedTasks: 1, percentage: 50 });
    expect(progress[1]).toEqual({ weekNumber: 2, totalTasks: 1, completedTasks: 0, percentage: 0 });
    expect(progress).toHaveLength(4);
  });

  it("preserves notification and calendar helper scoping", async () => {
    prismaMock.calendarEventFindMany.mockResolvedValue([]);
    prismaMock.notificationFindMany.mockResolvedValue([]);
    prismaMock.notificationCount.mockResolvedValue(2);
    prismaMock.notificationUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.notificationCreate.mockResolvedValue({ id: "notification-1" });
    await listCalendarEvents("tenant-1", "program-1", true);
    await listUserNotifications("user-1", "tenant-1");
    await expect(countUnreadNotifications("user-1", "tenant-1")).resolves.toBe(2);
    await markNotificationRead("notification-1", "user-1");
    await createNotification({ tenantId: "tenant-1", userId: "user-1", type: "INFO", title: "Title" });
    expect(prismaMock.notificationFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1", tenantId: "tenant-1" }
    }));
  });
});
