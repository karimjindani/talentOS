/** Who performs a step. `system` marks a non-user action, e.g. simulated elapsed time. */
export type Actor = "applicant" | "reviewer" | "admin" | "superadmin" | "system";

export type StepMeta = {
  actor: Actor;
  /**
   * What this step proves. Required, never optional: without it the evidence is a screenshot of a
   * page and the reader must infer the claim.
   */
  proves: string;
};

export type JourneyStepRecord = {
  index: number;
  name: string;
  actor: Actor;
  proves: string;
  status: "passed" | "failed";
  durationMs: number;
  /** Null when the step failed — evidence never shows a shot for an unmet assertion. */
  screenshot: string | null;
  error?: string;
};

export type JourneyRecord = {
  journey: string;
  runId: string;
  startedAt: string;
  durationMs: number;
  status: "passed" | "failed";
  steps: JourneyStepRecord[];
};
