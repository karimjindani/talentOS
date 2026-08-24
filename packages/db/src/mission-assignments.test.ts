import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  missionAssignmentFindMany: vi.fn(),
  missionFindFirst: vi.fn(),
  transaction: vi.fn(),
  txApplicationFindFirst: vi.fn(),
  txApplicationFindMany: vi.fn(),
  txApplicationUpdateMany: vi.fn(),
  txNotificationCreate: vi.fn(),
  txMissionAssignmentFindFirst: vi.fn(),
  txMissionAssignmentFindMany: vi.fn(),
  txMissionAssignmentUpdate: vi.fn(),
  txMissionFindMany: vi.fn(),
  txMissionAssignmentGroupBy: vi.fn(),
  txMissionAssignmentCreate: vi.fn(),
  txTenantMembershipFindMany: vi.fn(),
  txNotificationCreateMany: vi.fn()
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
  acceptMissionAssignment,
  assignWeekMissionToAcceptedApplicant,
  computeMissionDeadline,
  backfillAssignmentsForAcceptedApplicantsTx,
  nextAssignableWeekForApplicantTx,
  resumeAwaitingMissionAssignmentsTx,
  createRepeatMissionForSameWeekTx,
  getAssignedProgramMission,
  listAssignedProgramMissions
} from "./mission-assignments";

describe("computeMissionDeadline (Thursday cadence, ≥4 working days)", () => {
  // A known week: 2026-07-13 (Mon) … 2026-07-19 (Sun); Thursdays are 07-16 and 07-23.
  // Deadline hour is 18:59:59.999 UTC == 23:59:59.999 Pakistan Standard Time (UTC+5) — the tenant's
  // local end-of-Thursday, so the cadence lands before Friday starts locally, not just in UTC.
  const cases: Array<[string, string, string]> = [
    ["Monday", "2026-07-13T09:00:00.000Z", "2026-07-16T18:59:59.999Z"], // this Thursday (Mon–Thu = 4)
    ["Tuesday", "2026-07-14T09:00:00.000Z", "2026-07-23T18:59:59.999Z"], // next Thursday
    ["Wednesday", "2026-07-15T09:00:00.000Z", "2026-07-23T18:59:59.999Z"],
    ["Thursday", "2026-07-16T09:00:00.000Z", "2026-07-23T18:59:59.999Z"],
    ["Friday", "2026-07-17T09:00:00.000Z", "2026-07-23T18:59:59.999Z"], // next Thursday (4 working days)
    ["Saturday", "2026-07-18T09:00:00.000Z", "2026-07-23T18:59:59.999Z"],
    ["Sunday", "2026-07-19T09:00:00.000Z", "2026-07-23T18:59:59.999Z"]
  ];

  it.each(cases)("accepted on %s → deadline %s", (_day, accepted, expected) => {
    expect(computeMissionDeadline(new Date(accepted)).toISOString()).toBe(new Date(expected).toISOString());
  });

  it("always lands on a Thursday", () => {
    for (const [, accepted] of cases) {
      expect(computeMissionDeadline(new Date(accepted)).getUTCDay()).toBe(4);
    }
  });
});

