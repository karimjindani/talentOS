import { LearningResourceType, Prisma } from "@prisma/client";
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
  taskId: string | null;
  type: LearningResourceType;
  title: string;
  url: string | null;
  markdownContent: string | null;
  description: string | null;
  weekNumber: number | null;
  order: number;
  durationSeconds: number | null;
  /** Set for DOCUMENT resources — the uploaded StoredFile id. Ignored for other types. */
  fileId?: string | null;
  actorUserId: string | null;
};

async function normalizeLearningResourceInput(tx: Prisma.TransactionClient, input: VideoResourceInput) {
  let weekNumber = input.weekNumber;
  if (input.taskId) {
    const task = await tx.programTask.findFirst({
      where: { id: input.taskId, tenantId: input.tenantId, programId: input.programId },
      select: { weekNumber: true }
    });
    if (!task) {
      throw new Error("Program task not found for this tenant.");
    }
    weekNumber = task.weekNumber;
  }

  if (input.type === LearningResourceType.DOCUMENT) {
    if (!input.fileId) {
      throw new Error("Upload a document for a document resource.");
    }
    // Confirm the file exists and belongs to this tenant before linking it.
    const file = await tx.storedFile.findFirst({
      where: { id: input.fileId, tenantId: input.tenantId },
      select: { id: true }
    });
    if (!file) {
      throw new Error("Uploaded document was not found for this tenant.");
    }
    return { weekNumber, url: null, markdownContent: null, fileId: input.fileId };
  }

  if (input.type === LearningResourceType.MARKDOWN) {
    const markdownContent = input.markdownContent?.trim();
    if (!markdownContent) {
      throw new Error("Markdown content is required for a Markdown resource.");
    }
    return { weekNumber, url: null, markdownContent, fileId: null };
  }

  if (input.url) {
    validateYouTubeUrl(input.url);
  }
  return { weekNumber, url: input.url, markdownContent: null, fileId: null };
}

function validateYouTubeUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a valid YouTube URL (including https://).");
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    Boolean(url.username || url.password) ||
    (host !== "youtube.com" && host !== "www.youtube.com" && host !== "youtu.be")
  ) {
    throw new Error("Enter a valid public YouTube URL.");
  }
}

export function createVideoResource(input: VideoResourceInput) {
  return prisma.$transaction(async (tx) => {
    await assertProgramBelongsToTenant(tx, input.programId, input.tenantId);
    const normalized = await normalizeLearningResourceInput(tx, input);

    const resource = await tx.videoResource.create({
      data: {
        tenantId: input.tenantId,
        programId: input.programId,
        taskId: input.taskId,
        type: input.type,
        title: input.title,
        url: normalized.url,
        markdownContent: normalized.markdownContent,
        description: input.description,
        weekNumber: normalized.weekNumber,
        order: input.order,
        durationSeconds: input.durationSeconds,
        fileId: normalized.fileId
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        action: "resource.created",
        entityType: "VideoResource",
        entityId: resource.id,
        metadata: { programId: input.programId, taskId: input.taskId, weekNumber: normalized.weekNumber, type: input.type }
      }
    });

    return resource;
  });
}

export type UpdateVideoResourceInput = VideoResourceInput & { id: string };

export function updateVideoResource(input: UpdateVideoResourceInput) {
  return prisma.$transaction(async (tx) => {
    const normalized = await normalizeLearningResourceInput(tx, input);
    const result = await tx.videoResource.updateMany({
      where: { id: input.id, tenantId: input.tenantId, programId: input.programId },
      data: {
        taskId: input.taskId,
        type: input.type,
        title: input.title,
        url: normalized.url,
        markdownContent: normalized.markdownContent,
        description: input.description,
        weekNumber: normalized.weekNumber,
        order: input.order,
        durationSeconds: input.durationSeconds,
        fileId: normalized.fileId
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
        metadata: { programId: input.programId, taskId: input.taskId, weekNumber: normalized.weekNumber, type: input.type }
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
  required: boolean;
  published: boolean;
  /** When true, the mission's steps stay locked until the applicant completes this task. */
  isPrerequisite?: boolean;
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
        dueAt: input.dueAt,
        required: input.required,
        published: input.published,
        isPrerequisite: input.isPrerequisite ?? false
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
        dueAt: input.dueAt,
        required: input.required,
        published: input.published,
        isPrerequisite: input.isPrerequisite ?? false
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
