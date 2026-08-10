import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  missionAssignmentFindFirst: vi.fn(),
  missionAssignmentFindMany: vi.fn(),
  missionTaskCompletionFindMany: vi.fn(),
  missionTaskCompletionUpsert: vi.fn(),
  missionTaskCompletionDeleteMany: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    missionAssignment: {
      findFirst: prismaMock.missionAssignmentFindFirst,
      findMany: prismaMock.missionAssignmentFindMany
    },
    missionTaskCompletion: {
      findMany: prismaMock.missionTaskCompletionFindMany,
      upsert: prismaMock.missionTaskCompletionUpsert,
      deleteMany: prismaMock.missionTaskCompletionDeleteMany
    }
  }
}));

import {
  areRequiredMissionTasksComplete,
  getMissionTasksForAssignment,
  listAssignedMissionsWithTasks,
  markMissionTaskComplete,
  missionTaskTitle,
  unmarkMissionTaskComplete
} from "./mission-tasks";

describe("mission-tasks", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
  });

  describe("missionTaskTitle", () => {
    it("names the fixed 3-step template", () => {
      expect(missionTaskTitle(1)).toBe("Review the Mission Brief");
      expect(missionTaskTitle(2)).toBe("Study the Tutorial");
      expect(missionTaskTitle(3)).toBe("Build & Submit Evidence");
    });
  });

  describe("getMissionTasksForAssignment", () => {
    it("returns null when the assignment isn't found for this applicant/tenant", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(null);
      const result = await getMissionTasksForAssignment("tenant-1", "user-1", "assignment-1");
      expect(result).toBeNull();
    });

    it("marks Task 3 complete once a submission exists beyond DRAFT/NEEDS_REVISION", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue({
        id: "assignment-1",
        mission: { id: "mission-1", title: "Mission" },
        submissions: [{ status: "SUBMITTED" }]
      });
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([]);

      const result = await getMissionTasksForAssignment("tenant-1", "user-1", "assignment-1");

      expect(result?.tasks).toEqual([
        { index: 1, title: "Review the Mission Brief", complete: false },
        { index: 2, title: "Study the Tutorial", complete: false },
        { index: 3, title: "Build & Submit Evidence", complete: true }
      ]);
    });

    it("does not mark Task 3 complete for a DRAFT or NEEDS_REVISION submission", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue({
        id: "assignment-1",
        mission: { id: "mission-1", title: "Mission" },
        submissions: [{ status: "NEEDS_REVISION" }]
      });
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([{ taskIndex: 1 }, { taskIndex: 2 }]);

      const result = await getMissionTasksForAssignment("tenant-1", "user-1", "assignment-1");

      expect(result?.tasks.find((t) => t.index === 3)?.complete).toBe(false);
      expect(result?.tasks.find((t) => t.index === 1)?.complete).toBe(true);
      expect(result?.tasks.find((t) => t.index === 2)?.complete).toBe(true);
    });

    it("marks Task 3 incomplete when there is no submission at all", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue({
        id: "assignment-1",
        mission: { id: "mission-1", title: "Mission" },
        submissions: []
      });
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([]);

      const result = await getMissionTasksForAssignment("tenant-1", "user-1", "assignment-1");
      expect(result?.tasks.find((t) => t.index === 3)?.complete).toBe(false);
    });
  });

  describe("listAssignedMissionsWithTasks", () => {
    it("returns an empty array when nothing is assigned", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([]);
      const result = await listAssignedMissionsWithTasks("tenant-1", "user-1", "program-1");
      expect(result).toEqual([]);
      expect(prismaMock.missionTaskCompletionFindMany).not.toHaveBeenCalled();
    });

    it("keeps only the latest attempt per week, ordered by week then mission order", async () => {
      // Mirrors the query's own orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }] — the
      // mock doesn't apply Prisma ordering itself, so the fixture must already reflect it.
      prismaMock.missionAssignmentFindMany.mockResolvedValue([
        { id: "a-w1-new", weekNumber: 1, attemptNumber: 2, mission: { id: "m1-new", order: 0 }, submissions: [] },
        { id: "a-w1-old", weekNumber: 1, attemptNumber: 1, mission: { id: "m1-old", order: 0 }, submissions: [] },
        { id: "a-w2", weekNumber: 2, attemptNumber: 1, mission: { id: "m2", order: 0 }, submissions: [] }
      ]);
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([]);

      const result = await listAssignedMissionsWithTasks("tenant-1", "user-1", "program-1");

      expect(result.map((r) => r.assignment.id)).toEqual(["a-w1-new", "a-w2"]);
    });

    it("attaches each assignment's own task completions, not another assignment's", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([
        { id: "a-1", weekNumber: 1, attemptNumber: 1, mission: { id: "m1", order: 0 }, submissions: [] },
        { id: "a-2", weekNumber: 2, attemptNumber: 1, mission: { id: "m2", order: 0 }, submissions: [] }
      ]);
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([
        { missionAssignmentId: "a-1", taskIndex: 1 },
        { missionAssignmentId: "a-2", taskIndex: 2 }
      ]);

      const result = await listAssignedMissionsWithTasks("tenant-1", "user-1", "program-1");

      const a1 = result.find((r) => r.assignment.id === "a-1")!;
      const a2 = result.find((r) => r.assignment.id === "a-2")!;
      expect(a1.tasks.find((t) => t.index === 1)?.complete).toBe(true);
      expect(a1.tasks.find((t) => t.index === 2)?.complete).toBe(false);
      expect(a2.tasks.find((t) => t.index === 1)?.complete).toBe(false);
      expect(a2.tasks.find((t) => t.index === 2)?.complete).toBe(true);
    });
  });

  describe("areRequiredMissionTasksComplete", () => {
    it("is true only when both Task 1 and Task 2 are complete", async () => {
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([{ taskIndex: 1 }, { taskIndex: 2 }]);
      expect(await areRequiredMissionTasksComplete("assignment-1")).toBe(true);
    });

    it("is false when only one required task is complete", async () => {
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([{ taskIndex: 1 }]);
      expect(await areRequiredMissionTasksComplete("assignment-1")).toBe(false);
    });
  });

  describe("markMissionTaskComplete", () => {
    it("refuses to manually mark Task 3 complete", async () => {
      await expect(
        markMissionTaskComplete({ tenantId: "tenant-1", applicantId: "user-1", missionAssignmentId: "assignment-1", taskIndex: 3 })
      ).rejects.toThrow("completed automatically");
      expect(prismaMock.missionAssignmentFindFirst).not.toHaveBeenCalled();
    });

    it("rejects marking a task complete on an assignment that isn't accepted/active", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(null);
      await expect(
        markMissionTaskComplete({ tenantId: "tenant-1", applicantId: "user-1", missionAssignmentId: "assignment-1", taskIndex: 1 })
      ).rejects.toThrow("not accepted/active");
      expect(prismaMock.missionTaskCompletionUpsert).not.toHaveBeenCalled();
    });

    it("upserts the completion row scoped to the assignment and task index", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue({ id: "assignment-1" });
      prismaMock.missionTaskCompletionUpsert.mockResolvedValue({ id: "completion-1" });

      await markMissionTaskComplete({ tenantId: "tenant-1", applicantId: "user-1", missionAssignmentId: "assignment-1", taskIndex: 2 });

      expect(prismaMock.missionAssignmentFindFirst).toHaveBeenCalledWith({
        where: {
          id: "assignment-1",
          tenantId: "tenant-1",
          applicantId: "user-1",
          status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] }
        },
        select: { id: true }
      });
      expect(prismaMock.missionTaskCompletionUpsert).toHaveBeenCalledWith({
        where: { missionAssignmentId_taskIndex: { missionAssignmentId: "assignment-1", taskIndex: 2 } },
        create: { tenantId: "tenant-1", missionAssignmentId: "assignment-1", taskIndex: 2 },
        update: {}
      });
    });
  });

  describe("unmarkMissionTaskComplete", () => {
    it("rejects when the assignment doesn't belong to this applicant/tenant", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(null);
      await expect(
        unmarkMissionTaskComplete({ tenantId: "tenant-1", applicantId: "user-1", missionAssignmentId: "assignment-1", taskIndex: 1 })
      ).rejects.toThrow("not found");
      expect(prismaMock.missionTaskCompletionDeleteMany).not.toHaveBeenCalled();
    });

    it("deletes the completion row for that assignment/task", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue({ id: "assignment-1" });
      await unmarkMissionTaskComplete({ tenantId: "tenant-1", applicantId: "user-1", missionAssignmentId: "assignment-1", taskIndex: 1 });
      expect(prismaMock.missionTaskCompletionDeleteMany).toHaveBeenCalledWith({
        where: { missionAssignmentId: "assignment-1", taskIndex: 1 }
      });
    });
  });
});
