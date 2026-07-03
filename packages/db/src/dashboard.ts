import { prisma } from "./client";
import type { NotificationType } from "@prisma/client";

// ---------------------------------------------------------------------------
// ProgramTask helpers
// ---------------------------------------------------------------------------

/** List all tasks for a program, ordered by weekNumber then order. */
export function listProgramTasks(tenantId: string, programId: string) {
  return prisma.programTask.findMany({
    where: { tenantId, programId },
    orderBy: [{ weekNumber: "asc" }, { order: "asc" }],
  });
}

/** List tasks for a specific week of a program. */
export function listTasksByWeek(tenantId: string, programId: string, weekNumber: number) {
  return prisma.programTask.findMany({
    where: { tenantId, programId, weekNumber },
    orderBy: [{ order: "asc" }],
  });
}

// ---------------------------------------------------------------------------
// VideoResource helpers
// ---------------------------------------------------------------------------

/** List video resources for a program, optionally filtered by week. */
export function listVideoResources(tenantId: string, programId: string, weekNumber?: number) {
  return prisma.videoResource.findMany({
    where: { tenantId, programId, ...(weekNumber != null ? { weekNumber } : {}) },
    orderBy: [{ weekNumber: "asc" }, { createdAt: "asc" }],
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

/** List task IDs that the user has completed for a program. */
export async function listCompletedTaskIds(userId: string, programId: string) {
  const completions = await prisma.userTaskCompletion.findMany({
    where: { userId, task: { programId } },
    select: { taskId: true },
  });
  return completions.map((c) => c.taskId);
}

/** Mark a task as completed for a user. */
export function markTaskCompleted(taskId: string, userId: string) {
  return prisma.userTaskCompletion.upsert({
    where: { taskId_userId: { taskId, userId } },
    update: { completedAt: new Date() },
    create: { taskId, userId },
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
  const tasks = await listProgramTasks(tenantId, programId);
  const completedTaskIds = await listCompletedTaskIds(userId, programId);

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