describe("mission assignment data access", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        application: { findFirst: prismaMock.txApplicationFindFirst, updateMany: prismaMock.txApplicationUpdateMany },
        mission: { findMany: prismaMock.txMissionFindMany },
        missionAssignment: {
          findFirst: prismaMock.txMissionAssignmentFindFirst,
          update: prismaMock.txMissionAssignmentUpdate,
          groupBy: prismaMock.txMissionAssignmentGroupBy,
          create: prismaMock.txMissionAssignmentCreate
        },
        tenantMembership: { findMany: prismaMock.txTenantMembershipFindMany },
        notification: { createMany: prismaMock.txNotificationCreateMany }
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
    prismaMock.txMissionAssignmentUpdate.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
    prismaMock.txApplicationUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txTenantMembershipFindMany.mockResolvedValue([]);
    prismaMock.txNotificationCreateMany.mockResolvedValue({ count: 0 });
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
        weekNumber: 1,
        attemptNumber: 1,
        status: "NOT_STARTED"
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

  it("lists only the latest assigned attempt for each applicant program week", async () => {
    prismaMock.missionAssignmentFindMany.mockResolvedValue([
      { weekNumber: 1, attemptNumber: 2, mission: { id: "mission-2", title: "B", weekNumber: 1, order: 2 } },
      { weekNumber: 1, attemptNumber: 1, mission: { id: "mission-1", title: "A", weekNumber: 1, order: 1 } },
      { weekNumber: 2, attemptNumber: 1, mission: { id: "mission-3", title: "C", weekNumber: 2, order: 1 } }
    ]);

    const missions = await listAssignedProgramMissions("tenant-1", "applicant-1", "program-1");

    expect(prismaMock.missionAssignmentFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", applicantId: "applicant-1", programId: "program-1", mission: { status: "PUBLISHED" } },
      include: { mission: true },
      orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
    });
    expect(missions.map((mission) => mission.id)).toEqual(["mission-2", "mission-3"]);
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

describe("acceptMissionAssignment", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        missionAssignment: {
          findFirst: prismaMock.txMissionAssignmentFindFirst,
          update: prismaMock.txMissionAssignmentUpdate
        }
      })
    );
    prismaMock.txMissionAssignmentUpdate.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
  });

  it("sets a Thursday deadline giving at least four working days, plus the grace window", async () => {
    // 2026-07-14 is a Tuesday: this week's Thursday would be only 3 working days, so the deadline
    // rolls to the following Thursday (2026-07-23), end of day UTC.
    const acceptedAt = new Date("2026-07-14T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(acceptedAt);

    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      status: "NOT_STARTED",
      mission: { deadlineHours: 48, gracePeriodHours: 12 }
    });

    await acceptMissionAssignment({ tenantId: "tenant-1", applicantId: "applicant-1", missionAssignmentId: "assignment-1" });

    expect(prismaMock.txMissionAssignmentUpdate).toHaveBeenCalledWith({
      where: { id: "assignment-1" },
      data: {
        status: "ACCEPTED",
        acceptedAt,
        deadlineAt: new Date("2026-07-23T18:59:59.999Z"),
        graceEndsAt: new Date("2026-07-24T06:59:59.999Z")
      }
    });
    vi.useRealTimers();
  });

  it("rejects accepting an assignment that isn't NOT_STARTED", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({
      id: "assignment-1",
      status: "ACCEPTED",
      mission: { deadlineHours: 168, gracePeriodHours: 24 }
    });

    await expect(
      acceptMissionAssignment({ tenantId: "tenant-1", applicantId: "applicant-1", missionAssignmentId: "assignment-1" })
    ).rejects.toThrow("Only a NOT_STARTED assignment can be accepted");
    expect(prismaMock.txMissionAssignmentUpdate).not.toHaveBeenCalled();
  });

  it("rejects accepting an assignment that doesn't belong to this applicant/tenant", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);

    await expect(
      acceptMissionAssignment({ tenantId: "tenant-1", applicantId: "applicant-1", missionAssignmentId: "assignment-1" })
    ).rejects.toThrow("Mission assignment not found");
  });
});

