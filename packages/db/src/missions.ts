import { type MissionDifficulty, type MissionStatus, Prisma } from "@prisma/client";
import { prisma } from "./client";

export type MissionListFilters = {
  programId?: string;
  status?: MissionStatus;
};

export function listTenantMissions(tenantId: string, filters: MissionListFilters = {}) {
  return prisma.mission.findMany({
    where: {
      tenantId,
      ...(filters.programId ? { programId: filters.programId } : {}),
      ...(filters.status ? { status: filters.status } : {})
    },
    include: { program: true },
    orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { title: "asc" }]
  });
}

export function listPublishedProgramMissions(tenantId: string, programId: string) {
  return prisma.mission.findMany({
    where: { tenantId, programId, status: "PUBLISHED" },
    orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { title: "asc" }]
  });
}

export function getTenantMission(id: string, tenantId: string) {
  return prisma.mission.findFirst({
    where: { id, tenantId },
    include: { program: true }
  });
}

export function getPublishedProgramMission(id: string, tenantId: string, programId: string) {
  return prisma.mission.findFirst({
    where: { id, tenantId, programId, status: "PUBLISHED" }
  });
}

export type MissionInput = {
  tenantId: string;
  programId: string;
  title: string;
  difficulty: MissionDifficulty;
  status: MissionStatus;
  weekNumber: number;
  order: number;
  brief: string;
  objective: string;
  acceptanceCriteria: string;
  deliverables: string;
  evaluationCriteria: string;
  competencyTags: string[];
  actorUserId: string | null;
};

export async function createMission(input: MissionInput) {
  return prisma.$transaction(async (tx) => {
    await assertProgramBelongsToTenant(tx, input.programId, input.tenantId);

    const mission = await tx.mission.create({
      data: {
        tenantId: input.tenantId,
        programId: input.programId,
        title: input.title,
        difficulty: input.difficulty,
        status: input.status,
        weekNumber: input.weekNumber,
        order: input.order,
        brief: input.brief,
        objective: input.objective,
        acceptanceCriteria: input.acceptanceCriteria,
        deliverables: input.deliverables,
        evaluationCriteria: input.evaluationCriteria,
        competencyTags: input.competencyTags
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "mission.created",
        entityType: "Mission",
        entityId: mission.id,
        metadata: { programId: input.programId, status: input.status, weekNumber: input.weekNumber }
      }
    });

    return mission;
  });
}

export type UpdateMissionInput = Omit<MissionInput, "status"> & {
  id: string;
};

export async function updateMission(input: UpdateMissionInput) {
  return prisma.$transaction(async (tx) => {
    await assertProgramBelongsToTenant(tx, input.programId, input.tenantId);

    const result = await tx.mission.updateMany({
      where: { id: input.id, tenantId: input.tenantId },
      data: {
        programId: input.programId,
        title: input.title,
        difficulty: input.difficulty,
        weekNumber: input.weekNumber,
        order: input.order,
        brief: input.brief,
        objective: input.objective,
        acceptanceCriteria: input.acceptanceCriteria,
        deliverables: input.deliverables,
        evaluationCriteria: input.evaluationCriteria,
        competencyTags: input.competencyTags
      }
    });
    if (result.count === 0) {
      throw new Error("Mission not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "mission.updated",
        entityType: "Mission",
        entityId: input.id,
        metadata: { programId: input.programId, weekNumber: input.weekNumber }
      }
    });

    return tx.mission.findFirstOrThrow({ where: { id: input.id, tenantId: input.tenantId } });
  });
}

export type SetMissionStatusInput = {
  id: string;
  tenantId: string;
  status: MissionStatus;
  actorUserId: string | null;
};

export function setMissionStatus({ id, tenantId, status, actorUserId }: SetMissionStatusInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.mission.updateMany({ where: { id, tenantId }, data: { status } });
    if (result.count === 0) {
      throw new Error("Mission not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "mission.status_changed",
        entityType: "Mission",
        entityId: id,
        metadata: { status }
      }
    });

    return tx.mission.findFirstOrThrow({ where: { id, tenantId } });
  });
}

async function assertProgramBelongsToTenant(
  tx: Prisma.TransactionClient,
  programId: string,
  tenantId: string
) {
  const program = await tx.program.findFirst({ where: { id: programId, tenantId }, select: { id: true } });
  if (!program) {
    throw new Error("Program not found for this tenant.");
  }
}
