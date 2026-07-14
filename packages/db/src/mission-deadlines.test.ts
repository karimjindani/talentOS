import { beforeEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  missionAssignmentUpdateMany: vi.fn(),
  missionAssignmentFindMany: vi.fn(),
  transaction: vi.fn(),
  txMissionAssignmentUpdateMany: vi.fn(),
  txApplicationUpdateMany: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    missionAssignment: {
      updateMany: prismaMock.missionAssignmentUpdateMany,
      findMany: prismaMock.missionAssignmentFindMany
    },
    $transaction: prismaMock.transaction
  }
}));

import { sweepMissionDeadlines } from "./mission-deadlines";

describe("sweepMissionDeadlines", () => {
  const now = new Date("2026-07-25T00:00:00.000Z");

  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        missionAssignment: { updateMany: prismaMock.txMissionAssignmentUpdateMany },
        application: { updateMany: prismaMock.txApplicationUpdateMany }
      })
    );
  });

  it("marks ACCEPTED/IN_PROGRESS assignments past their deadline as OVERDUE", async () => {
    prismaMock.missionAssignmentUpdateMany.mockResolvedValue({ count: 3 });
    prismaMock.missionAssignmentFindMany.mockResolvedValue([]);

    const result = await sweepMissionDeadlines(now);

    expect(prismaMock.missionAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { status: { in: ["ACCEPTED", "IN_PROGRESS"] }, deadlineAt: { lt: now } },
      data: { status: "OVERDUE" }
    });
    expect(result.markedOverdue).toBe(3);
  });

  it("marks OVERDUE assignments past their grace period as FAILED and disqualifies the applicant", async () => {
    prismaMock.missionAssignmentUpdateMany.mockResolvedValue({ count: 0 });
    prismaMock.missionAssignmentFindMany.mockResolvedValue([
      { id: "assignment-1", tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1" }
    ]);
    prismaMock.txMissionAssignmentUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txApplicationUpdateMany.mockResolvedValue({ count: 1 });

    const result = await sweepMissionDeadlines(now);

    expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith({
      where: { status: "OVERDUE", graceEndsAt: { lt: now } },
      select: { id: true, tenantId: true, programId: true, applicantId: true }
    });
    expect(prismaMock.txMissionAssignmentUpdateMany).toHaveBeenCalledWith({
      where: { id: "assignment-1", status: "OVERDUE", graceEndsAt: { lt: now } },
      data: { status: "FAILED" }
    });
    expect(prismaMock.txApplicationUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1", status: "ACCEPTED" },
      data: { status: "DISQUALIFIED" }
    });
    expect(result.markedFailed).toBe(1);
    expect(result.disqualifiedApplicants).toBe(1);
  });

  it("skips the application update when the assignment was already transitioned by a concurrent/previous run", async () => {
    prismaMock.missionAssignmentUpdateMany.mockResolvedValue({ count: 0 });
    prismaMock.missionAssignmentFindMany.mockResolvedValue([
      { id: "assignment-1", tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1" }
    ]);
    // Row was already moved to FAILED between the scan and this write (race / re-run).
    prismaMock.txMissionAssignmentUpdateMany.mockResolvedValue({ count: 0 });

    const result = await sweepMissionDeadlines(now);

    expect(prismaMock.txApplicationUpdateMany).not.toHaveBeenCalled();
    expect(result.markedFailed).toBe(0);
    expect(result.disqualifiedApplicants).toBe(0);
  });

  it("is idempotent: running the sweep twice never double-transitions or double-disqualifies", async () => {
    // First run: one row is genuinely overdue and past grace.
    prismaMock.missionAssignmentUpdateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.missionAssignmentFindMany.mockResolvedValueOnce([
      { id: "assignment-1", tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1" }
    ]);
    prismaMock.txMissionAssignmentUpdateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.txApplicationUpdateMany.mockResolvedValueOnce({ count: 1 });

    const first = await sweepMissionDeadlines(now);
    expect(first).toEqual({ markedOverdue: 1, markedFailed: 1, disqualifiedApplicants: 1 });

    // Second run: nothing left in the source statuses (already OVERDUE->FAILED, already DISQUALIFIED),
    // so the WHERE clauses match nothing — no re-transition, no duplicate notification/disqualify.
    prismaMock.missionAssignmentUpdateMany.mockResolvedValueOnce({ count: 0 });
    prismaMock.missionAssignmentFindMany.mockResolvedValueOnce([]);

    const second = await sweepMissionDeadlines(now);
    expect(second).toEqual({ markedOverdue: 0, markedFailed: 0, disqualifiedApplicants: 0 });
  });
});
