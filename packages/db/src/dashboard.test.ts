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
  userTaskCompletionUpsert: vi.fn(),
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
      create: prismaMock.notificationCreate,
    },
    userTaskCompletion: {
      findMany: prismaMock.userTaskCompletionFindMany,
      upsert: prismaMock.userTaskCompletionUpsert,
    },
  },
}));

import {
  listProgramTasks,
  listTasksByWeek,
  listVideoResources,
  listCalendarEvents,
  listUserNotifications,
  countUnreadNotifications,
  markNotificationRead,
  createNotification,
  listCompletedTaskIds,
  markTaskCompleted,
  getApplicantProgramProgress,
} from "./dashboard";

describe("dashboard helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listProgramTasks", () => {
    it("queries tasks for a program ordered by week and order", async () => {
      prismaMock.programTaskFindMany.mockResolvedValue([]);
      await listProgramTasks("tenant-1", "program-1");
      expect(prismaMock.programTaskFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", programId: "program-1" },
        orderBy: [{ weekNumber: "asc" }, { order: "asc" }],
      });
    });
  });

  describe("listTasksByWeek", () => {
    it("queries tasks for a specific week", async () => {
      prismaMock.programTaskFindMany.mockResolvedValue([]);
      await listTasksByWeek("tenant-1", "program-1", 2);
      expect(prismaMock.programTaskFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", programId: "program-1", weekNumber: 2 },
        orderBy: [{ order: "asc" }],
      });
    });
  });

  describe("listVideoResources", () => {
    it("queries all videos when no week specified", async () => {
      prismaMock.videoResourceFindMany.mockResolvedValue([]);
      await listVideoResources("tenant-1", "program-1");
      expect(prismaMock.videoResourceFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", programId: "program-1" },
        orderBy: [{ weekNumber: "asc" }, { createdAt: "asc" }],
      });
    });

    it("filters by weekNumber when specified", async () => {
      prismaMock.videoResourceFindMany.mockResolvedValue([]);
      await listVideoResources("tenant-1", "program-1", 3);
      expect(prismaMock.videoResourceFindMany).toHaveBeenCalledWith({
        where: { tenantId: "tenant-1", programId: "program-1", weekNumber: 3 },
        orderBy: [{ weekNumber: "asc" }, { createdAt: "asc" }],
      });
    });
  });

  describe("listCalendarEvents", () => {
    it("queries upcoming events by default", async () => {
      prismaMock.calendarEventFindMany.mockResolvedValue([]);
      await listCalendarEvents("tenant-1", "program-1");
      const call = prismaMock.calendarEventFindMany.mock.calls[0][0];
      expect(call.where.tenantId).toBe("tenant-1");
      expect(call.where.programId).toBe("program-1");
      expect(call.where.startsAt).toBeDefined();
      expect(call.orderBy).toEqual([{ startsAt: "asc" }]);
    });

    it("includes past events when flag is set", async () => {
      prismaMock.calendarEventFindMany.mockResolvedValue([]);
      await listCalendarEvents("tenant-1", "program-1", true);
      const call = prismaMock.calendarEventFindMany.mock.calls[0][0];
      expect(call.where.startsAt).toBeUndefined();
    });
  });

  describe("listUserNotifications", () => {
    it("queries notifications for a user", async () => {
      prismaMock.notificationFindMany.mockResolvedValue([]);
      await listUserNotifications("user-1", "tenant-1");
      expect(prismaMock.notificationFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1", tenantId: "tenant-1" },
        orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      });
    });
  });

  describe("countUnreadNotifications", () => {
    it("counts unread notifications", async () => {
      prismaMock.notificationCount.mockResolvedValue(3);
      const result = await countUnreadNotifications("user-1", "tenant-1");
      expect(result).toBe(3);
      expect(prismaMock.notificationCount).toHaveBeenCalledWith({
        where: { userId: "user-1", tenantId: "tenant-1", readAt: null },
      });
    });
  });

  describe("markNotificationRead", () => {
    it("updates notification with readAt", async () => {
      prismaMock.notificationUpdateMany.mockResolvedValue({ count: 1 });
      await markNotificationRead("notif-1", "user-1");
      const call = prismaMock.notificationUpdateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: "notif-1", userId: "user-1", readAt: null });
      expect(call.data.readAt).toBeInstanceOf(Date);
    });
  });

  describe("createNotification", () => {
    it("creates a notification with the given data", async () => {
      prismaMock.notificationCreate.mockResolvedValue({ id: "notif-1" });
      await createNotification({
        tenantId: "tenant-1",
        userId: "user-1",
        type: "INFO",
        title: "Test",
        body: "Body",
      });
      expect(prismaMock.notificationCreate).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          type: "INFO",
          title: "Test",
          body: "Body",
        },
      });
    });
  });

  describe("listCompletedTaskIds", () => {
    it("returns array of task IDs", async () => {
      prismaMock.userTaskCompletionFindMany.mockResolvedValue([
        { taskId: "task-1" },
        { taskId: "task-3" },
      ]);
      const result = await listCompletedTaskIds("user-1", "program-1");
      expect(result).toEqual(["task-1", "task-3"]);
    });
  });

  describe("markTaskCompleted", () => {
    it("upserts a completion record", async () => {
      prismaMock.userTaskCompletionUpsert.mockResolvedValue({});
      await markTaskCompleted("task-1", "user-1");
      const call = prismaMock.userTaskCompletionUpsert.mock.calls[0][0];
      expect(call.where.taskId_userId).toEqual({ taskId: "task-1", userId: "user-1" });
      expect(call.create).toEqual({ taskId: "task-1", userId: "user-1" });
    });
  });

  describe("getApplicantProgramProgress", () => {
    it("returns 4 weeks with correct progress", async () => {
      prismaMock.programTaskFindMany.mockResolvedValue([
        { id: "t1", weekNumber: 1, order: 0 },
        { id: "t2", weekNumber: 1, order: 1 },
        { id: "t3", weekNumber: 2, order: 0 },
        { id: "t4", weekNumber: 3, order: 0 },
      ]);
      prismaMock.userTaskCompletionFindMany.mockResolvedValue([
        { taskId: "t1" },
      ]);

      const progress = await getApplicantProgramProgress("user-1", "tenant-1", "program-1");

      expect(progress).toHaveLength(4);
      expect(progress[0]).toEqual({
        weekNumber: 1,
        totalTasks: 2,
        completedTasks: 1,
        percentage: 50,
      });
      expect(progress[1]).toEqual({
        weekNumber: 2,
        totalTasks: 1,
        completedTasks: 0,
        percentage: 0,
      });
      expect(progress[2]).toEqual({
        weekNumber: 3,
        totalTasks: 1,
        completedTasks: 0,
        percentage: 0,
      });
      expect(progress[3]).toEqual({
        weekNumber: 4,
        totalTasks: 0,
        completedTasks: 0,
        percentage: 0,
      });
    });

    it("returns 4 weeks even with no tasks", async () => {
      prismaMock.programTaskFindMany.mockResolvedValue([]);
      prismaMock.userTaskCompletionFindMany.mockResolvedValue([]);

      const progress = await getApplicantProgramProgress("user-1", "tenant-1", "program-1");

      expect(progress).toHaveLength(4);
      for (const week of progress) {
        expect(week.totalTasks).toBe(0);
        expect(week.completedTasks).toBe(0);
        expect(week.percentage).toBe(0);
      }
    });
  });
});