describe("resumeAwaitingMissionAssignmentsTx", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.txApplicationFindMany.mockResolvedValue([{ id: "application-1", applicantId: "applicant-1" }]);
    prismaMock.txMissionAssignmentCreate.mockImplementation(async ({ data }) => ({ id: "assignment-new", ...data }));
    prismaMock.txApplicationUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txNotificationCreate.mockResolvedValue({ id: "notification-1" });
  });

  const tx = () => ({
    application: {
      findMany: prismaMock.txApplicationFindMany,
      updateMany: prismaMock.txApplicationUpdateMany
    },
    missionAssignment: {
      findFirst: prismaMock.txMissionAssignmentFindFirst,
      findMany: prismaMock.txMissionAssignmentFindMany,
      create: prismaMock.txMissionAssignmentCreate
    },
    mission: { findMany: prismaMock.txMissionFindMany },
    notification: { create: prismaMock.txNotificationCreate }
  }) as never;

  it("assigns the newly published mission to an applicant waiting on that week and returns them to ACCEPTED", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, attemptNumber: 2, status: "REPEAT" });
    prismaMock.txMissionAssignmentFindMany.mockResolvedValue([{ missionId: "mission-used" }]);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-new", title: "Fresh Week 2" }]);

    const resumed = await resumeAwaitingMissionAssignmentsTx(tx(), {
      tenantId: "tenant-1",
      programId: "program-1",
      weekNumber: 2
    });

    expect(resumed).toBe(1);
    // Same week, never a mission already served, next attempt number.
    expect(prismaMock.txMissionFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        programId: "program-1",
        weekNumber: 2,
        status: "PUBLISHED",
        id: { notIn: ["mission-used"] }
      },
      select: { id: true, title: true },
      orderBy: [{ order: "asc" }, { title: "asc" }]
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "applicant-1",
        missionId: "mission-new",
        weekNumber: 2,
        attemptNumber: 3,
        status: "NOT_STARTED"
      }
    });
    expect(prismaMock.txApplicationUpdateMany).toHaveBeenCalledWith({
      where: { id: "application-1", tenantId: "tenant-1", status: "AWAITING_MISSION_ASSIGNMENT" },
      data: { status: "ACCEPTED" }
    });
    expect(prismaMock.txNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "applicant-1", type: "INFO" })
    });
  });

  // Regression (v0.20.0): a dangling REPEAT can also sit on an ACCEPTED application — deleting or
  // archiving the mission that held the repeat attempt cascade-removes the assignment and leaves the
  // application ACCEPTED, so gating recovery on AWAITING_MISSION_ASSIGNMENT wedged the applicant on
  // the "repeat assigned" tag with no mission and no way to submit.
  it("rescues an ACCEPTED application whose latest assignment is a dangling REPEAT for that week", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, attemptNumber: 1, status: "REPEAT" });
    prismaMock.txMissionAssignmentFindMany.mockResolvedValue([{ missionId: "mission-used" }]);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-new", title: "Fresh Week 2" }]);

    const resumed = await resumeAwaitingMissionAssignmentsTx(tx(), {
      tenantId: "tenant-1",
      programId: "program-1",
      weekNumber: 2
    });

    expect(resumed).toBe(1);
    expect(prismaMock.txApplicationFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        programId: "program-1",
        status: { in: ["AWAITING_MISSION_ASSIGNMENT", "ACCEPTED"] }
      },
      select: { id: true, applicantId: true }
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "applicant-1",
        missionId: "mission-new",
        weekNumber: 2,
        attemptNumber: 2,
        status: "NOT_STARTED"
      }
    });
    // Returning an already-ACCEPTED application to ACCEPTED must stay a no-op, not an error.
    expect(prismaMock.txApplicationUpdateMany).toHaveBeenCalledWith({
      where: { id: "application-1", tenantId: "tenant-1", status: "AWAITING_MISSION_ASSIGNMENT" },
      data: { status: "ACCEPTED" }
    });
  });

  it("leaves an ACCEPTED applicant alone when their latest attempt is still open", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, attemptNumber: 2, status: "NOT_STARTED" });

    const resumed = await resumeAwaitingMissionAssignmentsTx(tx(), {
      tenantId: "tenant-1",
      programId: "program-1",
      weekNumber: 2
    });

    expect(resumed).toBe(0);
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });

  it("ignores applicants waiting on a different week", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, attemptNumber: 2, status: "REPEAT" });

    const resumed = await resumeAwaitingMissionAssignmentsTx(tx(), {
      tenantId: "tenant-1",
      programId: "program-1",
      weekNumber: 3
    });

    expect(resumed).toBe(0);
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
    expect(prismaMock.txApplicationUpdateMany).not.toHaveBeenCalled();
  });

  it("leaves the applicant waiting when every mission for the week was already assigned to them", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, attemptNumber: 2, status: "REPEAT" });
    prismaMock.txMissionAssignmentFindMany.mockResolvedValue([{ missionId: "mission-used" }]);
    prismaMock.txMissionFindMany.mockResolvedValue([]);

    const resumed = await resumeAwaitingMissionAssignmentsTx(tx(), {
      tenantId: "tenant-1",
      programId: "program-1",
      weekNumber: 2
    });

    expect(resumed).toBe(0);
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
    expect(prismaMock.txApplicationUpdateMany).not.toHaveBeenCalled();
  });
});

