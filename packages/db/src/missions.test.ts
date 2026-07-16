import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  missionFindMany: vi.fn(),
  missionFindFirst: vi.fn(),
  transaction: vi.fn(),
  txProgramFindFirst: vi.fn(),
  txMissionCreate: vi.fn(),
  txMissionUpdateMany: vi.fn(),
  txMissionFindFirstOrThrow: vi.fn(),
  txAuditLogCreate: vi.fn()
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
          findFirstOrThrow: prismaMock.txMissionFindFirstOrThrow
        },
        auditLog: { create: prismaMock.txAuditLogCreate }
      })
    );
    prismaMock.txProgramFindFirst.mockResolvedValue({ id: "program-1" });
    prismaMock.txMissionCreate.mockResolvedValue({ id: "mission-1" });
    prismaMock.txMissionUpdateMany.mockResolvedValue({ count: 1 });
    prismaMock.txMissionFindFirstOrThrow.mockResolvedValue({ id: "mission-1" });
    prismaMock.txAuditLogCreate.mockResolvedValue({ id: "audit-1" });
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
