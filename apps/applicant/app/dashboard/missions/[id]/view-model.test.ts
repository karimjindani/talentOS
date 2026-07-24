import { describe, expect, it } from "vitest";
import type { MissionAssignment, MissionTaskSummary, Submission } from "@talentos/db";
import { buildMissionWorkspaceModel } from "./view-model";

// Minimal builders — the view-model only reads index/title/complete off tasks and status/deadline
// fields off the assignment, so we cast partial shapes to the domain types.
function task(index: number, complete: boolean): MissionTaskSummary {
  return { index, title: `Task ${index}`, complete } as unknown as MissionTaskSummary;
}

function assignment(status: string, withDeadlines = true): MissionAssignment {
  return {
    status,
    deadlineAt: withDeadlines ? new Date("2030-01-08T00:00:00Z") : null,
    graceEndsAt: withDeadlines ? new Date("2030-01-09T00:00:00Z") : null
  } as unknown as MissionAssignment;
}

function submission(status: string, reviewerFeedback: string | null = null): Submission {
  return { status, reviewerFeedback } as unknown as Submission;
}

const threeTasks = (c1: boolean, c2: boolean, c3: boolean) => [task(1, c1), task(2, c2), task(3, c3)];

describe("buildMissionWorkspaceModel — progress & steps", () => {
  it("computes progress from completed steps", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: threeTasks(false, false, false) }).progressPercent).toBe(0);
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: threeTasks(true, true, false) }).progressPercent).toBe(67);
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: threeTasks(true, true, true) }).progressPercent).toBe(100);
  });

  it("marks the first incomplete step as current, earlier ones complete, later ones upcoming", () => {
    const model = buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: threeTasks(true, false, false) });
    expect(model.steps.map((s) => s.status)).toEqual(["complete", "current", "upcoming"]);
    expect(model.nextIncompleteAnchorId).toBe("step-2");
  });

  it("has no current step and no continue target when all steps are complete", () => {
    const model = buildMissionWorkspaceModel({ assignment: assignment("PASSED", false), submission: submission("ACCEPTED"), tasks: threeTasks(true, true, true) });
    expect(model.steps.every((s) => s.status === "complete")).toBe(true);
    expect(model.nextIncompleteAnchorId).toBeNull();
  });

  it("sorts tasks by index and maps step kinds", () => {
    const model = buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: [task(3, false), task(1, true), task(2, false)] });
    expect(model.steps.map((s) => s.index)).toEqual([1, 2, 3]);
    expect(model.steps.map((s) => s.kind)).toEqual(["brief", "tutorial", "submission"]);
  });
});

describe("buildMissionWorkspaceModel — countdown visibility", () => {
  it("shows the countdown for live statuses with both deadline timestamps", () => {
    for (const status of ["ACCEPTED", "IN_PROGRESS", "OVERDUE"]) {
      expect(buildMissionWorkspaceModel({ assignment: assignment(status), submission: null, tasks: threeTasks(false, false, false) }).showCountdown).toBe(true);
    }
  });

  it("hides the countdown for terminal statuses and when deadlines are missing", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("PASSED"), submission: submission("ACCEPTED"), tasks: threeTasks(true, true, true) }).showCountdown).toBe(false);
    expect(buildMissionWorkspaceModel({ assignment: assignment("ACCEPTED", false), submission: null, tasks: threeTasks(false, false, false) }).showCountdown).toBe(false);
    expect(buildMissionWorkspaceModel({ assignment: null, submission: null, tasks: [] }).showCountdown).toBe(false);
  });
});

describe("buildMissionWorkspaceModel — submission mode", () => {
  it("returns accept when there is no assignment or it is NOT_STARTED", () => {
    expect(buildMissionWorkspaceModel({ assignment: null, submission: null, tasks: [] }).submissionMode).toBe("accept");
    expect(buildMissionWorkspaceModel({ assignment: assignment("NOT_STARTED"), submission: null, tasks: threeTasks(false, false, false) }).submissionMode).toBe("accept");
  });

  it("returns failed when the assignment has FAILED", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("FAILED", false), submission: null, tasks: threeTasks(true, true, false) }).submissionMode).toBe("failed");
  });

  it("returns editable with no submission or an editable submission", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: threeTasks(false, false, false) }).submissionMode).toBe("editable");
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: submission("DRAFT"), tasks: threeTasks(true, true, false) }).submissionMode).toBe("editable");
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: submission("NEEDS_REVISION"), tasks: threeTasks(true, true, false) }).submissionMode).toBe("editable");
  });

  it("returns locked once the submission is no longer editable", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("PENDING_EVALUATION", false), submission: submission("SUBMITTED"), tasks: threeTasks(true, true, true) }).submissionMode).toBe("locked");
  });
});

describe("buildMissionWorkspaceModel — canSubmit & reviewer feedback", () => {
  it("allows submit only when both required steps are complete", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: threeTasks(true, true, false) }).canSubmit).toBe(true);
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: null, tasks: threeTasks(true, false, false) }).canSubmit).toBe(false);
  });

  it("shows reviewer feedback unless the submission is still SUBMITTED", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: submission("NEEDS_REVISION", "Fix the README"), tasks: threeTasks(true, true, true) }).showReviewerFeedback).toBe(true);
    expect(buildMissionWorkspaceModel({ assignment: assignment("PENDING_EVALUATION", false), submission: submission("SUBMITTED", "queued note"), tasks: threeTasks(true, true, true) }).showReviewerFeedback).toBe(false);
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: submission("DRAFT", null), tasks: threeTasks(true, true, false) }).showReviewerFeedback).toBe(false);
  });

  it("uses a success tone for accepted feedback and warning otherwise", () => {
    expect(buildMissionWorkspaceModel({ assignment: assignment("PASSED", false), submission: submission("ACCEPTED", "Great work"), tasks: threeTasks(true, true, true) }).reviewerFeedbackTone).toBe("success");
    expect(buildMissionWorkspaceModel({ assignment: assignment("IN_PROGRESS"), submission: submission("NEEDS_REVISION", "Revise"), tasks: threeTasks(true, true, true) }).reviewerFeedbackTone).toBe("warning");
  });
});