describe("createRepeatMissionForSameWeekTx", () => {
  const failedAssignment = {
    id: "assignment-9",
    tenantId: "tenant-1",
    programId: "program-1",
    applicantId: "applicant-1",
    missionId: "mission-failed",
    weekNumber: 1
  };

  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.txMissionAssignmentCreate.mockImplementation(async ({ data }) => ({ id: "assignment-new", ...data }));
    prismaMock.txMissionAssignmentFindMany.mockResolvedValue([{ missionId: "mission-failed" }]);
    prismaMock.txApplicationUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txTenantMembershipFindMany.mockResolvedValue([]);
    prismaMock.txNotificationCreateMany.mockResolvedValue({ count: 0 });
  });

  const tx = () => ({
    missionAssignment: {
      findFirst: prismaMock.txMissionAssignmentFindFirst,
      findMany: prismaMock.txMissionAssignmentFindMany,
      create: prismaMock.txMissionAssignmentCreate
    },
    mission: { findMany: prismaMock.txMissionFindMany },
    application: { updateMany: prismaMock.txApplicationUpdateMany },
    tenantMembership: { findMany: prismaMock.txTenantMembershipFindMany },
    notification: { createMany: prismaMock.txNotificationCreateMany }
  }) as never;

  it("assigns a different mission for the same week, excluding every mission already assigned", async () => {
    prismaMock.txMissionAssignmentFindFirst
      .mockResolvedValueOnce({ id: "assignment-9" }) // latest-overall guard
      .mockResolvedValueOnce({ attemptNumber: 1 }); // latest same-week attempt
    // The applicant has already been served the failed mission and one earlier mission this week.
    prismaMock.txMissionAssignmentFindMany.mockResolvedValue([{ missionId: "mission-failed" }, { missionId: "mission-old" }]);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-alt", title: "Alt", order: 1 }]);

    const result = await createRepeatMissionForSameWeekTx(tx(), failedAssignment);

    expect(prismaMock.txMissionFindMany).toHaveBeenCalledWith({
      where: {
        tenantId: "tenant-1",
        programId: "program-1",
        weekNumber: 1,
        status: "PUBLISHED",
        id: { notIn: ["mission-failed", "mission-old"] }
      },
      select: { id: true, title: true, order: true },
      orderBy: [{ order: "asc" }, { title: "asc" }]
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: {
        tenantId: "tenant-1",
        programId: "program-1",
        applicantId: "applicant-1",
        missionId: "mission-alt",
        weekNumber: 1,
        attemptNumber: 2,
        status: "NOT_STARTED"
      }
    });
    expect(prismaMock.txApplicationUpdateMany).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ missionId: "mission-alt" }));
  });

  it("repeats week 3 as week 3 — it never resets the applicant back to week one", async () => {
    const failedAtWeekThree = { ...failedAssignment, weekNumber: 3 };
    prismaMock.txMissionAssignmentFindFirst
      .mockResolvedValueOnce({ id: "assignment-9" })
      .mockResolvedValueOnce({ attemptNumber: 1 });
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-alt-w3", title: "Alt W3", order: 1 }]);

    const result = await createRepeatMissionForSameWeekTx(tx(), failedAtWeekThree);

    expect(prismaMock.txMissionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ weekNumber: 3 }) })
    );
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ weekNumber: 3, missionId: "mission-alt-w3" })
    });
    expect(result).toEqual(expect.objectContaining({ weekNumber: 3 }));
  });

  it("sets AWAITING_MISSION_ASSIGNMENT and notifies Org Admins / Tech Leads when no alternate mission exists, without reassigning the failed mission", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValueOnce({ id: "assignment-9" });
    prismaMock.txMissionFindMany.mockResolvedValue([]);
    prismaMock.txTenantMembershipFindMany.mockResolvedValue([{ userId: "admin-1" }, { userId: "lead-1" }]);

    const result = await createRepeatMissionForSameWeekTx(tx(), failedAssignment);

    expect(result).toBeNull();
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
    expect(prismaMock.txApplicationUpdateMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1", status: "ACCEPTED" },
      data: { status: "AWAITING_MISSION_ASSIGNMENT" }
    });
    expect(prismaMock.txNotificationCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: "admin-1", type: "WARNING" }),
        expect.objectContaining({ userId: "lead-1", type: "WARNING" })
      ]
    });
  });

  it("does not notify when there are no Org Admin / Tech Lead members to notify", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValueOnce({ id: "assignment-9" });
    prismaMock.txMissionFindMany.mockResolvedValue([]);
    prismaMock.txTenantMembershipFindMany.mockResolvedValue([]);

    await createRepeatMissionForSameWeekTx(tx(), failedAssignment);

    expect(prismaMock.txNotificationCreateMany).not.toHaveBeenCalled();
  });

  it("refuses to repeat an assignment that isn't the applicant's latest attempt", async () => {
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValueOnce({ id: "some-other-assignment" });

    await expect(createRepeatMissionForSameWeekTx(tx(), failedAssignment)).rejects.toThrow(
      "Only the applicant's latest assignment attempt can be repeated."
    );
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });
});

