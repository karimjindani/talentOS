import { prisma } from "./client";
import type { MissionAssignmentStatus, Submission } from "@prisma/client";

// Mission-driven tasks (v0.19.0): every mission breaks into the same fixed 3-step checklist rather
// than admin-authored ProgramTask rows. Task 3 has no completion row of its own — it's implied
// complete once the linked Submission exists beyond DRAFT/NEEDS_REVISION, since submitting *is*
// that step.
export type MissionTaskIndex = 1 | 2 | 3;
export const REQUIRED_TASK_INDEXES: readonly MissionTaskIndex[] = [1, 2];

// The checklist is editable only while the applicant is actually working the mission:
// NOT_STARTED requires an explicit accept first, and every post-submission/terminal status
// freezes the checklist (v0.19.4). Shared by the write guards below and the applicant UI.
export const MARKABLE_ASSIGNMENT_STATUSES: readonly MissionAssignmentStatus[] = [
  "ACCEPTED",
  "IN_PROGRESS",
  "OVERDUE"
];

const CHECKLIST_LOCK_REASONS: Partial<Record<MissionAssignmentStatus, string>> = {
  NOT_STARTED: "Accept this mission first — tasks unlock once you start it.",
  PENDING_EVALUATION: "You've submitted this mission. The checklist is locked while it's being reviewed.",
  LATE_SUBMITTED: "You've submitted this mission. The checklist is locked while it's being reviewed.",
  PASSED: "This mission is passed — its checklist is complete and locked.",
  FAILED: "This mission has failed and can no longer be worked on.",
  REPEAT: "This attempt was closed with a repeat decision — work on your new mission instead."
};

/** Why the checklist can't be edited for this status, or null when it's editable. */
export function missionChecklistLockReason(status: MissionAssignmentStatus): string | null {
  return CHECKLIST_LOCK_REASONS[status] ?? null;
}

const TASK_TITLES: Record<MissionTaskIndex, string> = {
  1: "Review the Mission Brief",
  2: "Study the Tutorial",
  3: "Build & Submit Evidence"
};

export function missionTaskTitle(index: MissionTaskIndex): string {
  return TASK_TITLES[index];
}

export type MissionTaskSummary = {
  index: MissionTaskIndex;
  title: string;
  complete: boolean;
};

function isTask3Complete(submission: Pick<Submission, "status"> | null | undefined): boolean {
  return Boolean(submission && submission.status !== "DRAFT" && submission.status !== "NEEDS_REVISION");
}

function buildTaskSummaries(
  status: MissionAssignmentStatus,
  completedIndexes: Set<number>,
  task3Complete: boolean
): MissionTaskSummary[] {
  // A mission can't pass through the normal flow without tasks 1–2 checked (they gate "Submit
  // for Review"), so a PASSED assignment always reports a complete checklist even when the
  // rows are absent (data seeded or migrated outside that flow).
  const passed = status === "PASSED";
  return ([1, 2, 3] as MissionTaskIndex[]).map((index) => ({
    index,
    title: TASK_TITLES[index],
    complete: passed || (index === 3 ? task3Complete : completedIndexes.has(index))
  }));
}

/** One assignment's mission + its 3 fixed task summaries — for the mission detail and task-resource pages. */
export async function getMissionTasksForAssignment(tenantId: string, applicantId: string, missionAssignmentId: string) {
  const assignment = await prisma.missionAssignment.findFirst({
    where: { id: missionAssignmentId, tenantId, applicantId },
    include: {
      mission: true,
      submissions: { select: { status: true }, take: 1 }
    }
  });
  if (!assignment) {
    return null;
  }

  const completions = await prisma.missionTaskCompletion.findMany({
    where: { missionAssignmentId },
    select: { taskIndex: true }
  });
  const completedIndexes = new Set(completions.map((completion) => completion.taskIndex));
  const tasks = buildTaskSummaries(assignment.status, completedIndexes, isTask3Complete(assignment.submissions[0]));

  return { assignment, mission: assignment.mission, tasks };
}

