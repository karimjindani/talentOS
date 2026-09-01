/**
 * Who performs a step. `system` marks a non-user action, e.g. simulated elapsed time.
 *
 * `recruiter` is the one actor that never authenticates via Keycloak SSO — recruiters are
 * unauthenticated public visitors, not tenant members (v0.20.4, D-103-recruiter-access). It
 * still needs its own browser context like every other actor, which is why it belongs in this
 * union rather than being folded into "applicant".
 */
export type Actor = "applicant" | "reviewer" | "admin" | "superadmin" | "recruiter" | "system";

/**
 * The 5 named business processes evidence is grouped and reported by (v0.20.5) — one PDF per
 * process, not one per spec file. Order there is report order.
 *
 * Re-exported, not declared, since `v0.20.13` (D-112): the list now lives in
 * `scripts/lib/evidence-taxonomy.ts` so the journey suite, the regression runner and the report
 * renderer all share one copy. It used to be duplicated here and in `journey-pdf-report.ts` with
 * a "keep in sync by hand" comment, and `groupByProcess` drops steps whose tag matches nothing —
 * so drift lost evidence silently instead of failing.
 */
export { PROCESSES, type Process } from "../../../scripts/lib/evidence-taxonomy";
import type { Process } from "../../../scripts/lib/evidence-taxonomy";

export type StepMeta = {
  actor: Actor;
  /** Which of the 5 named business processes this step belongs to. Required — see `PROCESSES`. */
  process: Process;
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
  process: Process;
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
