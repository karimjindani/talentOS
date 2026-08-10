import { isSubmissionEditable } from "@talentos/auth";
import type { MissionAssignment, MissionTaskSummary, Submission } from "@talentos/db";

// Pure derivation for the Mission Workspace. All the branching that used to live inline in page.tsx
// (step status, progress, countdown visibility, submission gating) is centralized here so the page
// stays a thin data-fetch → view-model → render shell, and so the logic is unit-testable under the
// repo's Vitest (node) convention without rendering React.

export type WorkspaceStepKind = "brief" | "tutorial" | "submission";
export type WorkspaceStepStatus = "complete" | "current" | "upcoming";

export type WorkspaceStep = {
  index: number; // 1 | 2 | 3
  anchorId: string; // e.g. "step-1"
  kind: WorkspaceStepKind;
  title: string;
  complete: boolean;
  status: WorkspaceStepStatus;
};

/** Which submission UI to show — mirrors the exact gating the page performed previously. */
export type SubmissionMode = "accept" | "failed" | "editable" | "locked";

export type MissionWorkspaceModel = {
  steps: WorkspaceStep[];
  completedStepCount: number;
  totalStepCount: number;
  progressPercent: number;
  /** Anchor of the first incomplete step — target of the header "Continue" button. */
  nextIncompleteAnchorId: string | null;
  showCountdown: boolean;
  submissionMode: SubmissionMode;
  /** True once required mission steps (Review Brief + Study Tutorial) are complete. */
  canSubmit: boolean;
  showReviewerFeedback: boolean;
  reviewerFeedbackTone: "success" | "warning";
};

const STEP_KIND: Record<number, WorkspaceStepKind> = { 1: "brief", 2: "tutorial", 3: "submission" };
// Statuses whose deadline clock is live (matches the mission detail / list / dashboard gating).
const COUNTDOWN_STATUSES = ["ACCEPTED", "IN_PROGRESS", "OVERDUE"];
// Review Brief (1) + Study Tutorial (2) must be complete before evidence can be submitted.
const REQUIRED_STEP_INDEXES = [1, 2];

type WorkspaceModelInput = {
  assignment: Pick<MissionAssignment, "status" | "deadlineAt" | "graceEndsAt"> | null;
  submission: Pick<Submission, "status" | "reviewerFeedback"> | null;
  tasks: MissionTaskSummary[];
};

export function buildMissionWorkspaceModel({ assignment, submission, tasks }: WorkspaceModelInput): MissionWorkspaceModel {
  const ordered = [...tasks].sort((a, b) => a.index - b.index);
  const firstIncompleteIndex = ordered.find((task) => !task.complete)?.index ?? null;

  const steps: WorkspaceStep[] = ordered.map((task) => {
    const status: WorkspaceStepStatus = task.complete
      ? "complete"
      : task.index === firstIncompleteIndex
        ? "current"
        : "upcoming";
    return {
      index: task.index,
      anchorId: `step-${task.index}`,
      kind: STEP_KIND[task.index] ?? "brief",
      title: task.title,
      complete: task.complete,
      status
    };
  });

  const completedStepCount = ordered.filter((task) => task.complete).length;
  const totalStepCount = ordered.length;
  const progressPercent = totalStepCount === 0 ? 0 : Math.round((completedStepCount / totalStepCount) * 100);

  const status = assignment?.status ?? null;
  const showCountdown = Boolean(
    assignment && status && COUNTDOWN_STATUSES.includes(status) && assignment.deadlineAt && assignment.graceEndsAt
  );

  let submissionMode: SubmissionMode;
  if (!assignment || status === "NOT_STARTED") {
    submissionMode = "accept";
  } else if (status === "FAILED") {
    submissionMode = "failed";
  } else if (!submission || isSubmissionEditable(submission.status)) {
    submissionMode = "editable";
  } else {
    submissionMode = "locked";
  }

  // Match the previous page behavior exactly: `requiredTasks.every(...)` is true when no required
  // task rows are present (e.g. before an assignment exists).
  const requiredTasks = ordered.filter((task) => REQUIRED_STEP_INDEXES.includes(task.index));
  const canSubmit = requiredTasks.every((task) => task.complete);

  const showReviewerFeedback = Boolean(submission?.reviewerFeedback && submission.status !== "SUBMITTED");
  const reviewerFeedbackTone: "success" | "warning" = submission?.status === "ACCEPTED" ? "success" : "warning";

  return {
    steps,
    completedStepCount,
    totalStepCount,
    progressPercent,
    nextIncompleteAnchorId: firstIncompleteIndex ? `step-${firstIncompleteIndex}` : null,
    showCountdown,
    submissionMode,
    canSubmit,
    showReviewerFeedback,
    reviewerFeedbackTone
  };
}