describe("serving applicants who have nothing to work on", () => {
  const scope = { tenantId: "tenant-1", programId: "program-1", applicantId: "applicant-1" };

  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
  });

  const tx = () => ({
    application: { findMany: prismaMock.txApplicationFindMany, findFirst: prismaMock.txApplicationFindFirst },
    missionAssignment: {
      findFirst: prismaMock.txMissionAssignmentFindFirst,
      findMany: prismaMock.txMissionAssignmentFindMany,
      groupBy: prismaMock.txMissionAssignmentGroupBy,
      create: prismaMock.txMissionAssignmentCreate
    },
    mission: { findMany: prismaMock.txMissionFindMany },
    tenantMembership: { findMany: prismaMock.txTenantMembershipFindMany },
    notification: { createMany: prismaMock.txNotificationCreateMany }
  }) as never;

  describe("nextAssignableWeekForApplicantTx", () => {
    it("starts a never-assigned applicant at week 1", async () => {
      prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);
      expect(await nextAssignableWeekForApplicantTx(tx(), scope)).toBe(1);
    });

    // The regression this fixes: passing week 2 with week 3 unpublished left the applicant needing
    // week 3, but the backfill only ever asked for week 1 and no-opped on their existing row.
    it("advances a passed applicant to the following week", async () => {
      prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, status: "PASSED" });
      expect(await nextAssignableWeekForApplicantTx(tx(), scope)).toBe(3);
    });

    it("serves nothing while an attempt is still open", async () => {
      prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, status: "IN_PROGRESS" });
      expect(await nextAssignableWeekForApplicantTx(tx(), scope)).toBeNull();
    });

    // resumeAwaitingMissionAssignmentsTx owns repeats; serving here too would double-assign.
    it("leaves a REPEAT to the resume path", async () => {
      prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 2, status: "REPEAT" });
      expect(await nextAssignableWeekForApplicantTx(tx(), scope)).toBeNull();
    });

    it("does not invent a week five after the final week", async () => {
      prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 4, status: "PASSED" });
      expect(await nextAssignableWeekForApplicantTx(tx(), scope)).toBeNull();
    });
  });

  describe("backfillAssignmentsForAcceptedApplicantsTx", () => {
    it("assigns the week the applicant actually needs, not always week 1", async () => {
      prismaMock.txApplicationFindMany.mockResolvedValue([{ applicantId: "applicant-1" }]);
      prismaMock.txMissionAssignmentFindFirst
        .mockResolvedValueOnce({ weekNumber: 2, status: "PASSED" }) // next-week lookup
        .mockResolvedValueOnce(null); // no existing week-3 attempt
      prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "application-1" });
      prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-3", title: "Week 3", order: 0 }]);
      prismaMock.txMissionAssignmentGroupBy.mockResolvedValue([]);
      prismaMock.txMissionAssignmentCreate.mockImplementation(async ({ data }) => ({ id: "new", ...data }));

      const assigned = await backfillAssignmentsForAcceptedApplicantsTx(tx(), {
        tenantId: "tenant-1",
        programId: "program-1"
      });

      expect(assigned).toBe(1);
      expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ weekNumber: 3, attemptNumber: 1, status: "NOT_STARTED" })
      });
    });

    it("skips applicants whose current attempt is still open", async () => {
      prismaMock.txApplicationFindMany.mockResolvedValue([{ applicantId: "applicant-1" }]);
      prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ weekNumber: 1, status: "IN_PROGRESS" });

      const assigned = await backfillAssignmentsForAcceptedApplicantsTx(tx(), {
        tenantId: "tenant-1",
        programId: "program-1"
      });

      expect(assigned).toBe(0);
      expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
    });
  });
});
