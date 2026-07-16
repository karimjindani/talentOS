import type { NotificationType } from "@prisma/client";
import { prisma } from "./client";

// ---------------------------------------------------------------------------
// ProgramTask helpers
// ---------------------------------------------------------------------------

/** List all tasks for a program, ordered by weekNumber then order. */
export function listProgramTasks(tenantId: string, programId: string) {
  return prisma.programTask.findMany({
    where: { tenantId, programId },
    include: {
      resources: {
        where: { tenantId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
}

/** List all applicant-visible tasks for a program. */
export function listPublishedProgramTasks(tenantId: string, programId: string) {
  return prisma.programTask.findMany({
    where: { tenantId, programId, published: true },
    include: {
      resources: {
        where: { tenantId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { createdAt: "asc" }]
  });
}

/** List applicant-visible tasks and their resources for a program week. */
export function listTasksByWeek(tenantId: string, programId: string, weekNumber: number) {
  return prisma.programTask.findMany({
    where: { tenantId, programId, weekNumber, published: true },
    include: {
      resources: {
        where: { tenantId },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }]
      }
    },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// VideoResource helpers
// ---------------------------------------------------------------------------

/** List video resources for a program, optionally filtered by week. */
export function listVideoResources(tenantId: string, programId: string, weekNumber?: number) {
  return prisma.videoResource.findMany({
    where: { tenantId, programId, ...(weekNumber != null ? { weekNumber } : {}) },
    include: { task: { select: { id: true, title: true, weekNumber: true } } },
    orderBy: [{ weekNumber: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// CalendarEvent helpers
// ---------------------------------------------------------------------------

/** List upcoming calendar events for a program (startsAt >= now by default). */
export function listCalendarEvents(tenantId: string, programId: string, includePast = false) {
  return prisma.calendarEvent.findMany({
    where: {
      tenantId,
      programId,
      ...(includePast ? {} : { startsAt: { gte: new Date() } }),
    },
    orderBy: [{ startsAt: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------

/** List notifications for a user — unread first, then newest first. */
export function listUserNotifications(userId: string, tenantId: string) {
  return prisma.notification.findMany({
    where: { userId, tenantId },
    orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
  });
}

/** Count unread notifications for a user. */
export function countUnreadNotifications(userId: string, tenantId: string) {
  return prisma.notification.count({
    where: { userId, tenantId, readAt: null },
  });
}

/** Mark a notification as read. */
export function markNotificationRead(id: string, userId: string) {
  return prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
}

/** Create a notification. */
export function createNotification(input: {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
}) {
  return prisma.notification.create({ data: input });
}

// ---------------------------------------------------------------------------
// UserTaskCompletion helpers
// ---------------------------------------------------------------------------

/** List tenant-scoped task IDs that an applicant completed for a program or one program week. */
export async function listCompletedTaskIds(
  tenantId: string,
  userId: string,
  programId: string,
  weekNumber?: number
) {
  const completions = await prisma.userTaskCompletion.findMany({
    where: {
      tenantId,
      userId,
      task: {
        tenantId,
        programId,
        ...(weekNumber == null ? {} : { weekNumber })
      }
    },
    select: { taskId: true },
  });
  return completions.map((c) => c.taskId);
}

export type CompleteApplicantTaskInput = {
  tenantId: string;
  applicantId: string;
  taskId: string;
  missionAssignmentId: string;
};

/** Complete one published task in the applicant's current accepted-program assignment week. */
export function markApplicantTaskCompleted(input: CompleteApplicantTaskInput) {
  return prisma.$transaction(async (tx) => {
    const assignment = await tx.missionAssignment.findFirst({
      where: {
        id: input.missionAssignmentId,
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] }
      },
      select: { id: true, programId: true, weekNumber: true }
    });
    if (!assignment) {
      throw new Error("An open assignment was not found for this applicant.");
    }

    const acceptedApplication = await tx.application.findFirst({
      where: {
        tenantId: input.tenantId,
        applicantId: input.applicantId,
        programId: assignment.programId,
        status: "ACCEPTED"
      },
      select: { id: true }
    });
    if (!acceptedApplication) {
      throw new Error("Tasks are available only for the applicant's accepted program.");
    }

    const task = await tx.programTask.findFirst({
      where: {
        id: input.taskId,
        tenantId: input.tenantId,
        programId: assignment.programId,
        weekNumber: assignment.weekNumber,
        published: true
      },
      select: { id: true }
    });
    if (!task) {
      throw new Error("Task was not found for this program week.");
    }

    const completion = await tx.userTaskCompletion.upsert({
      where: {
        tenantId_userId_taskId: {
          tenantId: input.tenantId,
          userId: input.applicantId,
          taskId: task.id
        }
      },
      update: {},
      create: { tenantId: input.tenantId, taskId: task.id, userId: input.applicantId }
    });

    await tx.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorUserId: input.applicantId,
        action: "task.completed",
        entityType: "UserTaskCompletion",
        entityId: completion.id,
        metadata: {
          taskId: task.id,
          missionAssignmentId: assignment.id,
          programId: assignment.programId,
          weekNumber: assignment.weekNumber
        }
      }
    });

    return completion;
  });
}

// ---------------------------------------------------------------------------
// Progress calculation
// ---------------------------------------------------------------------------

export type WeekProgress = {
  weekNumber: number;
  totalTasks: number;
  completedTasks: number;
  percentage: number;
};

/** Compute per-week progress for an applicant in a program. */
export async function getApplicantProgramProgress(
  userId: string,
  tenantId: string,
  programId: string
): Promise<WeekProgress[]> {
  const tasks = await listPublishedProgramTasks(tenantId, programId);
  const completedTaskIds = await listCompletedTaskIds(tenantId, userId, programId);

  const weekMap = new Map<number, { total: number; completed: number }>();

  for (const task of tasks) {
    const entry = weekMap.get(task.weekNumber) ?? { total: 0, completed: 0 };
    entry.total += 1;
    if (completedTaskIds.includes(task.id)) {
      entry.completed += 1;
    }
    weekMap.set(task.weekNumber, entry);
  }

  // Ensure all 4 weeks are represented even if no tasks
  const weeks: WeekProgress[] = [];
  for (let w = 1; w <= 4; w++) {
    const entry = weekMap.get(w) ?? { total: 0, completed: 0 };
    weeks.push({
      weekNumber: w,
      totalTasks: entry.total,
      completedTasks: entry.completed,
      percentage: entry.total === 0 ? 0 : Math.round((entry.completed / entry.total) * 100),
    });
  }

  return weeks;
}
