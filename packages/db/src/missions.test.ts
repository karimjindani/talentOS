import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  missionFindMany: vi.fn(),
  missionFindFirst: vi.fn(),
  transaction: vi.fn(),
  txProgramFindFirst: vi.fn(),
  txMissionCreate: vi.fn(),
  txMissionUpdateMany: vi.fn(),
  txMissionFindFirstOrThrow: vi.fn(),
  txMissionFindFirst: vi.fn(),
  txMissionFindMany: vi.fn(),
  txAuditLogCreate: vi.fn(),
  txApplicationFindFirst: vi.fn(),
  txApplicationFindMany: vi.fn(),
  txMissionAssignmentFindFirst: vi.fn(),
  txMissionAssignmentGroupBy: vi.fn(),
  txMissionAssignmentCreate: vi.fn()
}));

vi.mock("./client", () => ({
  prisma: {
    mission: {
      findMany: prismaMock.missionFindMany,
      findFirst: prismaMock.missionFindFirst
    },
    $transaction: prismaMock.transaction
  }
}));

import {
  createMission,
  listPublishedProgramMissions,
  listTenantMissions,
  setMissionStatus,
  updateMission
} from "./missions";

describe("mission data access", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        program: { findFirst: prismaMock.txProgramFindFirst },
        mission: {
          create: prismaMock.txMissionCreate,
          updateMany: prismaMock.txMissionUpdateMany,
          findFirstOrThrow: prismaMock.txMissionFindFirstOrThrow,
          findFirst: prismaMock.txMissionFindFirst,
          findMany: prismaMock.txMissionFindMany
        },
        application: {
          findFirst: prismaMock.txApplicationFindFirst,
          findMany: prismaMock.txApplicationFindMany
        },
        missionAssignment: {
          findFirst: prismaMock.txMissionAssignmentFindFirst,
          groupBy: prismaMock.txMissionAssignmentGroupBy,
          create: prismaMock.txMissionAssignmentCreate
        },
        auditLog: { create: prismaMock.txAuditLogCreate }
      })
    );
    prismaMock.txProgramFindFirst.mockResolvedValue({ id: "program-1" });
    prismaMock.txMissionCreate.mockResolvedValue({ id: "mission-1" });
    prismaMock.txMissionUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txMissionFindFirstOrThrow.mockResolvedValue({ id: "mission-1" });
    prismaMock.txMissionFindFirst.mockResolvedValue({ id: "mission-1", programId: "program-1", status: "DRAFT" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
    prismaMock.txApplicationFindMany.mockResolvedValue([]);
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "application-1" });
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-1", title: "Mission 1", order: 0 }]);
    prismaMock.txMissionAssignmentGroupBy.mockResolvedValue([]);
    prismaMock.txMissionAssignmentCreate.mockImplementation(async ({ data }) => ({ id: "assignment-1", ...data }));
  });

  it("lists tenant missions ordered by week and display order", async () => {
    await listTenantMissions("tenant-1", { programId: "program-1", status: "PUBLISHED" });

    expect(prismaMock.missionFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", status: "PUBLISHED" },
      include: { program: true },
      orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { title: "asc" }]
    });
  });

  it("lists only published missions for an applicant program", async () => {
    await listPublishedProgramMissions("tenant-1", "program-1");

    expect(prismaMock.missionFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", status: "PUBLISHED" },
      orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { title: "asc" }]
    });
  });

  it("creates missions only for programs in the same tenant and writes audit", async () => {
    await createMission(baseMissionInput());

    expect(prismaMock.txProgramFindFirst).toHaveBeenCalledWith({
      where: { id: "program-1", tenantId: "tenant-1" },
      select: { id: true }
    });
    expect(prismaMock.txMissionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ tenantId: "tenant-1", programId: "program-1", status: "DRAFT" })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "mission.created", entityType: "Mission" })
    });
  });

  it("scopes mission updates by tenant and writes audit", async () => {
    await updateMission({ ...baseMissionInput(), id: "mission-1" });

    expect(prismaMock.txMissionUpdateMany).toHaveBeenCalledWith({
      where: { id: "mission-1", tenantId: "tenant-1" },
      data: expect.objectContaining({ title: "Mission" })
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "mission.updated", entityId: "mission-1" })
    });
  });

  it("scopes mission status changes by tenant and writes audit", async () => {
    await setMissionStatus({ id: "mission-1", tenantId: "tenant-1", status: "PUBLISHED", actorUserId: "actor-1" });

    expect(prismaMock.txMissionUpdateMany).toHaveBeenCalledWith({
      where: { id: "mission-1", tenantId: "tenant-1" },
      data: { status: "PUBLISHED" }
    });
    expect(prismaMock.txAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "mission.status_changed", metadata: { status: "PUBLISHED" } })
    });
  });
});

