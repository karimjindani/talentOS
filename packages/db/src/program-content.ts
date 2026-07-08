import { Prisma } from "@prisma/client";
import { prisma } from "./client";

// Program-content management helpers (v0.16.0, D-069): video resources, weekly tasks and
// calendar events — the applicant-dashboard curriculum content that previously existed only via
// dev seed scripts. Same conventions as missions.ts: every write runs in a transaction, verifies
// the program belongs to the tenant (create) or the row belongs to the tenant (update/delete),
// and records an AuditLog entry.

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

// ---------------------------------------------------------------------------
// VideoResource
// ---------------------------------------------------------------------------

export type VideoResourceInput = {
  tenantId: string;
  programId: string;
  title: string;
  url: string;
  description: string | null;
  weekNumber: number | null;
  actorUserId: string | null;
};

export function createVideoResource(input: VideoResourceInput) {
  return prisma.$transaction(async (tx) => {
    await assertProgramBelongsToTenant(tx, input.programId, input.tenantId);

    const resource = await tx.videoResource.create({
      data: {
        tenantId: input.tenantId,
        programId: input.programId,
        title: input.title,
        url: input.url,
        description: input.description,
        weekNumber: input.weekNumber
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "resource.created",
        entityType: "VideoResource",
        entityId: resource.id,
        metadata: { programId: input.programId, weekNumber: input.weekNumber }
      }
    });

    return resource;
  });
}

export type UpdateVideoResourceInput = VideoResourceInput & { id: string };

export function updateVideoResource(input: UpdateVideoResourceInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.videoResource.updateMany({
      where: { id: input.id, tenantId: input.tenantId, programId: input.programId },
      data: {
        title: input.title,
        url: input.url,
        description: input.description,
        weekNumber: input.weekNumber
      }
    });
    if (result.count === 0) {
      throw new Error("Video resource not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "resource.updated",
        entityType: "VideoResource",
        entityId: input.id,
        metadata: { programId: input.programId, weekNumber: input.weekNumber }
      }
    });

    return tx.videoResource.findFirstOrThrow({ where: { id: input.id, tenantId: input.tenantId } });
  });
}

export type DeleteContentInput = {
  id: string;
  tenantId: string;
  actorUserId: string | null;
};

export function deleteVideoResource({ id, tenantId, actorUserId }: DeleteContentInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.videoResource.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) {
      throw new Error("Video resource not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "resource.deleted",
        entityType: "VideoResource",
        entityId: id,
        metadata: {}
      }
    });
  });
}

// ---------------------------------------------------------------------------
// ProgramTask
// ---------------------------------------------------------------------------

export type ProgramTaskInput = {
  tenantId: string;
  programId: string;
  title: string;
  description: string | null;
  weekNumber: number;
  order: number;
  dueAt: Date | null;
  actorUserId: string | null;
};

export function createProgramTask(input: ProgramTaskInput) {
  return prisma.$transaction(async (tx) => {
    await assertProgramBelongsToTenant(tx, input.programId, input.tenantId);

    const task = await tx.programTask.create({
      data: {
        tenantId: input.tenantId,
        programId: input.programId,
        title: input.title,
        description: input.description,
        weekNumber: input.weekNumber,
        order: input.order,
        dueAt: input.dueAt
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "task.created",
        entityType: "ProgramTask",
        entityId: task.id,
        metadata: { programId: input.programId, weekNumber: input.weekNumber }
      }
    });

    return task;
  });
}

export type UpdateProgramTaskInput = ProgramTaskInput & { id: string };

export function updateProgramTask(input: UpdateProgramTaskInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.programTask.updateMany({
      where: { id: input.id, tenantId: input.tenantId, programId: input.programId },
      data: {
        title: input.title,
        description: input.description,
        weekNumber: input.weekNumber,
        order: input.order,
        dueAt: input.dueAt
      }
    });
    if (result.count === 0) {
      throw new Error("Program task not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "task.updated",
        entityType: "ProgramTask",
        entityId: input.id,
        metadata: { programId: input.programId, weekNumber: input.weekNumber }
      }
    });

    return tx.programTask.findFirstOrThrow({ where: { id: input.id, tenantId: input.tenantId } });
  });
}

export function deleteProgramTask({ id, tenantId, actorUserId }: DeleteContentInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.programTask.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) {
      throw new Error("Program task not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "task.deleted",
        entityType: "ProgramTask",
        entityId: id,
        metadata: {}
      }
    });
  });
}

// ---------------------------------------------------------------------------
// CalendarEvent
// ---------------------------------------------------------------------------

export type CalendarEventInput = {
  tenantId: string;
  programId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  actorUserId: string | null;
};

export function createCalendarEvent(input: CalendarEventInput) {
  return prisma.$transaction(async (tx) => {
    await assertProgramBelongsToTenant(tx, input.programId, input.tenantId);

    const event = await tx.calendarEvent.create({
      data: {
        tenantId: input.tenantId,
        programId: input.programId,
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "event.created",
        entityType: "CalendarEvent",
        entityId: event.id,
        metadata: { programId: input.programId }
      }
    });

    return event;
  });
}

export type UpdateCalendarEventInput = CalendarEventInput & { id: string };

export function updateCalendarEvent(input: UpdateCalendarEventInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.calendarEvent.updateMany({
      where: { id: input.id, tenantId: input.tenantId, programId: input.programId },
      data: {
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        location: input.location
      }
    });
    if (result.count === 0) {
      throw new Error("Calendar event not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "event.updated",
        entityType: "CalendarEvent",
        entityId: input.id,
        metadata: { programId: input.programId }
      }
    });

    return tx.calendarEvent.findFirstOrThrow({ where: { id: input.id, tenantId: input.tenantId } });
  });
}

export function deleteCalendarEvent({ id, tenantId, actorUserId }: DeleteContentInput) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.calendarEvent.deleteMany({ where: { id, tenantId } });
    if (result.count === 0) {
      throw new Error("Calendar event not found for this tenant.");
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorUserId,
        action: "event.deleted",
        entityType: "CalendarEvent",
        entityId: id,
        metadata: {}
      }
    });
  });
}
