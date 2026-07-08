import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  missionAssignmentFindMany: vi.fn(),
  missionFindFirst: vi.fn(),
  transaction: vi.fn(),
  txApplicationFindFirst: vi.fn(),
  txMissionAssignmentFindFirst: vi.fn(),
  txMissionFindMany: vi.fn(),
  txMissionAssignmentGroupBy: vi.fn(),
  txMissionAssignmentCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    missionAssignment: {
      findMany: prismaMock.missionAssignmentFindMany
    },
    mission: {
      findFirst: prismaMock.missionFindFirst
    },
    $transaction: prismaMock.transaction
  }
}));

import {
  assignWeekMissionToAcceptedApplicant,
  getAssignedProgramMission,
  listAssignedProgramMissions
} from "./mission-assignments";

describe("mission assignment data access", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        application: { findFirst: prismaMock.txApplicationFindFirst },
        mission: { findMany: prismaMock.txMissionFindMany },
        missionAssignment: {
          findFirst: prismaMock.txMissionAssignmentFindFirst,
          groupBy: prismaMock.txMissionAssignmentGroupBy,
          create: prismaMock.txMissionAssignmentCreate
        }
      })
    );
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "application-1" });
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);
    prismaMock.txMissionFindMany.mockResolvedValue([
      { id: "mission-1", title: "Mission 1", order: 1 },
      { id: "mission-2", title: "Mission 2", order: 2 }
    ]);
    prismaMock.txMissionAssignmentGroupBy.mockResolvedValue([]);
    prismaMock.txMissionAssignmentCreate.mockImplementation(async ({ data }) => ({ id: "assignment-1", ...data }));
  });

  it("assigns an accepted applicant one Week 1 published mission", async () => {
    await assignWeekMissionToAcceptedApplicant({
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "applicant-1",
      chooseAssignmentIndex: () => 0
    });

    expect(prismaMock.txApplicationFindFirst).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1", status: "ACCEPTED" },
      select: { id: true }
    });
    expect(prismaMock.txMissionFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", weekNumber: 1, status: "PUBLISHED" },
      select: { id: true, title: true, order: true },
      orderBy: [{ order: "asc" }, { title: "asc" }]
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "applicant-1",
        missionId: "mission-1",
        weekNumber: 1
      }
    });
  });

  it("does not create a duplicate assignment when one already exists", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ id: "existing-assignment" });

    const assignment = await assignWeekMissionToAcceptedApplicant({
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "applicant-1"
    });

    expect(assignment).toEqual({ id: "existing-assignment" });
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });

  it("rejects assignment without an accepted application in the same tenant, program and applicant scope", async () => {
    prismaMock.txApplicationFindFirst.mockResolvedValue(null);

    await expect(
      assignWeekMissionToAcceptedApplicant({
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "applicant-1"
      })
    ).rejects.toThrow("accepted application");
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });

  it("returns null when no published mission exists for the assignment week", async () => {
    prismaMock.txMissionFindMany.mockResolvedValue([]);

    const assignment = await assignWeekMissionToAcceptedApplicant({
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "applicant-1"
    });

    expect(assignment).toBeNull();
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });

  it("chooses among least-assigned missions so different applicants can receive different Week 1 assignments", async () => {
    prismaMock.txMissionAssignmentGroupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ missionId: "mission-1", _count: { missionId: 1 } }]);

    await assignWeekMissionToAcceptedApplicant({
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "applicant-1",
      chooseAssignmentIndex: () => 0
    });
    await assignWeekMissionToAcceptedApplicant({
      tenantId: "tenant-1",
      programId: "program-1",
      applicantId: "applicant-2",
      chooseAssignmentIndex: () => 0
    });

    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ applicantId: "applicant-1", missionId: "mission-1" })
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ applicantId: "applicant-2", missionId: "mission-2" })
    });
  });

  it("lists only assigned published missions for an applicant program", async () => {
    prismaMock.missionAssignmentFindMany.mockResolvedValue([
      { mission: { id: "mission-2", title: "B", weekNumber: 1, order: 2 } },
      { mission: { id: "mission-1", title: "A", weekNumber: 1, order: 1 } }
    ]);

    const missions = await listAssignedProgramMissions("tenant-1", "applicant-1", "program-1");

    expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", applicantId: "applicant-1", programId: "program-1", mission: { status: "PUBLISHED" } },
      include: { mission: true }
    });
    expect(missions.map((mission) => mission.id)).toEqual(["mission-1", "mission-2"]);
  });

  it("reads one assigned published mission and rejects unassigned missions by lookup scope", async () => {
    await getAssignedProgramMission("mission-1", "tenant-1", "applicant-1", "program-1");

    expect(prismaMock.missionFindFirst).toHaveBeenCalledWith({
      where: {
        id: "mission-1",
        tenantId: "tenant-1",
        programId: "program-1",
        status: "PUBLISHED",
        assignments: { some: { tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1" } }
      }
    });
  });
});