describe("backfill assignments on mission publish", () => {
  beforeEach(() => {
    for (const mock of Object.values(prismaMock)) {
      mock.mockReset();
    }
    prismaMock.transaction.mockImplementation(async (callback) =>
      callback({
        program: { findFirst: prismaMock.txProgramFindFirst },
        mission: {
          create: prismaMock.txMissionCreate,
          updateMany: prismaMock.txMissionUpdateMany,
          findFirstOrThrow: prismaMock.txMissionFindFirstOrThrow,
          findFirst: prismaMock.txMissionFindFirst,
          findMany: prismaMock.txMissionFindMany
        },
        application: {
          findFirst: prismaMock.txApplicationFindFirst,
          findMany: prismaMock.txApplicationFindMany
        },
        missionAssignment: {
          findFirst: prismaMock.txMissionAssignmentFindFirst,
          groupBy: prismaMock.txMissionAssignmentGroupBy,
          create: prismaMock.txMissionAssignmentCreate
        },
        auditLog: { create: prismaMock.txAuditLogCreate }
      })
    );
    prismaMock.txProgramFindFirst.mockResolvedValue({ id: "program-1" });
    prismaMock.txMissionCreate.mockResolvedValue({ id: "mission-new" });
    prismaMock.txMissionUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txMissionFindFirstOrThrow.mockResolvedValue({ id: "mission-new" });
    prismaMock.txMissionFindFirst.mockResolvedValue({ id: "mission-1", programId: "program-1", status: "DRAFT" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
    prismaMock.txApplicationFindMany.mockResolvedValue([]);
    prismaMock.txApplicationFindFirst.mockResolvedValue({ id: "application-1" });
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue(null);
    prismaMock.txMissionAssignmentGroupBy.mockResolvedValue([]);
    prismaMock.txMissionAssignmentCreate.mockImplementation(async ({ data }) => ({ id: "assignment-new", ...data }));
  });

  it("backfills Week 1 assignment for already-accepted applicants when a mission is created as PUBLISHED", async () => {
    prismaMock.txApplicationFindMany.mockResolvedValue([{ applicantId: "applicant-1" }]);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-new", title: "New Mission", order: 0 }]);

    await createMission({ ...baseMissionInput(), status: "PUBLISHED" });

    expect(prismaMock.txApplicationFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", status: "ACCEPTED" },
      select: { applicantId: true }
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicantId: "applicant-1",
        missionId: "mission-new",
        weekNumber: 1,
        attemptNumber: 1,
        status: "NOT_STARTED"
      })
    });
  });

  it("does NOT backfill when a mission is created as DRAFT", async () => {
    prismaMock.txApplicationFindMany.mockResolvedValue([{ applicantId: "applicant-1" }]);

    await createMission({ ...baseMissionInput(), status: "DRAFT" });

    expect(prismaMock.txApplicationFindMany).not.toHaveBeenCalled();
    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });

  it("backfills when mission status transitions from DRAFT to PUBLISHED", async () => {
    prismaMock.txMissionFindFirst.mockResolvedValue({ programId: "program-1", status: "DRAFT" });
    prismaMock.txMissionFindFirstOrThrow.mockResolvedValue({ id: "mission-1" });
    prismaMock.txApplicationFindMany.mockResolvedValue([{ applicantId: "applicant-1" }]);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-1", title: "Mission 1", order: 0 }]);

    await setMissionStatus({ id: "mission-1", tenantId: "tenant-1", status: "PUBLISHED", actorUserId: "actor-1" });

    expect(prismaMock.txApplicationFindMany).toHaveBeenCalledWith({
      where: { tenantId: "tenant-1", programId: "program-1", status: "ACCEPTED" },
      select: { applicantId: true }
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ applicantId: "applicant-1", missionId: "mission-1" })
    });
  });

  it("does NOT backfill when mission status transitions from PUBLISHED to PUBLISHED (no-op)", async () => {
    prismaMock.txMissionFindFirst.mockResolvedValue({ programId: "program-1", status: "PUBLISHED" });
    prismaMock.txMissionFindFirstOrThrow.mockResolvedValue({ id: "mission-1" });

    await setMissionStatus({ id: "mission-1", tenantId: "tenant-1", status: "PUBLISHED", actorUserId: "actor-1" });

    expect(prismaMock.txApplicationFindMany).not.toHaveBeenCalled();
  });

  it("does NOT backfill when mission status transitions to ARCHIVED", async () => {
    prismaMock.txMissionFindFirst.mockResolvedValue({ programId: "program-1", status: "PUBLISHED" });
    prismaMock.txMissionFindFirstOrThrow.mockResolvedValue({ id: "mission-1" });

    await setMissionStatus({ id: "mission-1", tenantId: "tenant-1", status: "ARCHIVED", actorUserId: "actor-1" });

    expect(prismaMock.txApplicationFindMany).not.toHaveBeenCalled();
  });

  it("skips backfill for applicants who already have a Week 1 assignment (idempotent)", async () => {
    prismaMock.txApplicationFindMany.mockResolvedValue([{ applicantId: "applicant-1" }]);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-new", title: "New Mission", order: 0 }]);
    prismaMock.txMissionAssignmentFindFirst.mockResolvedValue({ id: "existing-assignment" });

    await createMission({ ...baseMissionInput(), status: "PUBLISHED" });

    expect(prismaMock.txMissionAssignmentCreate).not.toHaveBeenCalled();
  });

  it("backfills multiple accepted applicants", async () => {
    prismaMock.txApplicationFindMany.mockResolvedValue([
      { applicantId: "applicant-1" },
      { applicantId: "applicant-2" }
    ]);
    prismaMock.txMissionFindMany.mockResolvedValue([{ id: "mission-new", title: "New Mission", order: 0 }]);

    await createMission({ ...baseMissionInput(), status: "PUBLISHED" });

    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenCalledTimes(2);
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({ applicantId: "applicant-1" })
    });
    expect(prismaMock.txMissionAssignmentCreate).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({ applicantId: "applicant-2" })
    });
  });
});

function baseMissionInput() {
  return {
    tenantId: "tenant-1",
    programId: "program-1",
    title: "Mission",
    difficulty: "BEGINNER" as const,
    status: "DRAFT" as const,
    weekNumber: 1,
    order: 0,
    brief: "Brief",
    objective: "Objective",
    acceptanceCriteria: "Acceptance",
    deliverables: "Deliverables",
    evaluationCriteria: "Evaluation",
    competencyTags: ["Requirements Engineering"],
    tutorialUrl: null,
    actorUserId: "actor-1"
  };
}