/** The applicant's currently assigned missions (latest attempt per week), each with its 3 tasks — for the Tasks page. */
export async function listAssignedMissionsWithTasks(tenantId: string, applicantId: string, programId: string) {
  const assignments = await prisma.missionAssignment.findMany({
    where: { tenantId, applicantId, programId, mission: { status: "PUBLISHED" } },
    include: { mission: true, submissions: { select: { status: true }, take: 1 } },
    orderBy: [{ weekNumber: "asc" }, { attemptNumber: "desc" }]
  });

  const latestByWeek = new Map<number, (typeof assignments)[number]>();
  for (const assignment of assignments) {
    if (!latestByWeek.has(assignment.weekNumber)) {
      latestByWeek.set(assignment.weekNumber, assignment);
    }
  }
  const ordered = [...latestByWeek.values()].sort(
    (a, b) => a.weekNumber - b.weekNumber || a.mission.order - b.mission.order
  );
  if (ordered.length === 0) {
    return [];
  }

  const completions = await prisma.missionTaskCompletion.findMany({
    where: { missionAssignmentId: { in: ordered.map((assignment) => assignment.id) } },
    select: { missionAssignmentId: true, taskIndex: true }
  });
  const completedByAssignment = new Map<string, Set<number>>();
  for (const completion of completions) {
    const set = completedByAssignment.get(completion.missionAssignmentId) ?? new Set<number>();
    set.add(completion.taskIndex);
    completedByAssignment.set(completion.missionAssignmentId, set);
  }

  return ordered.map((assignment) => ({
    assignment,
    mission: assignment.mission,
    tasks: buildTaskSummaries(
      assignment.status,
      completedByAssignment.get(assignment.id) ?? new Set<number>(),
      isTask3Complete(assignment.submissions[0])
    )
  }));
}

/** Whether both required (manually-checked) tasks are complete — gates "Submit for Review". */
export async function areRequiredMissionTasksComplete(missionAssignmentId: string): Promise<boolean> {
  const completions = await prisma.missionTaskCompletion.findMany({
    where: { missionAssignmentId, taskIndex: { in: [...REQUIRED_TASK_INDEXES] } },
    select: { taskIndex: true }
  });
  const completedIndexes = new Set(completions.map((completion) => completion.taskIndex));
  return REQUIRED_TASK_INDEXES.every((index) => completedIndexes.has(index));
}

export type MissionTaskActionInput = {
  tenantId: string;
  applicantId: string;
  missionAssignmentId: string;
  taskIndex: MissionTaskIndex;
};

export async function markMissionTaskComplete({ tenantId, applicantId, missionAssignmentId, taskIndex }: MissionTaskActionInput) {
  if (taskIndex === 3) {
    throw new Error("Task 3 is completed automatically by submitting the mission, not marked manually.");
  }
  const assignment = await prisma.missionAssignment.findFirst({
    where: {
      id: missionAssignmentId,
      tenantId,
      applicantId,
      status: { in: [...MARKABLE_ASSIGNMENT_STATUSES] }
    },
    select: { id: true }
  });
  if (!assignment) {
    throw new Error("Mission assignment is not accepted/active for this applicant.");
  }
  return prisma.missionTaskCompletion.upsert({
    where: { missionAssignmentId_taskIndex: { missionAssignmentId, taskIndex } },
    create: { tenantId, missionAssignmentId, taskIndex },
    update: {}
  });
}

export async function unmarkMissionTaskComplete({ tenantId, applicantId, missionAssignmentId, taskIndex }: MissionTaskActionInput) {
  // Same lifecycle guard as marking (v0.19.4): a locked checklist is immutable in both
  // directions — un-checking a task on a submitted/finished attempt would corrupt its record.
  const assignment = await prisma.missionAssignment.findFirst({
    where: {
      id: missionAssignmentId,
      tenantId,
      applicantId,
      status: { in: [...MARKABLE_ASSIGNMENT_STATUSES] }
    },
    select: { id: true }
  });
  if (!assignment) {
    throw new Error("Mission assignment is not accepted/active for this applicant.");
  }
  await prisma.missionTaskCompletion.deleteMany({
    where: { missionAssignmentId, taskIndex }
  });
}
