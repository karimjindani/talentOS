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
  MARKABLE_ASSIGNMENT_STATUSES,
  areRequiredMissionTasksComplete,
  getMissionTasksForAssignment,
  listAssignedMissionsWithTasks,
  markMissionTaskComplete,
  missionChecklistLockReason,
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

    it("derives a fully complete checklist for a PASSED assignment even without stored rows", async () => {
      // v0.19.4: a mission can't pass through the normal flow without tasks 1–2 checked, so a
      // PASSED assignment reports 3/3 even when the rows were never written (seeded data).
      prismaMock.missionAssignmentFindFirst.mockResolvedValue({
        id: "assignment-1",
        status: "PASSED",
        mission: { id: "mission-1", title: "Mission" },
        submissions: []
      });
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([]);

      const result = await getMissionTasksForAssignment("tenant-1", "user-1", "assignment-1");
      expect(result?.tasks.map((t) => t.complete)).toEqual([true, true, true]);
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

    it("derives PASSED assignments as fully complete while other statuses keep stored rows", async () => {
      prismaMock.missionAssignmentFindMany.mockResolvedValue([
        { id: "a-passed", weekNumber: 1, attemptNumber: 1, status: "PASSED", mission: { id: "m1", order: 0 }, submissions: [] },
        { id: "a-active", weekNumber: 2, attemptNumber: 1, status: "ACCEPTED", mission: { id: "m2", order: 0 }, submissions: [] }
      ]);
      prismaMock.missionTaskCompletionFindMany.mockResolvedValue([]);

      const result = await listAssignedMissionsWithTasks("tenant-1", "user-1", "program-1");

      const passed = result.find((r) => r.assignment.id === "a-passed")!;
      const active = result.find((r) => r.assignment.id === "a-active")!;
      expect(passed.tasks.map((t) => t.complete)).toEqual([true, true, true]);
      expect(active.tasks.map((t) => t.complete)).toEqual([false, false, false]);
    });
  });

  describe("missionChecklistLockReason", () => {
    it("is null for every markable status", () => {
      expect(MARKABLE_ASSIGNMENT_STATUSES).toEqual(["ACCEPTED", "IN_PROGRESS", "OVERDUE"]);
      for (const status of MARKABLE_ASSIGNMENT_STATUSES) {
        expect(missionChecklistLockReason(status)).toBeNull();
      }
    });

    it("explains the lock for every non-markable status", () => {
      for (const status of ["NOT_STARTED", "PENDING_EVALUATION", "LATE_SUBMITTED", "PASSED", "FAILED", "REPEAT"] as const) {
        expect(missionChecklistLockReason(status)).toEqual(expect.any(String));
      }
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
    it("rejects when the assignment isn't accepted/active for this applicant/tenant", async () => {
      // v0.19.4: unmark carries the same lifecycle guard as mark — a submitted/finished
      // attempt's checklist is immutable in both directions.
      prismaMock.missionAssignmentFindFirst.mockResolvedValue(null);
      await expect(
        unmarkMissionTaskComplete({ tenantId: "tenant-1", applicantId: "user-1", missionAssignmentId: "assignment-1", taskIndex: 1 })
      ).rejects.toThrow("not accepted/active");
      expect(prismaMock.missionTaskCompletionDeleteMany).not.toHaveBeenCalled();
    });

    it("deletes the completion row for that assignment/task on an active assignment", async () => {
      prismaMock.missionAssignmentFindFirst.mockResolvedValue({ id: "assignment-1" });
      await unmarkMissionTaskComplete({ tenantId: "tenant-1", applicantId: "user-1", missionAssignmentId: "assignment-1", taskIndex: 1 });
      expect(prismaMock.missionAssignmentFindFirst).toHaveBeenCalledWith({
        where: {
          id: "assignment-1",
          tenantId: "tenant-1",
          applicantId: "user-1",
          status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] }
        },
        select: { id: true }
      });
      expect(prismaMock.missionTaskCompletionDeleteMany).toHaveBeenCalledWith({
        where: { missionAssignmentId: "assignment-1", taskIndex: 1 }
      });
    });
  });
});
