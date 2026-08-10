import { prisma } from "./client";
import type { Submission } from "@prisma/client";

// Mission-driven tasks (v0.19.0): every mission breaks into the same fixed 3-step checklist rather
// than admin-authored ProgramTask rows. Task 3 has no completion row of its own — it's implied
// complete once the linked Submission exists beyond DRAFT/NEEDS_REVISION, since submitting *is*
// that step.
export type MissionTaskIndex = 1 | 2 | 3;
export const REQUIRED_TASK_INDEXES: readonly MissionTaskIndex[] = [1, 2];

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

function buildTaskSummaries(completedIndexes: Set<number>, task3Complete: boolean): MissionTaskSummary[] {
  return ([1, 2, 3] as MissionTaskIndex[]).map((index) => ({
    index,
    title: TASK_TITLES[index],
    complete: index === 3 ? task3Complete : completedIndexes.has(index)
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
  const tasks = buildTaskSummaries(completedIndexes, isTask3Complete(assignment.submissions[0]));

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
      status: { in: ["ACCEPTED", "IN_PROGRESS", "OVERDUE"] }
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
  const assignment = await prisma.missionAssignment.findFirst({
    where: { id: missionAssignmentId, tenantId, applicantId },
    select: { id: true }
  });
  if (!assignment) {
    throw new Error("Mission assignment not found for this applicant.");
  }
  await prisma.missionTaskCompletion.deleteMany({
    where: { missionAssignmentId, taskIndex }
  });
}
